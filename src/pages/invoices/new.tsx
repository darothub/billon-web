import Head from 'next/head'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { LineItemsEditor } from '@/components/invoices/LineItemsEditor'
import api from '@/lib/api'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import type {
  ApiResponse,
  PageResponse,
  ClientSummary,
  InvoiceDetail,
  CreateInvoiceRequest,
  LineItemDraft,
  TaxEntryDraft,
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
  const [taxEntries, setTaxEntries] = useState<TaxEntryDraft[]>([])
  const [bannerError, setBannerError] = useState('')
  const [editingPayment, setEditingPayment] = useState(false)
  const [paymentDetails, setPaymentDetails] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

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

  // Pre-fill payment details from profile once
  const paymentInitRef = useRef(false)
  useEffect(() => {
    if (profile && !paymentInitRef.current) {
      paymentInitRef.current = true
      setPaymentDetails(profile.paymentDetails ?? '')
    }
  }, [profile])

  const buildBody = (): CreateInvoiceRequest => ({
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
      taxRate: i.taxRate ? parseFloat(i.taxRate) / 100 : undefined,
    })),
    taxEntries: taxEntries.length > 0
      ? taxEntries.filter((e) => e.label && e.rate).map((e) => ({ label: e.label, rate: parseFloat(e.rate) / 100 }))
      : undefined,
  })

  const validate = (): boolean => {
    if (!form.clientId) { setBannerError('Please select a client'); return false }
    if (lineItems.length === 0) { setBannerError('Add at least one line item'); return false }
    return true
  }

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
    if (!validate()) return
    mutation.mutate(buildBody())
  }

  const handlePreview = async (e: React.MouseEvent) => {
    e.preventDefault()
    setBannerError('')
    if (!validate()) return
    setPreviewLoading(true)
    try {
      const invoice = await api.post<ApiResponse<InvoiceDetail>>('/invoices', buildBody()).then((r) => r.data.data!)
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      const pdfRes = await api.get(`/invoices/${invoice.id}/pdf`, { responseType: 'blob' })
      const blob = new Blob([pdfRes.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      setPreviewUrl(url)
      // Store invoice id so we can navigate to it on close
      router.replace(`/invoices/new?preview=${invoice.id}`, undefined, { shallow: true })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setBannerError(e.response?.data?.message ?? 'Failed to generate preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  const closePreview = () => {
    const invoiceId = router.query.preview
    if (previewUrl) window.URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    if (invoiceId) router.push(`/invoices/${invoiceId}`)
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

          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Invoice Taxes</h2>
            <p className="text-xs text-slate-500 mb-3">Add invoice-level taxes applied to the subtotal (e.g. VAT 20%, IRS 10%).</p>
            {taxEntries.length > 0 && (
              <div className="space-y-2 mb-3">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 uppercase px-1">
                  <div className="col-span-6">Label</div>
                  <div className="col-span-5">Rate (%)</div>
                  <div className="col-span-1"></div>
                </div>
                {taxEntries.map((entry) => (
                  <div key={entry.localId} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      className="col-span-6 border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="e.g. VAT"
                      value={entry.label}
                      onChange={(e) =>
                        setTaxEntries((prev) =>
                          prev.map((t) => (t.localId === entry.localId ? { ...t, label: e.target.value } : t))
                        )
                      }
                    />
                    <input
                      className="col-span-5 border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="20"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={entry.rate}
                      onChange={(e) =>
                        setTaxEntries((prev) =>
                          prev.map((t) => (t.localId === entry.localId ? { ...t, rate: e.target.value } : t))
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setTaxEntries((prev) => prev.filter((t) => t.localId !== entry.localId))}
                      className="col-span-1 flex items-center justify-center text-slate-400 hover:text-red-600"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() =>
                setTaxEntries((prev) => [
                  ...prev,
                  { localId: Math.random().toString(36).slice(2), label: '', rate: '' },
                ])
              }
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800"
            >
              <PlusIcon className="w-4 h-4" />
              Add tax
            </button>
          </div>

          {/* Payment details */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-700">Payment / account details</h2>
              <button
                type="button"
                onClick={() => setEditingPayment((v) => !v)}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                {editingPayment ? 'Done' : 'Edit'}
              </button>
            </div>
            {editingPayment ? (
              <textarea
                value={paymentDetails}
                onChange={(e) => setPaymentDetails(e.target.value)}
                rows={4}
                placeholder={'Bank: Barclays\nAccount Number: 12345678\nSort Code: 00-00-00'}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            ) : paymentDetails ? (
              <pre className="text-sm text-slate-600 whitespace-pre-wrap font-sans">{paymentDetails}</pre>
            ) : (
              <p className="text-sm text-slate-400 italic">No payment details set. <button type="button" onClick={() => setEditingPayment(true)} className="text-indigo-600 hover:underline not-italic">Add them here</button> or save them in <a href="/settings" className="text-indigo-600 hover:underline">Settings</a>.</p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={mutation.isPending || previewLoading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-md"
            >
              {mutation.isPending ? 'Creating…' : 'Create invoice'}
            </button>
            <button
              type="button"
              onClick={handlePreview}
              disabled={mutation.isPending || previewLoading}
              className="px-4 py-2 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 text-sm font-medium rounded-md"
            >
              {previewLoading ? 'Generating…' : 'Preview PDF'}
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

      {/* PDF Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl flex flex-col" style={{ height: '90vh' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <span className="text-sm font-semibold text-slate-700">Invoice Preview</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={closePreview}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-md"
                >
                  Go to invoice
                </button>
                <button
                  onClick={() => {
                    if (previewUrl) window.URL.revokeObjectURL(previewUrl)
                    setPreviewUrl(null)
                  }}
                  className="text-slate-400 hover:text-slate-700 text-lg leading-none px-2"
                >
                  ✕
                </button>
              </div>
            </div>
            <iframe src={previewUrl} className="flex-1 w-full rounded-b-lg" title="Invoice PDF Preview" />
          </div>
        </div>
      )}
    </AppShell>
  )
}
