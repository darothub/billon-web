import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { prisma } from '../helpers/contract'
import { call, handlerAt } from '../helpers/http'
import {
  assertScratchDatabase,
  resetDatabase,
  makeAccount,
  makeClient,
  makeInvoice,
  type TestAccount,
} from '../helpers/db'

/**
 * One account putting another account's record number straight into the web
 * address. This is checked for every address that takes a record number — there is
 * no sampling here, because the one that gets missed is the one that leaks.
 *
 * The rule the design chose is that a store never sees an account id from a
 * request, so a forgotten check finds nothing rather than showing somebody else's
 * records. That is why 'not found' is an acceptable refusal alongside 'not allowed':
 * both refuse, and 'not found' additionally declines to confirm the record exists.
 */

let mine: TestAccount
let theirs: TestAccount
let theirClientId: number
let theirInvoiceId: number
let theirLineId: number

const handlers: Record<string, Awaited<ReturnType<typeof handlerAt>>> = {}

beforeAll(async () => {
  assertScratchDatabase()
  for (const [key, path] of [
    ['client', 'v1/clients/[id]'],
    ['invoice', 'v1/invoices/[id]/index'],
    ['send', 'v1/invoices/[id]/send'],
    ['markPaid', 'v1/invoices/[id]/mark-paid'],
    ['void', 'v1/invoices/[id]/void'],
    ['pdf', 'v1/invoices/[id]/pdf'],
    ['lineItems', 'v1/invoices/[id]/line-items/index'],
    ['lineItem', 'v1/invoices/[id]/line-items/[itemId]'],
    ['invoices', 'v1/invoices/index'],
  ] as const) {
    handlers[key] = await handlerAt(path)
  }
})

beforeEach(async () => {
  await resetDatabase()
  mine = await makeAccount({ email: 'mine@example.com' })
  theirs = await makeAccount({ email: 'theirs@example.com' })
  const theirClient = await makeClient(theirs.id, { name: 'Their Confidential Client' })
  theirClientId = theirClient.id
  const theirInvoice = await makeInvoice(theirs.id, theirClientId, {
    invoiceNumber: 'THEIRS-0001',
  })
  theirInvoiceId = theirInvoice.id
  theirLineId = theirInvoice.lineItems[0].id
})

function expectRefused(res: { status: number; body: any; buffer: Buffer }) {
  expect([401, 403, 404]).toContain(res.status)
  if (res.body) {
    expect(res.body.status).toBe('error')
    expect(res.body.data ?? null).toBeNull()
  }
  // Nothing of theirs may leak, not even in a message.
  const leaked = res.buffer.toString('utf8')
  expect(leaked).not.toContain('Their Confidential Client')
  expect(leaked).not.toContain('THEIRS-0001')
}

describe("asking for another account's client by putting their id in the address", () => {
  it('GET /clients/{id} is refused', async () => {
    expectRefused(
      await call(handlers.client, {
        method: 'GET',
        token: mine.token,
        query: { id: String(theirClientId) },
      })
    )
  })

  it('PUT /clients/{id} is refused, and changes nothing', async () => {
    expectRefused(
      await call(handlers.client, {
        method: 'PUT',
        token: mine.token,
        query: { id: String(theirClientId) },
        body: { name: 'Renamed By A Stranger', email: 'x@ex.example' },
      })
    )
    const row = await prisma.client.findUniqueOrThrow({ where: { id: theirClientId } })
    expect(row.name).toBe('Their Confidential Client')
  })

  it('DELETE /clients/{id} is refused, and deletes nothing', async () => {
    expectRefused(
      await call(handlers.client, {
        method: 'DELETE',
        token: mine.token,
        query: { id: String(theirClientId) },
      })
    )
    expect(await prisma.client.findUnique({ where: { id: theirClientId } })).not.toBeNull()
  })
})

describe("asking for another account's invoice by putting their id in the address", () => {
  it('GET /invoices/{id} is refused', async () => {
    expectRefused(
      await call(handlers.invoice, {
        method: 'GET',
        token: mine.token,
        query: { id: String(theirInvoiceId) },
      })
    )
  })

  it('PUT /invoices/{id} is refused, and changes nothing', async () => {
    expectRefused(
      await call(handlers.invoice, {
        method: 'PUT',
        token: mine.token,
        query: { id: String(theirInvoiceId) },
        body: { note: 'Written by a stranger' },
      })
    )
    const row = await prisma.invoice.findUniqueOrThrow({ where: { id: theirInvoiceId } })
    expect(row.note).toBeNull()
  })

  it('DELETE /invoices/{id} is refused, and deletes nothing', async () => {
    expectRefused(
      await call(handlers.invoice, {
        method: 'DELETE',
        token: mine.token,
        query: { id: String(theirInvoiceId) },
      })
    )
    expect(await prisma.invoice.findUnique({ where: { id: theirInvoiceId } })).not.toBeNull()
  })

  it.each([
    ['send', 'sentAt'],
    ['markPaid', 'paidAt'],
    ['void', 'voidedAt'],
  ])('POST /invoices/{id}/%s is refused, and leaves the invoice alone', async (key, stamp) => {
    expectRefused(
      await call(handlers[key], {
        method: 'POST',
        token: mine.token,
        query: { id: String(theirInvoiceId) },
      })
    )
    const row = await prisma.invoice.findUniqueOrThrow({ where: { id: theirInvoiceId } })
    expect(row.status).toBe('DRAFT')
    expect((row as unknown as Record<string, unknown>)[stamp]).toBeNull()
  })

  it('GET /invoices/{id}/pdf is refused, and hands back no document', async () => {
    const res = await call(handlers.pdf, {
      method: 'GET',
      token: mine.token,
      query: { id: String(theirInvoiceId) },
    })
    expect([401, 403, 404]).toContain(res.status)
    expect(res.buffer.subarray(0, 4).toString()).not.toBe('%PDF')
  })

  it('POST /invoices/{id}/line-items is refused, and adds no line', async () => {
    expectRefused(
      await call(handlers.lineItems, {
        method: 'POST',
        token: mine.token,
        query: { id: String(theirInvoiceId) },
        body: { description: 'Planted line', quantity: 1, unitRate: 1 },
      })
    )
    const lines = await prisma.invoiceLine.findMany({ where: { invoiceId: theirInvoiceId } })
    expect(lines).toHaveLength(1)
  })

  it('DELETE /invoices/{id}/line-items/{itemId} is refused, and removes no line', async () => {
    expectRefused(
      await call(handlers.lineItem, {
        method: 'DELETE',
        token: mine.token,
        query: { id: String(theirInvoiceId), itemId: String(theirLineId) },
      })
    )
    expect(await prisma.invoiceLine.findUnique({ where: { id: theirLineId } })).not.toBeNull()
  })
})

describe('one account cannot borrow another account\'s client for its own invoice', () => {
  it('raising an invoice against somebody else\'s client is refused', async () => {
    const res = await call(handlers.invoices, {
      method: 'POST',
      token: mine.token,
      body: {
        clientId: theirClientId,
        currency: 'GBP',
        issueDate: '2026-03-01',
        dueDate: '2026-03-31',
        lineItems: [{ description: 'Work', quantity: 1, unitRate: 10 }],
      },
    })

    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.body.status).toBe('error')
    expect(await prisma.invoice.count({ where: { accountId: mine.id } })).toBe(0)
  })
})

describe('the list addresses do not need an id to leak', () => {
  it('listing invoices filtered by another account\'s client returns nothing of theirs', async () => {
    const res = await call(handlers.invoices, {
      method: 'GET',
      token: mine.token,
      query: { clientId: String(theirClientId), size: '100' },
    })
    expect(res.status).toBe(200)
    expect(res.body.data.content).toEqual([])
    expect(res.body.data.totalElements).toBe(0)
  })
})
