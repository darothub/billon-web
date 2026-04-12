import Head from 'next/head'
import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { ClientInfoCard } from '@/components/clients/ClientInfoCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import api from '@/lib/api'
import type { ApiResponse, ClientDetail, InvoiceSummary, PageResponse, UpdateClientRequest } from '@/lib/types'
import { formatDate, formatMoney } from '@/lib/utils'

export default function ClientDetailPage() {
  const router = useRouter()
  const { id } = router.query as { id: string }
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['clients', id],
    queryFn: () =>
      api.get<ApiResponse<ClientDetail>>(`/clients/${id}`).then((res) => res.data.data!),
    enabled: !!id,
    retry: false,
  })

  const { data: invoicesPage, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices', { clientId: id }],
    queryFn: () =>
      api.get<ApiResponse<PageResponse<InvoiceSummary>>>('/invoices', {
        params: { clientId: id, size: 20, sort: 'createdAt,desc' },
      }).then((res) => res.data.data!),
    enabled: !!id,
    retry: false,
  })

  const updateMutation = useMutation({
    mutationFn: (body: UpdateClientRequest) =>
      api.put<ApiResponse<ClientDetail>>(`/clients/${id}`, body).then((res) => res.data.data!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', id] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setEditing(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      router.push('/clients')
    },
    onError: (err: unknown) => {
      const e = err as { response?: { status?: number; data?: { message?: string } } }
      if (e.response?.status === 409) {
        setDeleteError('This client has existing invoices and cannot be deleted.')
      } else {
        setDeleteError(e.response?.data?.message ?? 'Something went wrong')
      }
      setDeleteOpen(false)
    },
  })

  if (clientLoading) {
    return (
      <AppShell>
        <div className="max-w-3xl"><LoadingSkeleton rows={6} /></div>
      </AppShell>
    )
  }

  if (!client) {
    return (
      <AppShell>
        <div className="max-w-3xl">
          <p className="text-sm text-red-600">Client not found.</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Head><title>{client.name} — Billon</title></Head>
      <div className="max-w-3xl space-y-6">
        <PageHeader
          title={client.name}
          backHref="/clients"
          backLabel="Clients"
          action={
            !editing && (
              <button
                onClick={() => setDeleteOpen(true)}
                className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm rounded-md"
              >
                Delete
              </button>
            )
          }
        />

        {deleteError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">
            {deleteError}
          </div>
        )}

        <ClientInfoCard
          client={client}
          editing={editing}
          onEdit={() => setEditing(true)}
          onSave={(data) => updateMutation.mutate(data)}
          onCancel={() => setEditing(false)}
          saving={updateMutation.isPending}
        />

        {/* Invoices mini-table */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Invoices</h2>
            <Link
              href={`/invoices/new?clientId=${id}`}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              + New Invoice
            </Link>
          </div>

          {invoicesLoading ? (
            <LoadingSkeleton rows={3} />
          ) : !invoicesPage?.content.length ? (
            <EmptyState
              message="No invoices for this client yet."
              action={{ label: 'Create invoice', href: `/invoices/new?clientId=${id}` }}
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left text-xs font-medium text-slate-500 uppercase pb-2 pr-4">Number</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase pb-2 pr-4">Status</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase pb-2 pr-4">Due</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase pb-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoicesPage.content.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => router.push(`/invoices/${inv.id}`)}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="py-3 pr-4 text-slate-700 font-medium">{inv.invoiceNumber}</td>
                    <td className="py-3 pr-4"><StatusBadge status={inv.status} /></td>
                    <td className="py-3 pr-4 text-slate-600">{formatDate(inv.dueDate)}</td>
                    <td className="py-3 text-right text-slate-700">{formatMoney(inv.total, inv.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete client"
        message={`Are you sure you want to delete ${client.name}? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setDeleteOpen(false)}
        danger
      />
    </AppShell>
  )
}
