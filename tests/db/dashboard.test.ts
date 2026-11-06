import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
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
 * The nine figures on the front page.
 *
 * This file builds a known account and checks every figure against arithmetic anyone
 * can do by hand, so a change to the counting has to break something here.
 */

let summary: Awaited<ReturnType<typeof handlerAt>>
let account: TestAccount

beforeAll(async () => {
  assertScratchDatabase()
  summary = await handlerAt('v1/dashboard/summary')
})

beforeEach(async () => {
  await resetDatabase()
  account = await makeAccount()
})

describe('the dashboard figures for a known account', () => {
  let figures: any

  beforeEach(async () => {
    const beta = await makeClient(account.id, { name: 'Beta Ltd' })
    const gamma = await makeClient(account.id, { name: 'Gamma Ltd' })
    const thisMonth = new Date()
    const paidDate = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 2)
    const lastMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1, 15)

    // 2 drafts
    await makeInvoice(account.id, beta.id, { invoiceNumber: 'D1', status: 'DRAFT', total: '10.00' })
    await makeInvoice(account.id, beta.id, { invoiceNumber: 'D2', status: 'DRAFT', total: '20.00' })
    // 3 sent, two currencies (outstanding also includes the overdue ones below, as the old service did)
    await makeInvoice(account.id, beta.id, {
      invoiceNumber: 'S1',
      status: 'SENT',
      currency: 'GBP',
      total: '100.00',
    })
    await makeInvoice(account.id, gamma.id, {
      invoiceNumber: 'S2',
      status: 'SENT',
      currency: 'GBP',
      total: '250.50',
    })
    await makeInvoice(account.id, gamma.id, {
      invoiceNumber: 'S3',
      status: 'SENT',
      currency: 'EUR',
      total: '75.25',
    })
    // 2 overdue, two currencies
    await makeInvoice(account.id, beta.id, {
      invoiceNumber: 'O1',
      status: 'OVERDUE',
      currency: 'GBP',
      total: '500.00',
    })
    await makeInvoice(account.id, beta.id, {
      invoiceNumber: 'O2',
      status: 'OVERDUE',
      currency: 'USD',
      total: '30.00',
    })
    // 2 paid this month, 1 paid last month
    await makeInvoice(account.id, gamma.id, {
      invoiceNumber: 'P1',
      status: 'PAID',
      currency: 'GBP',
      total: '1000.00',
      paidAt: paidDate,
    })
    await makeInvoice(account.id, gamma.id, {
      invoiceNumber: 'P2',
      status: 'PAID',
      currency: 'EUR',
      total: '11.11',
      paidAt: paidDate,
    })
    await makeInvoice(account.id, gamma.id, {
      invoiceNumber: 'P0',
      status: 'PAID',
      currency: 'GBP',
      total: '9999.00',
      paidAt: lastMonth,
    })
    // A void one, which should count towards total invoices and nothing else.
    await makeInvoice(account.id, beta.id, {
      invoiceNumber: 'V1',
      status: 'VOID',
      total: '77.00',
    })

    figures = (await call(summary, { method: 'GET', token: account.token })).body.data
  })

  it('counts the drafts', () => {
    expect(figures.draftCount).toBe(2)
  })

  it('counts what is outstanding (sent or overdue) and totals it per currency', () => {
    expect(figures.outstandingCount).toBe(5)
    expect(Number(figures.outstandingTotals.GBP)).toBeCloseTo(850.5, 2)
    expect(Number(figures.outstandingTotals.EUR)).toBeCloseTo(75.25, 2)
    expect(Number(figures.outstandingTotals.USD)).toBeCloseTo(30, 2)
  })

  it('counts what is overdue and totals it per currency', () => {
    expect(figures.overdueCount).toBe(2)
    expect(Number(figures.overdueTotals.GBP)).toBeCloseTo(500, 2)
    expect(Number(figures.overdueTotals.USD)).toBeCloseTo(30, 2)
  })

  it('counts what was paid this month, and leaves last month out of it', () => {
    expect(figures.paidThisMonthCount).toBe(2)
    expect(Number(figures.paidThisMonthTotals.GBP)).toBeCloseTo(1000, 2)
    expect(Number(figures.paidThisMonthTotals.EUR)).toBeCloseTo(11.11, 2)
    expect(Number(figures.paidThisMonthTotals.GBP)).not.toBeCloseTo(10999, 2)
  })

  it('counts the clients and the invoices', () => {
    expect(figures.totalClients).toBe(2)
    expect(figures.totalInvoices).toBe(11)
  })

  it('carries all nine figures and no others', () => {
    expect(Object.keys(figures).sort()).toEqual([
      'draftCount',
      'outstandingCount',
      'outstandingTotals',
      'overdueCount',
      'overdueTotals',
      'paidThisMonthCount',
      'paidThisMonthTotals',
      'totalClients',
      'totalInvoices',
    ])
  })

  it("counts only the signed-in account, never everybody's", async () => {
    const other = await makeAccount()
    const theirClient = await makeClient(other.id)
    await makeInvoice(other.id, theirClient.id, { invoiceNumber: 'X1', status: 'DRAFT' })

    const mine = (await call(summary, { method: 'GET', token: account.token })).body.data
    expect(mine.draftCount).toBe(2)
    expect(mine.totalClients).toBe(2)

    const yours = (await call(summary, { method: 'GET', token: other.token })).body.data
    expect(yours.draftCount).toBe(1)
    expect(yours.totalClients).toBe(1)
    expect(yours.totalInvoices).toBe(1)
  })

  it('an account with nothing at all gets zeroes rather than an error', async () => {
    const fresh = await makeAccount()
    const res = await call(summary, { method: 'GET', token: fresh.token })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      draftCount: 0,
      outstandingCount: 0,
      overdueCount: 0,
      paidThisMonthCount: 0,
      totalClients: 0,
      totalInvoices: 0,
    })
    expect(res.body.data.outstandingTotals).toEqual({})
  })
})

// The other half of this promise — that a real account's nine figures match what its
// dashboard showed before the move — needs a database carrying real migrated data, so
// it lives in tests/migration/parity.test.ts rather than here, where every test starts
// from an empty Billon.
