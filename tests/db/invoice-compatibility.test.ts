import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../helpers/contract'
import {
  invoiceBody,
  makeAccount,
  makeClient,
  makeInvoice,
  resetDatabase,
} from '../helpers/db'
import { call, handlerAt } from '../helpers/http'

let invoices: Awaited<ReturnType<typeof handlerAt>>
let invoice: Awaited<ReturnType<typeof handlerAt>>
let lines: Awaited<ReturnType<typeof handlerAt>>
let line: Awaited<ReturnType<typeof handlerAt>>

beforeAll(async () => {
  invoices = await handlerAt('v1/invoices/index')
  invoice = await handlerAt('v1/invoices/[id]/index')
  lines = await handlerAt('v1/invoices/[id]/line-items/index')
  line = await handlerAt('v1/invoices/[id]/line-items/[itemId]')
})

beforeEach(resetDatabase)

describe('screen-shaped invoice numbering', () => {
  it('uses prefix plus padding directly and consumes a sequence for a custom number', async () => {
    const account = await makeAccount({ invoicePrefix: 'AC-', invoiceNextNumber: 12 })
    const client = await makeClient(account.id)
    const custom = await call(invoices, {
      method: 'POST',
      token: account.token,
      body: invoiceBody(client.id, { invoiceNumber: 'SPECIAL-1' }),
    })
    const automatic = await call(invoices, {
      method: 'POST',
      token: account.token,
      body: invoiceBody(client.id),
    })

    expect(custom.body.data.invoiceNumber).toBe('SPECIAL-1')
    expect(automatic.body.data.invoiceNumber).toBe('AC-0013')
    expect((await prisma.account.findUniqueOrThrow({ where: { id: account.id } })).invoiceNextNumber)
      .toBe(14)
  })
})

describe('issued invoices are immutable', () => {
  it.each(['SENT', 'OVERDUE', 'PAID', 'VOID'])('%s rejects header, tax, and line changes', async (status) => {
    const account = await makeAccount()
    const client = await makeClient(account.id)
    const saved = await makeInvoice(account.id, client.id, { status })
    const before = await prisma.invoice.findUniqueOrThrow({
      where: { id: saved.id },
      include: { lineItems: true, taxEntries: true },
    })

    const update = await call(invoice, {
      method: 'PUT',
      token: account.token,
      query: { id: String(saved.id) },
      body: {
        note: 'changed',
        currency: 'EUR',
        taxEntries: [{ label: 'Tax', rate: 0.5 }],
      },
    })
    const add = await call(lines, {
      method: 'POST',
      token: account.token,
      query: { id: String(saved.id) },
      body: { description: 'new line', quantity: 1, unitRate: 1 },
    })
    const remove = await call(line, {
      method: 'DELETE',
      token: account.token,
      query: { id: String(saved.id), itemId: String(saved.lineItems[0].id) },
    })

    expect([update.status, add.status, remove.status]).toEqual([400, 400, 400])
    const after = await prisma.invoice.findUniqueOrThrow({
      where: { id: saved.id },
      include: { lineItems: true, taxEntries: true },
    })
    expect(after).toEqual(before)
  })

  it('checks date order even when the edit request supplies only one date', async () => {
    const account = await makeAccount()
    const client = await makeClient(account.id)
    const saved = await makeInvoice(account.id, client.id, {
      issueDate: '2026-03-01',
      dueDate: '2026-03-31',
    })
    const response = await call(invoice, {
      method: 'PUT',
      token: account.token,
      query: { id: String(saved.id) },
      body: { dueDate: '2026-02-28' },
    })
    expect(response.status).toBe(400)
  })
})
