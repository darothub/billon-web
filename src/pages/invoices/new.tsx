import Head from 'next/head'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { LineItemsEditor } from '@/components/invoices/LineItemsEditor'
import api from '@/lib/api'
import type {
  ApiResponse,
  PageResponse,
  ClientSummary,
  InvoiceDetail,
  CreateInvoiceRequest,
  LineItemDraft,
  UserProfile,
} from '@/lib/types'

export default function NewInvoicePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const preselectedClientId = router.query.clientId as string | undefined

  const [form, setForm] = useState({
    clientId: preselectedClientId ?? '',
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    taxLabel: '',
    note: '',
    currency: '',
  })
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([])
  const [bannerError, setBannerError] = useState('')

  const { data: clientsPage } = useQuery({
    queryKey: ['clients', { size: 100 }],
    queryFn: () =>
      api.get<ApiResponse<PageResponse<ClientSummary>>>('/clients', { params: { size: 100, sort: 'name,asc' } })
        .then((res) => res.data.data!),
    retry: false,
  })

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: () =>
      api.get<ApiResponse<UserProfile>>('/users/me').then((res) => res.data.data!),
    retry: false,
    staleTime: Infinity,
  })

  // Initialise currency from profile once loaded
  const currency = form.currency || profile?.defaultCurrency || 'GBP'

  const mutation = useMutation({
    mutationFn: (body: CreateInvoiceRequest) =>
      api.post<ApiResponse<InvoiceDetail>>('/invoices', body).then((res) => res.data.data!),
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      router.push(`/invoices/${invoice.id}`)
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } }
      setBannerError(e.response?.data?.message ?? 'Something went wrong')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setBannerError('')
    if (!form.clientId) { setBannerError('Please select a client'); return }
    if (lineItems.length === 0) { setBannerError('Add at least one line item'); return }

    mutation.mutate({
      clientId: parseInt(form.clientId),
      currency,
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      taxLabel: form.taxLabel || undefined,
      note: form.note || undefined,
      lineItems: lineItems.map((i) => ({
        description: i.description,
        quantity: parseFloat(i.quantity) || 1,
        unitRate: parseFloat(i.unitRate) || 0,
        taxRate: i.taxRate ? parseFloat(i.taxRate) : undefined,
      })),
    })
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  return (
    <AppShell>
      <Head><title>New Invoice — Billon</title></Head>
      <div className="max-w-3xl">
        <PageHeader title="New Invoice" backHref="/invoices" backLabel="Invoices" />

        {bannerError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md mb-4">
            {bannerError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Client *</label>
                <select
                  value={form.clientId}
                  onChange={set('clientId')}
                  required
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">Select client…</option>
                  {clientsPage?.content.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                <input
                  value={currency}
                  onChange={set('currency')}
                  placeholder="GBP"
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Issue date *</label>
                <input
                  type="date"
                  value={form.issueDate}
                  onChange={set('issueDate')}
                  required
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due date *</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={set('dueDate')}
                  required
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
              mode="create"
              items={lineItems}
              onChange={setLineItems}
              currency={currency}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-md"
            >
              {mutation.isPending ? 'Creating…' : 'Create invoice'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/invoices')}
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
