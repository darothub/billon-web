import { ReconciliationError, runMigration } from './index'

/**
 * The one command that carries the old data across and prints the counts on both
 * sides, so they can simply be compared.
 *
 *   LEGACY_DATABASE_URL=postgresql://... npm run migrate:legacy
 *
 * Point LEGACY_DATABASE_URL at a *restored copy* of the old database, never at the
 * live one. Running it a second time is harmless.
 */

async function main(): Promise<void> {
  const sourceUrl = process.env.LEGACY_DATABASE_URL ?? ''
  const targetUrl = process.env.DATABASE_URL ?? ''

  if (!sourceUrl || !targetUrl) {
    console.error(
      'The data move needs both databases:\n' +
        '  LEGACY_DATABASE_URL — a restored copy of the old Java database\n' +
        '  DATABASE_URL        — the new Billon database'
    )
    process.exitCode = 1
    return
  }

  if (/fly\.dev/.test(sourceUrl)) {
    console.error(
      'LEGACY_DATABASE_URL points at the live old service. Restore a copy and point at that.'
    )
    process.exitCode = 1
    return
  }

  const report = await runMigration({ sourceUrl, targetUrl })

  console.log('\nWhat came across\n')
  console.table(
    (['accounts', 'clients', 'invoices', 'lineItems', 'taxEntries'] as const).map((entity) => ({
      entity,
      before: report.source[entity],
      after: report.target[entity],
      matches: report.source[entity] === report.target[entity] ? 'yes' : 'NO',
    }))
  )

  const mismatched = (['accounts', 'clients', 'invoices', 'lineItems', 'taxEntries'] as const).filter(
    (entity) => report.source[entity] !== report.target[entity]
  )

  if (mismatched.length > 0) {
    console.error(`\nThese counts do not match: ${mismatched.join(', ')}`)
    process.exitCode = 1
    return
  }

  console.log(`\n${report.perAccount.length} accounts moved. Counts match on both sides.`)
}

main().catch((error) => {
  if (error instanceof ReconciliationError) {
    console.error('\nThe data move did not reconcile:')
    for (const difference of error.differences) console.error(`  - ${difference}`)
  } else {
    console.error('\nThe data move stopped:', error instanceof Error ? error.message : error)
  }
  process.exitCode = 1
})
