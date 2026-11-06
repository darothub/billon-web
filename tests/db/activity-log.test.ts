import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { prisma } from '../helpers/contract'
import { call, handlerAt } from '../helpers/http'
import {
  assertScratchDatabase,
  resetDatabase,
  makeAccount,
  makeClient,
  invoiceBody,
  type TestAccount,
} from '../helpers/db'

/**
 * 'Who changed this invoice, and when?' is a question that gets asked after the
 * fact, when it is too late to start recording. Each test below performs one action
 * and then goes and finds its entry.
 */

let invoices: Awaited<ReturnType<typeof handlerAt>>
let invoice: Awaited<ReturnType<typeof handlerAt>>
let send: Awaited<ReturnType<typeof handlerAt>>
let markPaid: Awaited<ReturnType<typeof handlerAt>>
let voidIt: Awaited<ReturnType<typeof handlerAt>>

let account: TestAccount
let clientId: number

beforeAll(async () => {
  assertScratchDatabase()
  invoices = await handlerAt('v1/invoices/index')
  invoice = await handlerAt('v1/invoices/[id]/index')
  send = await handlerAt('v1/invoices/[id]/send')
  markPaid = await handlerAt('v1/invoices/[id]/mark-paid')
  voidIt = await handlerAt('v1/invoices/[id]/void')
})

beforeEach(async () => {
  await resetDatabase()
  account = await makeAccount()
  clientId = (await makeClient(account.id)).id
})

async function draft(): Promise<number> {
  const created = await call(invoices, {
    method: 'POST',
    token: account.token,
    body: invoiceBody(clientId),
  })
  return created.body.data.id
}

async function entriesFor(invoiceId: number) {
  return prisma.activityLog.findMany({
    where: { subject: 'invoice', subjectId: invoiceId },
    orderBy: { occurredAt: 'asc' },
  })
}

describe('every meaningful change leaves a record', () => {
  it('sending an invoice leaves an entry saying who and when', async () => {
    const id = await draft()
    const before = new Date()
    await call(send, { method: 'POST', token: account.token, query: { id: String(id) } })

    const entries = await entriesFor(id)
    const sent = entries.find((e) => e.action === 'sent')
    expect(sent, 'no entry was written when the invoice was sent').toBeDefined()
    expect(sent!.accountId).toBe(account.id)
    expect(sent!.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 2000)
  })

  it('marking an invoice paid leaves an entry', async () => {
    const id = await draft()
    await call(send, { method: 'POST', token: account.token, query: { id: String(id) } })
    await call(markPaid, { method: 'POST', token: account.token, query: { id: String(id) } })

    const paid = (await entriesFor(id)).find((e) => e.action === 'paid')
    expect(paid).toBeDefined()
    expect(paid!.accountId).toBe(account.id)
  })

  it('voiding an invoice leaves an entry', async () => {
    const id = await draft()
    await call(voidIt, { method: 'POST', token: account.token, query: { id: String(id) } })

    const voided = (await entriesFor(id)).find((e) => e.action === 'voided')
    expect(voided).toBeDefined()
  })

  it('deleting an invoice leaves an entry, which outlives the invoice', async () => {
    const id = await draft()
    await call(invoice, { method: 'DELETE', token: account.token, query: { id: String(id) } })

    expect(await prisma.invoice.findUnique({ where: { id } })).toBeNull()
    const deleted = (await entriesFor(id)).find((e) => e.action === 'deleted')
    expect(deleted, 'the invoice is gone and so is any record of who removed it').toBeDefined()
    expect(deleted!.accountId).toBe(account.id)
  })

  it('the record answers who changed this invoice and when, in order', async () => {
    const id = await draft()
    await call(send, { method: 'POST', token: account.token, query: { id: String(id) } })
    await call(markPaid, { method: 'POST', token: account.token, query: { id: String(id) } })

    const entries = await entriesFor(id)
    expect(entries.map((e) => e.action)).toEqual(
      expect.arrayContaining(['sent', 'paid'])
    )
    for (const entry of entries) {
      expect(entry.accountId).toBe(account.id)
      expect(entry.occurredAt).toBeInstanceOf(Date)
      expect(entry.subject).toBe('invoice')
      expect(entry.subjectId).toBe(id)
    }
    const times = entries.map((e) => e.occurredAt.getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it('records what the status was before and after', async () => {
    const id = await draft()
    await call(send, { method: 'POST', token: account.token, query: { id: String(id) } })
    const sent = (await entriesFor(id)).find((e) => e.action === 'sent')
    expect(String(sent!.detail)).toMatch(/DRAFT/)
    expect(String(sent!.detail)).toMatch(/SENT/)
  })

  it('a refused move leaves the invoice alone and does not claim it happened', async () => {
    const id = await draft()
    await call(markPaid, { method: 'POST', token: account.token, query: { id: String(id) } })

    const paid = (await entriesFor(id)).find((e) => e.action === 'paid')
    expect(paid, 'a refused move was recorded as though it had happened').toBeUndefined()
  })

  it('the record belongs to the account that did it', async () => {
    const other = await makeAccount()
    const id = await draft()
    await call(send, { method: 'POST', token: account.token, query: { id: String(id) } })

    const entries = await entriesFor(id)
    expect(entries.every((e) => e.accountId === account.id)).toBe(true)
    expect(entries.some((e) => e.accountId === other.id)).toBe(false)
  })
})
