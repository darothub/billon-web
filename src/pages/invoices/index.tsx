import Head from 'next/head'
import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { InvoiceTable } from '@/components/invoices/InvoiceTable'
import api from '@/lib/api'
import type { ApiResponse, PageResponse, InvoiceSummary, InvoiceStatus, ClientSummary } from '@/lib/types'

const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: 'All statuses', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Sent', value: 'SENT' },
  { label: 'Overdue', value: 'OVERDUE' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Void', value: 'VOID' },
]

const SORT_OPTIONS = [
  { label: 'Newest first', value: 'createdAt,desc' },
  { label: 'Oldest first', value: 'createdAt,asc' },
  { label: 'Due date', value: 'dueDate,asc' },
]

export default function InvoicesPage() {
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState<string>('')
  const [clientId, setClientId] = useState<string>('')
  const [sort, setSort] = useState('createdAt,desc')

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', { page, status, clientId, sort }],
    queryFn: () =>
      api.get<ApiResponse<PageResponse<InvoiceSummary>>>('/invoices', {
        params: {
          page,
          size: 20,
          status: status || undefined,
          clientId: clientId || undefined,
          sort,
        },
      }).then((res) => res.data.data!),
    retry: false,
    placeholderData: (prev) => prev,
  })

  const { data: clientsPage } = useQuery({
    queryKey: ['clients', { size: 100 }],
    queryFn: () =>
      api.get<ApiResponse<PageResponse<ClientSummary>>>('/clients', { params: { size: 100, sort: 'name,asc' } })
        .then((res) => res.data.data!),
    retry: false,
  })

  const handleStatusChange = (v: string) => { setStatus(v); setPage(0) }
  const handleClientChange = (v: string) => { setClientId(v); setPage(0) }
  const handleSortChange = (v: string) => { setSort(v); setPage(0) }

  return (
    <AppShell>
      <Head><title>Invoices — Billon</title></Head>
      <div className="max-w-5xl">
        <PageHeader
          title="Invoices"
          action={
            <Link
              href="/invoices/new"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md"
            >
              + New Invoice
            </Link>
          }
        />

        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            value={clientId}
            onChange={(e) => handleClientChange(e.target.value)}
            className="border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="">All clients</option>
            {clientsPage?.content.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => handleSortChange(e.target.value)}
            className="border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
          <InvoiceTable invoices={data?.content} isLoading={isLoading} />
        </div>

        <Pagination page={page} totalPages={data?.totalPages ?? 0} onPageChange={setPage} />
      </div>
    </AppShell>
  )
}
