import type { DashboardSummary } from '@/lib/types'
import { prisma } from '@/server/db/client'
import { toNumber } from '@/server/util/format'

/**
 * The nine figures on the front page, for the signed-in account and nobody else.
 *
 * Totals are kept per currency rather than added together, because adding pounds to
 * euros produces a number that means nothing. An account with nothing at all gets
 * zeroes and empty totals rather than an error.
 */

interface StatusGroup {
  status: string
  currency: string
  _count: { _all: number }
  _sum: { total: unknown }
}

export async function readDashboardSummary(accountId: number): Promise<DashboardSummary> {
  const monthStart = startOfThisMonth()
  const monthEnd = startOfNextMonth()

  const [byStatus, paidThisMonth, totalClients, totalInvoices] = await Promise.all([
    prisma.invoice.groupBy({
      by: ['status', 'currency'],
      where: { accountId },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.invoice.groupBy({
      by: ['currency'],
      where: { accountId, status: 'PAID', paidAt: { gte: monthStart, lt: monthEnd } },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.client.count({ where: { accountId } }),
    prisma.invoice.count({ where: { accountId } }),
  ])

  const groups = byStatus as unknown as StatusGroup[]
  const drafts = groups.filter((row) => row.status === 'DRAFT')
  const outstanding = groups.filter((row) => row.status === 'SENT' || row.status === 'OVERDUE')
  const overdue = groups.filter((row) => row.status === 'OVERDUE')

  return {
    draftCount: countOf(drafts),
    outstandingCount: countOf(outstanding),
    outstandingTotals: totalsByCurrency(outstanding),
    overdueCount: countOf(overdue),
    overdueTotals: totalsByCurrency(overdue),
    paidThisMonthCount: countOf(paidThisMonth as unknown as StatusGroup[]),
    paidThisMonthTotals: totalsByCurrency(paidThisMonth as unknown as StatusGroup[]),
    totalClients,
    totalInvoices,
  }
}

function countOf(rows: StatusGroup[]): number {
  return rows.reduce((running, row) => running + row._count._all, 0)
}

function totalsByCurrency(rows: StatusGroup[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const row of rows) {
    const amount = toNumber(row._sum.total as { toString(): string } | null)
    totals[row.currency] = (totals[row.currency] ?? 0) + amount
  }
  return totals
}

function startOfThisMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

function startOfNextMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
}
