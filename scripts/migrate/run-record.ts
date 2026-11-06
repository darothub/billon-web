import type { Prisma, PrismaClient } from '@prisma/client'
import type { Counts, MigrationReport } from './report'

const EMPTY: Counts = { accounts: 0, clients: 0, invoices: 0, lineItems: 0, taxEntries: 0 }

export async function startRun(target: PrismaClient) {
  return target.migrationRun.create({
    data: { outcome: 'RUNNING', sourceCounts: json(EMPTY), targetCounts: json(EMPTY) },
  })
}

export async function succeedRun(
  target: PrismaClient,
  id: number,
  report: MigrationReport
): Promise<void> {
  await target.migrationRun.update({
    where: { id },
    data: {
      finishedAt: new Date(),
      outcome: 'SUCCEEDED',
      sourceCounts: json(report.source),
      targetCounts: json(report.target),
    },
  })
}

export async function failRun(
  target: PrismaClient,
  id: number,
  error: unknown,
  report?: MigrationReport
): Promise<void> {
  const embedded = error instanceof Error && 'report' in error
    ? (error as Error & { report?: MigrationReport }).report
    : undefined
  const known = report ?? embedded
  await target.migrationRun.update({
    where: { id },
    data: {
      finishedAt: new Date(),
      outcome: 'FAILED',
      sourceCounts: json(known?.source ?? EMPTY),
      targetCounts: json(known?.target ?? EMPTY),
      errorMessage: safeError(error),
    },
  })
}

function json(counts: Counts): Prisma.InputJsonValue {
  return { ...counts }
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown migration failure'
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[database address removed]').slice(0, 1000)
}
