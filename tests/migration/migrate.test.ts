import { describe, it, expect, beforeAll } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../helpers/contract'
import { runMigration } from '../../scripts/migrate'

/**
 * The data move, rehearsed against a copy of the live data.
 *
 * This file is the rehearsal. It needs two databases:
 *
 *   LEGACY_DATABASE_URL  a restored copy of the old Java database — never the live one
 *   DATABASE_URL         the new, empty Billon database
 *
 * Running it IS the rehearsal the criteria ask for, and running it twice in a row —
 * which one of the tests below does deliberately — is the proof that a second run is
 * harmless.
 *
 * Assumed surface of scripts/migrate:
 *   runMigration({ sourceUrl, targetUrl }): Promise<{
 *     source: { accounts, clients, invoices, lineItems, taxEntries },
 *     target: { accounts, clients, invoices, lineItems, taxEntries },
 *     perAccount: Array<{ legacyId, email, clients, invoices, invoicePrefix, invoiceNextNumber, hasLogo }>,
 *   }>
 */

const sourceUrl = process.env.LEGACY_DATABASE_URL ?? ''
const targetUrl = process.env.DATABASE_URL ?? ''

type Report = Awaited<ReturnType<typeof runMigration>>
let firstRun: Report
let secondRun: Report

beforeAll(async () => {
  if (!sourceUrl || !targetUrl) {
    throw new Error(
      'The data move rehearsal needs both databases:\n' +
        '  LEGACY_DATABASE_URL — a restored copy of the old Java database\n' +
        '  DATABASE_URL        — the new Billon database\n' +
        'Restore the dated backup into a scratch database first; that restore is itself ' +
        'one of the things that has to be proved before the switchover.'
    )
  }
  if (/billon-api|fly\.dev/.test(sourceUrl)) {
    throw new Error(
      'LEGACY_DATABASE_URL points at the live Java database. Point it at a restored copy.'
    )
  }

  firstRun = await runMigration({ sourceUrl, targetUrl })
  secondRun = await runMigration({ sourceUrl, targetUrl })
}, 600_000)

describe('everything came across', () => {
  it('there was something to move in the first place', () => {
    expect(
      firstRun.source.accounts,
      'the copy of the old database is empty — this rehearsal proves nothing'
    ).toBeGreaterThan(0)
    expect(firstRun.source.invoices).toBeGreaterThan(0)
  })

  it('the totals on both sides match, entity by entity', () => {
    for (const entity of ['accounts', 'clients', 'invoices', 'lineItems', 'taxEntries'] as const) {
      expect(
        firstRun.target[entity],
        `${entity}: ${firstRun.source[entity]} in the old database, ${firstRun.target[entity]} in the new`
      ).toBe(firstRun.source[entity])
    }
  })

  it('for every account, the client and invoice counts match exactly', async () => {
    const mismatches: string[] = []
    for (const account of firstRun.perAccount) {
      const row = await prisma.account.findFirst({ where: { legacyId: account.legacyId } })
      if (!row) {
        mismatches.push(`${account.email}: did not arrive at all`)
        continue
      }
      const clients = await prisma.client.count({ where: { accountId: row.id } })
      const invoices = await prisma.invoice.count({ where: { accountId: row.id } })
      if (clients !== account.clients) {
        mismatches.push(`${account.email}: ${account.clients} clients before, ${clients} after`)
      }
      if (invoices !== account.invoices) {
        mismatches.push(`${account.email}: ${account.invoices} invoices before, ${invoices} after`)
      }
    }
    expect(mismatches, `accounts whose counts do not match:\n  ${mismatches.join('\n  ')}`).toEqual(
      []
    )
  })

  it("every account's invoice prefix and next-number counter came across at their current values", async () => {
    const mismatches: string[] = []
    for (const account of firstRun.perAccount) {
      const row = await prisma.account.findFirst({ where: { legacyId: account.legacyId } })
      if (!row) continue
      if (row.invoicePrefix !== account.invoicePrefix) {
        mismatches.push(
          `${account.email}: prefix '${account.invoicePrefix}' became '${row.invoicePrefix}'`
        )
      }
      if (row.invoiceNextNumber !== account.invoiceNextNumber) {
        mismatches.push(
          `${account.email}: next number ${account.invoiceNextNumber} became ${row.invoiceNextNumber}`
        )
      }
    }
    expect(mismatches, mismatches.join('\n  ')).toEqual([])
  })

  it('every account that had a logo before still has one afterwards', async () => {
    const hadLogo = firstRun.perAccount.filter((a) => a.hasLogo)
    expect(
      hadLogo.length,
      'no account in the copy had a logo, so this proves nothing — check the sample ' +
        'includes at least one account that had uploaded a logo'
    ).toBeGreaterThan(0)

    const lost: string[] = []
    for (const account of hadLogo) {
      const row = await prisma.account.findFirst({ where: { legacyId: account.legacyId } })
      if (!row?.logoImage || Buffer.from(row.logoImage as Uint8Array).length === 0) {
        lost.push(account.email)
      }
    }
    expect(lost, `these accounts lost their logo in the move: ${lost.join(', ')}`).toEqual([])
  })

  it('no invoice arrived without its lines', async () => {
    const orphans = await prisma.invoice.findMany({
      where: { lineItems: { none: {} } },
      select: { id: true, invoiceNumber: true },
    })
    expect(orphans.map((o) => o.invoiceNumber)).toEqual([])
  })

  it('every invoice belongs to a client owned by the same account', async () => {
    const wrong = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      'SELECT i.id FROM "Invoice" i JOIN "Client" c ON c.id = i."clientId" WHERE c."accountId" <> i."accountId"'
    )
    expect(wrong, 'the move crossed an invoice onto another account\'s client').toEqual([])
  })

  it('the move left a record of each step', async () => {
    const entries = await prisma.activityLog.findMany({ where: { action: 'moved' } })
    expect(entries.length, 'the data move recorded nothing about itself').toBeGreaterThan(0)
  })
})

describe('running the move a second time', () => {
  it('leaves the counts identical to the first run', () => {
    for (const entity of ['accounts', 'clients', 'invoices', 'lineItems', 'taxEntries'] as const) {
      expect(
        secondRun.target[entity],
        `${entity}: ${firstRun.target[entity]} after one run, ${secondRun.target[entity]} after two`
      ).toBe(firstRun.target[entity])
    }
  })

  it('creates no duplicates', async () => {
    const duplicateAccounts = await prisma.$queryRawUnsafe<Array<{ email: string }>>(
      'SELECT email FROM "Account" GROUP BY email HAVING COUNT(*) > 1'
    )
    expect(duplicateAccounts).toEqual([])

    const duplicateInvoices = await prisma.$queryRawUnsafe<Array<{ invoiceNumber: string }>>(
      'SELECT "invoiceNumber" FROM "Invoice" GROUP BY "accountId", "invoiceNumber" HAVING COUNT(*) > 1'
    )
    expect(duplicateInvoices).toEqual([])

    const duplicateLegacyIds = await prisma.$queryRawUnsafe<Array<{ legacyId: number }>>(
      'SELECT "legacyId" FROM "Invoice" WHERE "legacyId" IS NOT NULL GROUP BY "legacyId" HAVING COUNT(*) > 1'
    )
    expect(duplicateLegacyIds).toEqual([])
  })

  it('loses nothing', () => {
    expect(secondRun.target.invoices).toBe(secondRun.source.invoices)
    expect(secondRun.target.clients).toBe(secondRun.source.clients)
  })
})

describe('a hand-checked sample of invoices, one in each state', () => {
  /**
   * Capture this from the old system before the switch:
   *
   *   tests/fixtures/invoice-sample-before-the-move.json
   *   [
   *     { "legacyId": 812, "status": "DRAFT", "clientName": "Beta Ltd",
   *       "issueDate": "2026-01-05", "dueDate": "2026-02-05", "currency": "GBP",
   *       "subtotal": "500.00", "taxTotal": "100.00", "total": "600.00",
   *       "lineItems": [{ "description": "Discovery", "quantity": "2", "unitRate": "250.00" }],
   *       "taxEntries": [{ "label": "VAT", "rate": "0.20" }] },
   *     ... one each for SENT, PAID, VOID and OVERDUE
   *   ]
   */
  const fixture = join(__dirname, '..', 'fixtures', 'invoice-sample-before-the-move.json')

  it('the sample was captured, and covers all five states', () => {
    expect(
      existsSync(fixture),
      'tests/fixtures/invoice-sample-before-the-move.json does not exist. Capture at least ' +
        'one invoice in each of DRAFT, SENT, PAID, VOID and OVERDUE from the old system ' +
        'before it is switched off.'
    ).toBe(true)

    const sample = JSON.parse(readFileSync(fixture, 'utf8')) as Array<{ status: string }>
    const states = new Set(sample.map((i) => i.status))
    for (const state of ['DRAFT', 'SENT', 'PAID', 'VOID', 'OVERDUE']) {
      expect(states.has(state), `the sample has no ${state} invoice`).toBe(true)
    }
  })

  it('each sampled invoice looks exactly as it did before', async () => {
    if (!existsSync(fixture)) return expect.unreachable('capture the sample first')
    const sample = JSON.parse(readFileSync(fixture, 'utf8')) as Array<Record<string, any>>

    for (const before of sample) {
      const after = await prisma.invoice.findFirstOrThrow({
        where: { legacyId: before.legacyId },
        include: { client: true, lineItems: { orderBy: { position: 'asc' } }, taxEntries: true },
      })

      expect(after.status, `invoice ${before.legacyId} status`).toBe(before.status)
      expect(after.client.name, `invoice ${before.legacyId} client`).toBe(before.clientName)
      expect(after.issueDate.toISOString().slice(0, 10)).toBe(before.issueDate)
      expect(after.dueDate.toISOString().slice(0, 10)).toBe(before.dueDate)
      expect(after.currency).toBe(before.currency)
      expect(after.subtotal.toFixed(2)).toBe(before.subtotal)
      expect(after.taxTotal.toFixed(2)).toBe(before.taxTotal)
      expect(after.total.toFixed(2)).toBe(before.total)

      expect(after.lineItems).toHaveLength(before.lineItems.length)
      after.lineItems.forEach((line, i) => {
        expect(line.description).toBe(before.lineItems[i].description)
        expect(line.quantity.toString()).toBe(String(Number(before.lineItems[i].quantity)))
        expect(line.unitRate.toFixed(2)).toBe(before.lineItems[i].unitRate)
      })

      expect(after.taxEntries).toHaveLength((before.taxEntries ?? []).length)
      ;(before.taxEntries ?? []).forEach((entry: { label: string }, i: number) => {
        expect(after.taxEntries[i].label).toBe(entry.label)
      })
    }
  })
})

describe("a sample account's dashboard figures match what it showed before", () => {
  /**
   * tests/fixtures/dashboard-before-the-move.json
   *   { "capturedOn": "2026-09-10", "legacyAccountId": 12,
   *     "figures": { "draftCount": 4, "outstandingCount": 11, ... all nine ... } }
   *
   * Captured by opening that account's dashboard while the Java service is still up.
   */
  const fixture = join(__dirname, '..', 'fixtures', 'dashboard-before-the-move.json')

  it('the before-figures were captured while the old service was still running', () => {
    expect(
      existsSync(fixture),
      'tests/fixtures/dashboard-before-the-move.json does not exist. Once the Java ' +
        'service is off it is too late to capture these and the criterion cannot be met.'
    ).toBe(true)
  })

  it('all nine figures match', async () => {
    if (!existsSync(fixture)) return expect.unreachable('capture the figures first')
    const before = JSON.parse(readFileSync(fixture, 'utf8')) as {
      legacyAccountId: number
      figures: Record<string, unknown>
    }

    const { signToken } = await import('../helpers/contract')
    const { call, handlerAt } = await import('../helpers/http')
    const account = await prisma.account.findFirstOrThrow({
      where: { legacyId: before.legacyAccountId },
    })
    const summary = await handlerAt('v1/dashboard/summary')
    const after = (
      await call(summary, { method: 'GET', token: await signToken({ accountId: account.id }) })
    ).body.data

    for (const [name, value] of Object.entries(before.figures)) {
      expect(after[name], `${name}: was ${JSON.stringify(value)}, is now ${JSON.stringify(after[name])}`).toEqual(
        value
      )
    }
  })
})
