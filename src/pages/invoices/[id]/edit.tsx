import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { LineItemsEditor } from '@/components/invoices/LineItemsEditor'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import api from '@/lib/api'
import type { ApiResponse, InvoiceDetail, UpdateInvoiceRequest } from '@/lib/types'

export default function EditInvoicePage() {
  const router = useRouter()
  const { id } = router.query as { id: string }
  const queryClient = useQueryClient()
  const [bannerError, setBannerError] = useState('')

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoices', id],
    queryFn: () =>
      api.get<ApiResponse<InvoiceDetail>>(`/invoices/${id}`).then((res) => res.data.data!),
    enabled: !!id,
    retry: false,
  })

  const [form, setForm] = useState({
    issueDate: '',
    dueDate: '',
    taxLabel: '',
    note: '',
  })

  useEffect(() => {
    if (invoice) {
      if (invoice.status !== 'DRAFT') {
        router.replace(`/invoices/${id}`)
        return
      }
      setForm({
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        taxLabel: invoice.taxLabel ?? '',
        note: invoice.note ?? '',
      })
    }
  }, [invoice, id, router])

  const updateMutation = useMutation({
    mutationFn: (body: UpdateInvoiceRequest) =>
      api.put<ApiResponse<InvoiceDetail>>(`/invoices/${id}`, body).then((res) => res.data.data!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', id] })
      router.push(`/invoices/${id}`)
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } }
      setBannerError(e.response?.data?.message ?? 'Something went wrong')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setBannerError('')
    updateMutation.mutate({
      issueDate: form.issueDate || undefined,
      dueDate: form.dueDate || undefined,
      taxLabel: form.taxLabel || undefined,
      note: form.note || undefined,
    })
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

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
        <p className="text-sm text-red-600">Invoice not found.</p>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Head><title>Edit {invoice.invoiceNumber} — Billon</title></Head>
      <div className="max-w-3xl space-y-5">
        <PageHeader
          title={`Edit ${invoice.invoiceNumber}`}
          backHref={`/invoices/${id}`}
          backLabel="Invoice"
        />

        {bannerError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">
            {bannerError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Issue date</label>
                <input
                  type="date"
                  value={form.issueDate}
                  onChange={set('issueDate')}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due date</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={set('dueDate')}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tax label</label>
                <input
                  value={form.taxLabel}
                  onChange={set('taxLabel')}
                  placeholder="VAT"
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
              <textarea
                value={form.note}
                onChange={set('note')}
                rows={2}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Line Items</h2>
            <LineItemsEditor
              mode="edit"
              items={invoice.lineItems}
              invoiceId={invoice.id}
              currency={invoice.currency}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-md"
            >
              {updateMutation.isPending ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/invoices/${id}`)}
              className="px-4 py-2 border border-slate-200 text-slate-700 text-sm rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  )
}
