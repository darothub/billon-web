import Head from 'next/head'
import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard } from '@/components/dashboard/StatCard'
import { RecentInvoicesTable } from '@/components/dashboard/RecentInvoicesTable'
import api from '@/lib/api'
import type { ApiResponse, DashboardSummary, PageResponse, InvoiceSummary } from '@/lib/types'

export default function DashboardPage() {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () =>
      api.get<ApiResponse<DashboardSummary>>('/dashboard/summary').then((res) => res.data.data!),
    retry: false,
  })

  const { data: recentPage, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices', { page: 0, size: 5, sort: 'createdAt,desc' }],
    queryFn: () =>
      api.get<ApiResponse<PageResponse<InvoiceSummary>>>('/invoices', {
        params: { page: 0, size: 5, sort: 'createdAt,desc' },
      }).then((res) => res.data.data!),
    retry: false,
  })

  return (
    <AppShell>
      <Head><title>Dashboard — Billon</title></Head>

      <div className="space-y-8 max-w-5xl">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>

        {summaryLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-slate-200 p-5 h-28 animate-pulse" />
            ))}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Draft"
              count={summary.draftCount}
            />
            <StatCard
              title="Outstanding"
              count={summary.outstandingCount}
              totals={summary.outstandingTotals}
              colorClass="text-blue-700"
            />
            <StatCard
              title="Overdue"
              count={summary.overdueCount}
              totals={summary.overdueTotals}
              colorClass="text-red-700"
            />
            <StatCard
              title="Paid this month"
              count={summary.paidThisMonthCount}
              totals={summary.paidThisMonthTotals}
              colorClass="text-green-700"
            />
          </div>
        ) : null}

        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Recent Invoices</h2>
          <RecentInvoicesTable
            invoices={recentPage?.content}
            isLoading={invoicesLoading}
          />
        </div>
      </div>
    </AppShell>
  )
}
