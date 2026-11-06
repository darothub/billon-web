import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { prisma } from '../helpers/contract'
import { call, handlerAt } from '../helpers/http'
import { expectMoney } from '../helpers/money'
import {
  assertScratchDatabase,
  resetDatabase,
  makeAccount,
  makeClient,
  makeInvoice,
  invoiceBody,
  type TestAccount,
} from '../helpers/db'

let invoices: Awaited<ReturnType<typeof handlerAt>>
let invoice: Awaited<ReturnType<typeof handlerAt>>
let send: Awaited<ReturnType<typeof handlerAt>>
let markPaid: Awaited<ReturnType<typeof handlerAt>>
let voidIt: Awaited<ReturnType<typeof handlerAt>>
let lineItems: Awaited<ReturnType<typeof handlerAt>>
let lineItem: Awaited<ReturnType<typeof handlerAt>>
let profile: Awaited<ReturnType<typeof handlerAt>>

let account: TestAccount
let clientId: number

beforeAll(async () => {
  assertScratchDatabase()
  invoices = await handlerAt('v1/invoices/index')
  invoice = await handlerAt('v1/invoices/[id]/index')
  send = await handlerAt('v1/invoices/[id]/send')
  markPaid = await handlerAt('v1/invoices/[id]/mark-paid')
  voidIt = await handlerAt('v1/invoices/[id]/void')
  lineItems = await handlerAt('v1/invoices/[id]/line-items/index')
  lineItem = await handlerAt('v1/invoices/[id]/line-items/[itemId]')
  profile = await handlerAt('v1/users/me/index')
})

beforeEach(async () => {
  await resetDatabase()
  account = await makeAccount({ invoicePrefix: 'INV-', invoiceNextNumber: 1 })
  clientId = (await makeClient(account.id, { name: 'Beta Ltd' })).id
})

describe('the invoice list', () => {
  let otherClientId: number

  beforeEach(async () => {
    otherClientId = (await makeClient(account.id, { name: 'Gamma Ltd' })).id
    await makeInvoice(account.id, clientId, { invoiceNumber: 'INV-0001', status: 'DRAFT' })
    await makeInvoice(account.id, clientId, { invoiceNumber: 'INV-0002', status: 'SENT' })
    await makeInvoice(account.id, clientId, { invoiceNumber: 'INV-0003', status: 'PAID' })
    await makeInvoice(account.id, otherClientId, { invoiceNumber: 'INV-0004', status: 'SENT' })
    await makeInvoice(account.id, otherClientId, { invoiceNumber: 'INV-0005', status: 'OVERDUE' })
  })

  it('pages', async () => {
    const res = await call(invoices, {
      method: 'GET',
      token: account.token,
      query: { page: '0', size: '2' },
    })
    expect(res.body.data.content).toHaveLength(2)
    expect(res.body.data.totalElements).toBe(5)
    expect(res.body.data.totalPages).toBe(3)
    expect(res.body.data.first).toBe(true)
    expect(res.body.data.last).toBe(false)
  })

  it("sorts by created date descending, which is what the invoices page sends", async () => {
    const res = await call(invoices, {
      method: 'GET',
      token: account.token,
      query: { size: '100', sort: 'createdAt,desc' },
    })
    const created = res.body.data.content.map((i: { createdAt: string }) => i.createdAt)
    const sorted = [...created].sort().reverse()
    expect(created).toEqual(sorted)
  })

  it('filters by status, which is what the invoices page sends', async () => {
    const res = await call(invoices, {
      method: 'GET',
      token: account.token,
      query: { status: 'SENT', size: '100' },
    })
    expect(res.body.data.totalElements).toBe(2)
    for (const row of res.body.data.content) expect(row.status).toBe('SENT')
  })

  it("filters by client, which is what the client page's invoice list sends", async () => {
    const res = await call(invoices, {
      method: 'GET',
      token: account.token,
      query: { clientId: String(otherClientId), size: '100' },
    })
    expect(res.body.data.totalElements).toBe(2)
    for (const row of res.body.data.content) expect(row.clientName).toBe('Gamma Ltd')
  })

  it('filters by status and client together', async () => {
    const res = await call(invoices, {
      method: 'GET',
      token: account.token,
      query: { clientId: String(otherClientId), status: 'OVERDUE', size: '100' },
    })
    expect(res.body.data.totalElements).toBe(1)
    expect(res.body.data.content[0].invoiceNumber).toBe('INV-0005')
  })

  it("answers the dashboard's recent list — a small page sorted newest first", async () => {
    const res = await call(invoices, {
      method: 'GET',
      token: account.token,
      query: { size: '5', sort: 'createdAt,desc' },
    })
    expect(res.status).toBe(200)
    expect(res.body.data.content.length).toBeLessThanOrEqual(5)
  })

  it('each row carries every field the invoice table draws', async () => {
    const res = await call(invoices, { method: 'GET', token: account.token, query: { size: '1' } })
    expect(Object.keys(res.body.data.content[0]).sort()).toEqual([
      'clientName',
      'createdAt',
      'currency',
      'dueDate',
      'id',
      'invoiceNumber',
      'issueDate',
      'status',
      'total',
    ])
  })
})

describe('raising an invoice in one go', () => {
  it('saves the client, currency, dates, every line and every tax entry', async () => {
    const res = await call(invoices, {
      method: 'POST',
      token: account.token,
      body: invoiceBody(clientId, {
        currency: 'EUR',
        issueDate: '2026-04-01',
        dueDate: '2026-05-01',
        taxLabel: 'TVA',
        note: 'Thanks for your business',
        lineItems: [
          { description: 'Discovery', quantity: 3, unitRate: 400, taxRate: 0.2 },
          { description: 'Build', quantity: 10, unitRate: 500, taxRate: 0.2 },
          { description: 'Expenses', quantity: 1, unitRate: 123.45 },
        ],
        taxEntries: [
          { label: 'TVA', rate: 0.2 },
          { label: 'Eco levy', rate: 0.01 },
        ],
      }),
    })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('success')
    const saved = res.body.data
    expect(saved.client.id).toBe(clientId)
    expect(saved.currency).toBe('EUR')
    expect(saved.issueDate).toMatch(/^2026-04-01/)
    expect(saved.dueDate).toMatch(/^2026-05-01/)
    expect(saved.taxLabel).toBe('TVA')
    expect(saved.note).toBe('Thanks for your business')
    expect(saved.status).toBe('DRAFT')

    expect(saved.lineItems).toHaveLength(3)
    expect(saved.lineItems.map((l: { description: string }) => l.description)).toEqual([
      'Discovery',
      'Build',
      'Expenses',
    ])
    expect(saved.lineItems.map((l: { position: number }) => l.position)).toEqual([0, 1, 2])

    expect(saved.taxEntries).toHaveLength(2)
    expect(saved.taxEntries.map((t: { label: string }) => t.label)).toEqual(['TVA', 'Eco levy'])

    // And it is really in the database, lines and tax entries included.
    const rows = await prisma.invoice.findUniqueOrThrow({
      where: { id: saved.id },
      include: { lineItems: true, taxEntries: true },
    })
    expect(rows.lineItems).toHaveLength(3)
    expect(rows.taxEntries).toHaveLength(2)
  })

  it('appears in the invoice list straight afterwards', async () => {
    const created = await call(invoices, {
      method: 'POST',
      token: account.token,
      body: invoiceBody(clientId),
    })
    const list = await call(invoices, {
      method: 'GET',
      token: account.token,
      query: { size: '100' },
    })
    const ids = list.body.data.content.map((i: { id: number }) => i.id)
    expect(ids).toContain(created.body.data.id)
  })

  it('works out the money itself and ignores totals sent in the request', async () => {
    const res = await call(invoices, {
      method: 'POST',
      token: account.token,
      body: invoiceBody(clientId, {
        lineItems: [{ description: 'Work', quantity: 2, unitRate: 250, taxRate: 0.2 }],
        // A deliberately wrong set of figures in the request.
        subtotal: 1,
        taxTotal: 0,
        total: 1,
      }),
    })

    expectMoney(res.body.data.subtotal, '500.00')
    expectMoney(res.body.data.taxTotal, '100.00')
    expectMoney(res.body.data.total, '600.00')

    const row = await prisma.invoice.findUniqueOrThrow({ where: { id: res.body.data.id } })
    expectMoney(row.subtotal as never, '500.00')
    expectMoney(row.total as never, '600.00')
  })

  it('takes the next number in the account sequence when none is given', async () => {
    const first = await call(invoices, {
      method: 'POST',
      token: account.token,
      body: invoiceBody(clientId),
    })
    const second = await call(invoices, {
      method: 'POST',
      token: account.token,
      body: invoiceBody(clientId),
    })

    expect(first.body.data.invoiceNumber).toBe('INV-0001')
    expect(second.body.data.invoiceNumber).toBe('INV-0002')
    const after = await prisma.account.findUniqueOrThrow({ where: { id: account.id } })
    expect(after.invoiceNextNumber).toBe(3)
  })

  it('accepts a number typed on the new-invoice page', async () => {
    const res = await call(invoices, {
      method: 'POST',
      token: account.token,
      body: invoiceBody(clientId, { invoiceNumber: 'INV-9000' }),
    })
    expect(res.body.data.invoiceNumber).toBe('INV-9000')
  })
})

describe('the number the new-invoice and edit pages show', () => {
  it('the profile carries the prefix and the next number, which is how they show it', async () => {
    const res = await call(profile, { method: 'GET', token: account.token })
    expect(res.body.data.invoicePrefix).toBe('INV-')
    expect(res.body.data.invoiceNextNumber).toBe(1)
  })

  it('the number shown before saving is the number the invoice actually gets', async () => {
    const before = await call(profile, { method: 'GET', token: account.token })
    const shown = `${before.body.data.invoicePrefix}${String(
      before.body.data.invoiceNextNumber
    ).padStart(4, '0')}`

    const created = await call(invoices, {
      method: 'POST',
      token: account.token,
      body: invoiceBody(clientId),
    })

    expect(created.body.data.invoiceNumber).toBe(shown)
  })

  it('the edit page reads the number off the invoice it is editing', async () => {
    const created = await call(invoices, {
      method: 'POST',
      token: account.token,
      body: invoiceBody(clientId),
    })
    const opened = await call(invoice, {
      method: 'GET',
      token: account.token,
      query: { id: String(created.body.data.id) },
    })
    expect(opened.body.data.invoiceNumber).toBe(created.body.data.invoiceNumber)
  })
})

describe('editing an invoice', () => {
  let id: number

  beforeEach(async () => {
    const created = await call(invoices, {
      method: 'POST',
      token: account.token,
      body: invoiceBody(clientId, {
        taxEntries: [{ label: 'VAT', rate: 0.2 }],
      }),
    })
    id = created.body.data.id
  })

  async function change(body: Record<string, unknown>) {
    const res = await call(invoice, {
      method: 'PUT',
      token: account.token,
      query: { id: String(id) },
      body,
    })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    // And read it back the way the invoice page does, rather than trusting the reply.
    const reread = await call(invoice, {
      method: 'GET',
      token: account.token,
      query: { id: String(id) },
    })
    return reread.body.data
  }

  it('changing the invoice number saves and shows', async () => {
    expect((await change({ invoiceNumber: 'INV-4242' })).invoiceNumber).toBe('INV-4242')
  })

  it('changing the issue date saves and shows', async () => {
    expect((await change({ issueDate: '2026-06-15', dueDate: '2026-07-15' })).issueDate).toMatch(
      /^2026-06-15/
    )
  })

  it('changing the due date saves and shows', async () => {
    expect((await change({ dueDate: '2026-09-30' })).dueDate).toMatch(/^2026-09-30/)
  })

  it('changing the currency saves and shows', async () => {
    expect((await change({ currency: 'USD' })).currency).toBe('USD')
  })

  it('changing the tax label saves and shows', async () => {
    expect((await change({ taxLabel: 'Sales tax' })).taxLabel).toBe('Sales tax')
  })

  it('changing the note saves and shows', async () => {
    expect((await change({ note: 'Net 30, thank you' })).note).toBe('Net 30, thank you')
  })

  it('changing the tax entries saves, shows, and re-works the figures', async () => {
    const after = await change({
      taxEntries: [
        { label: 'VAT', rate: 0.2 },
        { label: 'Levy', rate: 0.05 },
      ],
    })
    expect(after.taxEntries).toHaveLength(2)
    expect(after.taxEntries[1].label).toBe('Levy')
    // 2 x 250 = 500 subtotal; 20% + 5% = 125
    expectMoney(after.subtotal, '500.00')
    expectMoney(after.taxTotal, '125.00')
    expectMoney(after.total, '625.00')
  })

  it('refuses an invoice number another invoice on this account already has', async () => {
    await call(invoices, {
      method: 'POST',
      token: account.token,
      body: invoiceBody(clientId, { invoiceNumber: 'INV-7777' }),
    })
    const res = await call(invoice, {
      method: 'PUT',
      token: account.token,
      query: { id: String(id) },
      body: { invoiceNumber: 'INV-7777' },
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.body.message).toMatch(/number/i)
  })

  it('adding a single line works and re-works the figures', async () => {
    const res = await call(lineItems, {
      method: 'POST',
      token: account.token,
      query: { id: String(id) },
      body: { description: 'Extra day', quantity: 1, unitRate: 100, taxRate: 0.2 },
    })

    expect(res.status).toBeGreaterThanOrEqual(200)
    expect(res.body.data.lineItems).toHaveLength(2)
    expectMoney(res.body.data.subtotal, '600.00')
    expectMoney(res.body.data.total, '720.00')
  })

  it('removing a single line works and re-works the figures', async () => {
    const added = await call(lineItems, {
      method: 'POST',
      token: account.token,
      query: { id: String(id) },
      body: { description: 'Extra day', quantity: 1, unitRate: 100, taxRate: 0.2 },
    })
    const newLineId = added.body.data.lineItems.find(
      (l: { description: string }) => l.description === 'Extra day'
    ).id

    const res = await call(lineItem, {
      method: 'DELETE',
      token: account.token,
      query: { id: String(id), itemId: String(newLineId) },
    })

    expect(res.status).toBe(200)
    expect(res.body.data.lineItems).toHaveLength(1)
    expectMoney(res.body.data.subtotal, '500.00')
    expectMoney(res.body.data.total, '600.00')
  })

  it('every change is visible together on the invoice page afterwards', async () => {
    await change({
      invoiceNumber: 'INV-5150',
      issueDate: '2026-06-01',
      dueDate: '2026-07-01',
      currency: 'USD',
      taxLabel: 'Sales tax',
      note: 'All of it at once',
      taxEntries: [{ label: 'Sales tax', rate: 0.08 }],
    })
    await call(lineItems, {
      method: 'POST',
      token: account.token,
      query: { id: String(id) },
      body: { description: 'Second thing', quantity: 1, unitRate: 100 },
    })

    const shown = (
      await call(invoice, { method: 'GET', token: account.token, query: { id: String(id) } })
    ).body.data

    expect(shown).toMatchObject({
      invoiceNumber: 'INV-5150',
      currency: 'USD',
      taxLabel: 'Sales tax',
      note: 'All of it at once',
    })
    expect(shown.issueDate).toMatch(/^2026-06-01/)
    expect(shown.dueDate).toMatch(/^2026-07-01/)
    expect(shown.taxEntries).toHaveLength(1)
    expect(shown.lineItems).toHaveLength(2)
  })
})

describe('the moves an invoice may make, over real records', () => {
  async function draft() {
    const created = await call(invoices, {
      method: 'POST',
      token: account.token,
      body: invoiceBody(clientId),
    })
    return created.body.data.id as number
  }

  it('a draft may be sent, and the moment is recorded and shown', async () => {
    const id = await draft()
    const before = Date.now()
    const res = await call(send, { method: 'POST', token: account.token, query: { id: String(id) } })

    expect(res.status).toBe(200)
    const shown = (
      await call(invoice, { method: 'GET', token: account.token, query: { id: String(id) } })
    ).body.data
    expect(shown.status).toBe('SENT')
    expect(shown.sentAt).toBeTruthy()
    expect(new Date(shown.sentAt).getTime()).toBeGreaterThanOrEqual(before - 1000)
  })

  it('a sent invoice may be marked paid, and the moment is recorded and shown', async () => {
    const id = await draft()
    await call(send, { method: 'POST', token: account.token, query: { id: String(id) } })
    await call(markPaid, { method: 'POST', token: account.token, query: { id: String(id) } })

    const shown = (
      await call(invoice, { method: 'GET', token: account.token, query: { id: String(id) } })
    ).body.data
    expect(shown.status).toBe('PAID')
    expect(shown.paidAt).toBeTruthy()
    expect(shown.sentAt).toBeTruthy()
  })

  it('a sent invoice may be voided, and the moment is recorded and shown', async () => {
    const id = await draft()
    await call(send, { method: 'POST', token: account.token, query: { id: String(id) } })
    await call(voidIt, { method: 'POST', token: account.token, query: { id: String(id) } })

    const shown = (
      await call(invoice, { method: 'GET', token: account.token, query: { id: String(id) } })
    ).body.data
    expect(shown.status).toBe('VOID')
    expect(shown.voidedAt).toBeTruthy()
  })

  it('a draft may be voided', async () => {
    const id = await draft()
    const res = await call(voidIt, {
      method: 'POST',
      token: account.token,
      query: { id: String(id) },
    })
    expect(res.status).toBe(200)
  })

  it('a draft may be deleted', async () => {
    const id = await draft()
    const res = await call(invoice, {
      method: 'DELETE',
      token: account.token,
      query: { id: String(id) },
    })
    expect(res.status).toBe(200)
    expect(await prisma.invoice.findUnique({ where: { id } })).toBeNull()
  })

  async function expectRefusedAndUnchanged(
    handler: Awaited<ReturnType<typeof handlerAt>>,
    id: number,
    method = 'POST'
  ) {
    const before = await prisma.invoice.findUniqueOrThrow({ where: { id } })
    const res = await call(handler, { method, token: account.token, query: { id: String(id) } })

    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.body.status).toBe('error')
    expect(res.body.message.length).toBeGreaterThan(10)

    const after = await prisma.invoice.findUniqueOrThrow({ where: { id } })
    expect(after.status).toBe(before.status)
    expect(after.sentAt).toEqual(before.sentAt)
    expect(after.paidAt).toEqual(before.paidAt)
    expect(after.voidedAt).toEqual(before.voidedAt)
    return res.body.message as string
  }

  it('marking a draft as paid is refused with a clear message, and changes nothing', async () => {
    const id = await draft()
    const message = await expectRefusedAndUnchanged(markPaid, id)
    expect(message).toMatch(/draft|sent/i)
  })

  it('sending an invoice that has already been sent is refused', async () => {
    const id = await draft()
    await call(send, { method: 'POST', token: account.token, query: { id: String(id) } })
    await expectRefusedAndUnchanged(send, id)
  })

  it('a paid invoice cannot move again', async () => {
    const id = await draft()
    await call(send, { method: 'POST', token: account.token, query: { id: String(id) } })
    await call(markPaid, { method: 'POST', token: account.token, query: { id: String(id) } })

    await expectRefusedAndUnchanged(send, id)
    await expectRefusedAndUnchanged(voidIt, id)
    await expectRefusedAndUnchanged(markPaid, id)
  })

  it('a voided invoice cannot move again', async () => {
    const id = await draft()
    await call(voidIt, { method: 'POST', token: account.token, query: { id: String(id) } })

    await expectRefusedAndUnchanged(send, id)
    await expectRefusedAndUnchanged(markPaid, id)
    await expectRefusedAndUnchanged(voidIt, id)
  })

  it.each(['SENT', 'PAID', 'VOID', 'OVERDUE'])(
    'a %s invoice cannot be deleted, and is still there afterwards',
    async (status) => {
      const existing = await makeInvoice(account.id, clientId, {
        invoiceNumber: `INV-${status}`,
        status,
      })
      const res = await call(invoice, {
        method: 'DELETE',
        token: account.token,
        query: { id: String(existing.id) },
      })
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.body.message).toMatch(/draft/i)
      expect(await prisma.invoice.findUnique({ where: { id: existing.id } })).not.toBeNull()
    }
  )
})

describe('refusing a bad invoice at the address itself', () => {
  it.each([
    ['no client', { clientId: undefined }],
    ['a due date before the issue date', { issueDate: '2026-03-31', dueDate: '2026-03-01' }],
    [
      'a negative quantity',
      { lineItems: [{ description: 'Work', quantity: -1, unitRate: 100 }] },
    ],
    ['a negative rate', { lineItems: [{ description: 'Work', quantity: 1, unitRate: -100 }] }],
    ['an unknown currency', { currency: 'ZZZ' }],
  ])('refuses %s politely, and saves nothing', async (_what, override) => {
    const res = await call(invoices, {
      method: 'POST',
      token: account.token,
      body: invoiceBody(clientId, override as Record<string, unknown>),
    })

    expect(res.status).toBe(400)
    expect(res.body.status).toBe('error')
    expect(res.body.data).toBeNull()
    expect(res.body.message.length).toBeGreaterThan(10)
    expect(res.body.message).not.toMatch(/ZodError|at Object\.|node_modules/)
    expect(await prisma.invoice.count()).toBe(0)
    // A refused invoice must not have burned a number either.
    const after = await prisma.account.findUniqueOrThrow({ where: { id: account.id } })
    expect(after.invoiceNextNumber).toBe(1)
  })
})
