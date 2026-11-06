import { PrismaClient } from '@prisma/client'
import { LegacySource } from './source'
import { legacyTaxEntries } from './values'
import {
  pruneMigratedLines,
  replaceTaxEntries,
  upsertAccount,
  upsertClient,
  upsertInvoice,
  upsertLine,
} from './upsert'
import { buildReport, reconcile, type MigrationReport } from './report'
import { failRun, startRun, succeedRun } from './run-record'

export { ReconciliationError, type Counts, type MigrationReport } from './report'

export async function runMigration(options: {
  sourceUrl: string
  targetUrl: string
}): Promise<MigrationReport> {
  const source = new LegacySource(options.sourceUrl)
  const target = new PrismaClient({ datasources: { db: { url: options.targetUrl } } })
  const run = await startRun(target)
  let report: MigrationReport | undefined

  try {
    await source.open()
    const accounts = await source.accounts()
    const clients = await source.clients()
    const invoices = await source.invoices()
    const lines = await source.invoiceLines()

    const accountIds = new Map<number, number>()
    for (const row of accounts) accountIds.set(Number(row.id), await upsertAccount(target, row))

    const clientIds = new Map<number, number>()
    for (const row of clients) {
      const accountId = accountIds.get(Number(row.accountId))
      if (!accountId) throw new Error(`client ${row.id} has no migrated account`)
      clientIds.set(Number(row.id), await upsertClient(target, row, accountId))
    }

    const invoiceIds = new Map<number, number>()
    for (const row of invoices) {
      const accountId = accountIds.get(Number(row.accountId))
      const clientId = clientIds.get(Number(row.clientId))
      if (!accountId || !clientId) throw new Error(`invoice ${row.id} has an unmigrated owner`)
      const id = await upsertInvoice(target, row, accountId, clientId)
      invoiceIds.set(Number(row.id), id)
      await replaceTaxEntries(target, id, legacyTaxEntries(row))
    }

    for (const [legacyInvoiceId, invoiceId] of invoiceIds) {
      const invoiceLines = lines.filter((row) => Number(row.invoiceId) === legacyInvoiceId)
      await pruneMigratedLines(target, invoiceId, invoiceLines.map((row) => Number(row.id)))
      for (const row of invoiceLines) await upsertLine(target, row, invoiceId)
    }

    report = await buildReport(target, { accounts, clients, invoices, lines })
    reconcile(report)
    await succeedRun(target, run.id, report)
    await target.activityLog.create({
      data: {
        subject: 'migration',
        subjectId: run.id,
        action: 'succeeded',
        detail: `migrated ${report.source.accounts} accounts and ${report.source.invoices} invoices`,
      },
    })
    return report
  } catch (error) {
    await failRun(target, run.id, error, report)
    await target.activityLog.create({
      data: {
        subject: 'migration',
        subjectId: run.id,
        action: 'failed',
        detail: 'The legacy data move failed; see its MigrationRun.',
      },
    })
    throw error
  } finally {
    await source.close().catch(() => undefined)
    await target.$disconnect()
  }
}
