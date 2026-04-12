import Head from 'next/head'
import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { formatDate, formatMoney } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse, InvoiceDetail } from '@/lib/types'

export default function InvoiceDetailPage() {
  const router = useRouter()
  const { id } = router.query as { id: string }
  const queryClient = useQueryClient()

  const [confirmAction, setConfirmAction] = useState<'send' | 'void' | 'delete' | 'paid' | null>(null)
  const [bannerError, setBannerError] = useState('')

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoices', id],
    queryFn: () =>
      api.get<ApiResponse<InvoiceDetail>>(`/invoices/${id}`).then((res) => res.data.data!),
    enabled: !!id,
    retry: false,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['invoices', id] })

  const sendMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/send`),
    onSuccess: () => { invalidate(); queryClient.invalidateQueries({ queryKey: ['dashboard'] }) },
    onError: handleError,
  })

  const paidMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/mark-paid`),
    onSuccess: () => { invalidate(); queryClient.invalidateQueries({ queryKey: ['dashboard'] }) },
    onError: handleError,
  })

  const voidMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/void`),
    onSuccess: () => { invalidate(); queryClient.invalidateQueries({ queryKey: ['dashboard'] }) },
    onError: handleError,
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      router.push('/invoices')
    },
    onError: handleError,
  })

  function handleError(err: unknown) {
    const e = err as { response?: { data?: { message?: string } } }
    setBannerError(e.response?.data?.message ?? 'Something went wrong')
    setConfirmAction(null)
  }

  const downloadPdf = async () => {
    if (!invoice) return
    const res = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoice.invoiceNumber}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }

  const doConfirmed = () => {
    if (confirmAction === 'send') sendMutation.mutate()
    else if (confirmAction === 'void') voidMutation.mutate()
    else if (confirmAction === 'delete') deleteMutation.mutate()
    else if (confirmAction === 'paid') paidMutation.mutate()
    setConfirmAction(null)
  }

  const CONFIRM_COPY = {
    send: { title: 'Send invoice', message: 'This will mark the invoice as SENT. Continue?', label: 'Send invoice' },
    void: { title: 'Void invoice', message: 'This will permanently void the invoice. Continue?', label: 'Void', danger: true },
    delete: { title: 'Delete invoice', message: 'This will permanently delete the invoice. Continue?', label: 'Delete', danger: true },
    paid: { title: 'Mark as paid', message: 'This will mark the invoice as PAID. Continue?', label: 'Mark as paid' },
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="max-w-3xl"><LoadingSkeleton rows={8} /></div>
      </AppShell>
    )
  }

  if (!invoice) {
    return (
      <AppShell>
        <div className="max-w-3xl"><p className="text-sm text-red-600">Invoice not found.</p></div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Head><title>{invoice.invoiceNumber} — Billon</title></Head>
      <div className="max-w-3xl space-y-6">
        <PageHeader
          title={invoice.invoiceNumber}
          backHref="/invoices"
          backLabel="Invoices"
        />

        {bannerError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">
            {bannerError}
          </div>
        )}

        {/* Status + actions */}
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={invoice.status} />

          {invoice.status === 'DRAFT' && (
            <>
              <Link
                href={`/invoices/${id}/edit`}
                className="px-3 py-1.5 border border-slate-200 text-slate-700 text-sm rounded-md hover:bg-slate-50"
              >
                Edit
              </Link>
              <button
                onClick={() => setConfirmAction('send')}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md"
              >
                Send Invoice
              </button>
              <button
                onClick={() => setConfirmAction('void')}
                className="px-3 py-1.5 border border-slate-200 text-slate-500 hover:text-slate-700 text-sm rounded-md"
              >
                Void
              </button>
              <button
                onClick={() => setConfirmAction('delete')}
                className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-sm rounded-md"
              >
                Delete
              </button>
            </>
          )}

          {(invoice.status === 'SENT' || invoice.status === 'OVERDUE') && (
            <>
              <button
                onClick={downloadPdf}
                className="px-3 py-1.5 border border-slate-200 text-slate-700 text-sm rounded-md hover:bg-slate-50"
              >
                Download PDF
              </button>
              <button
                onClick={() => setConfirmAction('paid')}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md"
              >
                Mark as Paid
              </button>
              <button
                onClick={() => setConfirmAction('void')}
                className="px-3 py-1.5 border border-slate-200 text-slate-500 hover:text-slate-700 text-sm rounded-md"
              >
                Void
              </button>
            </>
          )}

          {(invoice.status === 'PAID' || invoice.status === 'VOID') && (
            <button
              onClick={downloadPdf}
              className="px-3 py-1.5 border border-slate-200 text-slate-700 text-sm rounded-md hover:bg-slate-50"
            >
              Download PDF
            </button>
          )}
        </div>

        {/* Invoice details */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-6">
          {/* Header info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="text-xs text-slate-500 mb-0.5">Client</dt>
              <dd className="text-slate-800 font-medium">
                <Link href={`/clients/${invoice.client.id}`} className="hover:text-indigo-600">
                  {invoice.client.name}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 mb-0.5">Issue date</dt>
              <dd className="text-slate-800">{formatDate(invoice.issueDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 mb-0.5">Due date</dt>
              <dd className="text-slate-800">{formatDate(invoice.dueDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 mb-0.5">Currency</dt>
              <dd className="text-slate-800">{invoice.currency}</dd>
            </div>
          </div>

          {/* Line items */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Line Items</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left text-xs font-medium text-slate-500 uppercase pb-2 pr-4">Description</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase pb-2 pr-4">Qty</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase pb-2 pr-4">Rate</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase pb-2 pr-4">Tax</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase pb-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 text-slate-700">{item.description}</td>
                    <td className="py-3 pr-4 text-right text-slate-600">{item.quantity}</td>
                    <td className="py-3 pr-4 text-right text-slate-600">{formatMoney(item.unitRate, invoice.currency)}</td>
                    <td className="py-3 pr-4 text-right text-slate-600">{item.taxRate ? `${item.taxRate}%` : '—'}</td>
                    <td className="py-3 text-right text-slate-700">{formatMoney(item.lineTotal, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="text-right space-y-1 text-sm border-t border-slate-100 pt-4">
            <div className="text-slate-600">Subtotal: {formatMoney(invoice.subtotal, invoice.currency)}</div>
            <div className="text-slate-600">{invoice.taxLabel || 'Tax'}: {formatMoney(invoice.taxTotal, invoice.currency)}</div>
            <div className="text-lg font-bold text-slate-900">Total: {formatMoney(invoice.total, invoice.currency)}</div>
          </div>

          {/* Note */}
          {invoice.note && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500 mb-1">Note</p>
              <p className="text-sm text-slate-700">{invoice.note}</p>
            </div>
          )}
        </div>
      </div>

      {confirmAction && (
        <ConfirmDialog
          open
          title={CONFIRM_COPY[confirmAction].title}
          message={CONFIRM_COPY[confirmAction].message}
          confirmLabel={CONFIRM_COPY[confirmAction].label}
          onConfirm={doConfirmed}
          onCancel={() => setConfirmAction(null)}
          danger={'danger' in CONFIRM_COPY[confirmAction] && CONFIRM_COPY[confirmAction].danger === true}
        />
      )}
    </AppShell>
  )
}
