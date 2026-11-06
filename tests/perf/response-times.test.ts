import { describe, it, expect, beforeAll } from 'vitest'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
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
 * Response times, before and after.
 *
 * Work that used to happen on an always-running Java service now happens in
 * handlers that may have to start up first, so 'it feels slower' needs to become a
 * measurement. This file measures the four screens and the PDF against a realistically
 * sized account, writes the numbers down, and compares them with what was recorded
 * before the move.
 *
 * These are budgets measured in-process against a local database, which is faster
 * than the live system. They catch an accidental quadratic query — a client list
 * that counts invoices one client at a time, say — long before anybody deploys it.
 * The live figures are the ones the criterion actually asks for; they belong in
 * docs/MIGRATION.md and are checked by the release gate.
 */

const BEFORE = join(__dirname, '..', 'fixtures', 'response-times-before-the-move.json')
const AFTER = join(__dirname, '..', 'fixtures', 'response-times-after-the-move.json')

/** Generous against a local database; the live budgets are 1s, and 3s for a PDF. */
const BUDGET_MS = { dashboard: 400, clients: 400, invoices: 400, invoice: 300, pdf: 1500 }

let account: TestAccount
const measured: Record<string, number> = {}

beforeAll(async () => {
  assertScratchDatabase()
  await resetDatabase()
  account = await makeAccount()

  // A busier account than a toy one: 40 clients, 200 invoices.
  const clientIds: number[] = []
  for (let i = 0; i < 40; i += 1) {
    clientIds.push((await makeClient(account.id, { name: `Client ${String(i).padStart(3, '0')}` })).id)
  }
  const statuses = ['DRAFT', 'SENT', 'PAID', 'VOID', 'OVERDUE']
  for (let i = 0; i < 200; i += 1) {
    await makeInvoice(account.id, clientIds[i % clientIds.length], {
      invoiceNumber: `INV-${String(i + 1).padStart(4, '0')}`,
      status: statuses[i % statuses.length],
    })
  }
}, 120_000)

async function time(name: string, run: () => Promise<{ status: number; durationMs: number }>) {
  await run() // warm up, so the first-call cost of loading the module is not the measurement
  const runs: number[] = []
  for (let i = 0; i < 5; i += 1) {
    const res = await run()
    expect(res.status).toBeLessThan(400)
    runs.push(res.durationMs)
  }
  const median = runs.sort((a, b) => a - b)[2]
  measured[name] = Math.round(median)
  return median
}

describe('how long each screen takes to answer', () => {
  it('the dashboard', async () => {
    const summary = await handlerAt('v1/dashboard/summary')
    const median = await time('dashboard', () =>
      call(summary, { method: 'GET', token: account.token })
    )
    expect(median, `dashboard took ${Math.round(median)}ms`).toBeLessThan(BUDGET_MS.dashboard)
  })

  it('the client list, with its per-client invoice counts', async () => {
    const clients = await handlerAt('v1/clients/index')
    const median = await time('clients', () =>
      call(clients, { method: 'GET', token: account.token, query: { page: '0', size: '20' } })
    )
    expect(
      median,
      `the client list took ${Math.round(median)}ms — a per-client count query would do this`
    ).toBeLessThan(BUDGET_MS.clients)
  })

  it('the invoice list', async () => {
    const invoices = await handlerAt('v1/invoices/index')
    const median = await time('invoices', () =>
      call(invoices, {
        method: 'GET',
        token: account.token,
        query: { page: '0', size: '20', sort: 'createdAt,desc' },
      })
    )
    expect(median, `the invoice list took ${Math.round(median)}ms`).toBeLessThan(BUDGET_MS.invoices)
  })

  it('a single invoice', async () => {
    const invoice = await handlerAt('v1/invoices/[id]/index')
    const { prisma } = await import('../helpers/contract')
    const one = await prisma.invoice.findFirstOrThrow({ where: { accountId: account.id } })
    const median = await time('invoice', () =>
      call(invoice, { method: 'GET', token: account.token, query: { id: String(one.id) } })
    )
    expect(median, `one invoice took ${Math.round(median)}ms`).toBeLessThan(BUDGET_MS.invoice)
  })

  it('a PDF', async () => {
    const pdf = await handlerAt('v1/invoices/[id]/pdf')
    const { prisma } = await import('../helpers/contract')
    const one = await prisma.invoice.findFirstOrThrow({ where: { accountId: account.id } })
    const median = await time('pdf', () =>
      call(pdf, { method: 'GET', token: account.token, query: { id: String(one.id) } })
    )
    expect(median, `a PDF took ${Math.round(median)}ms`).toBeLessThan(BUDGET_MS.pdf)
  })

  it('writes the figures down so they can be compared with before', () => {
    mkdirSync(dirname(AFTER), { recursive: true })
    writeFileSync(
      AFTER,
      JSON.stringify(
        { measuredOn: new Date().toISOString().slice(0, 10), where: 'local', medianMs: measured },
        null,
        2
      ) + '\n'
    )
    expect(Object.keys(measured).sort()).toEqual([
      'clients',
      'dashboard',
      'invoice',
      'invoices',
      'pdf',
    ])
  })
})

describe('compared with the same four screens before the move', () => {
  it('the before-figures were measured while the Java service was still answering', () => {
    expect(
      existsSync(BEFORE),
      'tests/fixtures/response-times-before-the-move.json does not exist. Measure the ' +
        'dashboard, the client list, the invoice list and one invoice against the Java ' +
        'service before it is switched off — afterwards there is nothing to compare to.'
    ).toBe(true)
  })

  it('nothing got dramatically slower', () => {
    if (!existsSync(BEFORE)) return expect.unreachable('measure the before-figures first')
    const before = JSON.parse(readFileSync(BEFORE, 'utf8')) as { medianMs: Record<string, number> }

    const worse: string[] = []
    for (const [name, after] of Object.entries(measured)) {
      const was = before.medianMs[name]
      if (was === undefined) continue
      // Doubling is the point at which somebody would notice and it needs explaining.
      if (after > was * 2 && after - was > 100) {
        worse.push(`${name}: ${was}ms before, ${after}ms after`)
      }
    }
    expect(worse, `these got materially slower:\n  ${worse.join('\n  ')}`).toEqual([])
  })
})
