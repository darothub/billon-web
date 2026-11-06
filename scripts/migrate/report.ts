import type { PrismaClient } from '@prisma/client'
import type { Row } from './source'
import { legacyTaxEntries } from './values'

export interface Counts {
  accounts: number
  clients: number
  invoices: number
  lineItems: number
  taxEntries: number
}

interface AccountValues {
  legacyId: number
  email: string
  clients: number
  invoices: number
  invoicePrefix: string
  invoiceNextNumber: number
  hasLogo: boolean
}

export interface AccountReport extends AccountValues {
  target: AccountValues | null
}

export interface MigrationReport {
  source: Counts
  target: Counts
  perAccount: AccountReport[]
}

interface Rows {
  accounts: Row[]
  clients: Row[]
  invoices: Row[]
  lines: Row[]
}

export async function buildReport(target: PrismaClient, rows: Rows): Promise<MigrationReport> {
  const source: Counts = {
    accounts: rows.accounts.length,
    clients: rows.clients.length,
    invoices: rows.invoices.length,
    lineItems: rows.lines.length,
    taxEntries: rows.invoices.reduce((sum, row) => sum + legacyTaxEntries(row).length, 0),
  }
  const [accounts, clients, invoices, lineItems, taxEntries] = await Promise.all([
    target.account.count({ where: { legacyId: { not: null } } }),
    target.client.count({ where: { legacyId: { not: null } } }),
    target.invoice.count({ where: { legacyId: { not: null } } }),
    target.invoiceLine.count({ where: { legacyId: { not: null } } }),
    target.invoiceTaxEntry.count({ where: { invoice: { legacyId: { not: null } } } }),
  ])
  const perAccount = await Promise.all(rows.accounts.map(async (row) => {
    const expected = sourceAccount(row, rows)
    const account = await target.account.findUnique({ where: { legacyId: expected.legacyId } })
    if (!account) return { ...expected, target: null }
    const [clientCount, invoiceCount] = await Promise.all([
      target.client.count({ where: { accountId: account.id, legacyId: { not: null } } }),
      target.invoice.count({ where: { accountId: account.id, legacyId: { not: null } } }),
    ])
    return {
      ...expected,
      target: {
        legacyId: expected.legacyId,
        email: account.email,
        clients: clientCount,
        invoices: invoiceCount,
        invoicePrefix: account.invoicePrefix,
        invoiceNextNumber: account.invoiceNextNumber,
        hasLogo: Boolean(account.logoImage),
      },
    }
  }))
  return { source, target: { accounts, clients, invoices, lineItems, taxEntries }, perAccount }
}

function sourceAccount(account: Row, rows: Rows): AccountValues {
  const legacyId = Number(account.id)
  return {
    legacyId,
    email: String(account.email ?? '').toLowerCase(),
    clients: rows.clients.filter((row) => Number(row.accountId) === legacyId).length,
    invoices: rows.invoices.filter((row) => Number(row.accountId) === legacyId).length,
    invoicePrefix: account.invoicePrefix === null ? 'INV' : String(account.invoicePrefix),
    invoiceNextNumber: Number(account.invoiceNextNumber ?? 1),
    hasLogo: Boolean(account.logoUrl),
  }
}

export class ReconciliationError extends Error {
  constructor(readonly report: MigrationReport, readonly differences: string[]) {
    super(`Legacy data reconciliation failed: ${differences.join('; ')}`)
    this.name = 'ReconciliationError'
  }
}

export function reconcile(report: MigrationReport): void {
  const differences: string[] = []
  for (const key of Object.keys(report.source) as Array<keyof Counts>) {
    if (report.source[key] !== report.target[key]) {
      differences.push(`${key} ${report.source[key]} source/${report.target[key]} target`)
    }
  }
  for (const account of report.perAccount) {
    if (!account.target) differences.push(`account ${account.legacyId} missing`)
    else for (const field of ['email', 'clients', 'invoices', 'invoicePrefix', 'invoiceNextNumber', 'hasLogo'] as const) {
      if (account[field] !== account.target[field]) differences.push(`account ${account.legacyId} ${field}`)
    }
  }
  if (differences.length) throw new ReconciliationError(report, differences)
}
