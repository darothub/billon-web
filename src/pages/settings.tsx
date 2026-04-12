import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import api from '@/lib/api'
import type { ApiResponse, UserProfile, UpdateProfileRequest } from '@/lib/types'

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [bannerSuccess, setBannerSuccess] = useState('')
  const [bannerError, setBannerError] = useState('')

  const { data: profile, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () =>
      api.get<ApiResponse<UserProfile>>('/users/me').then((res) => res.data.data!),
    retry: false,
  })

  const [form, setForm] = useState<UpdateProfileRequest>({
    firstName: '',
    lastName: '',
    invoicePrefix: '',
    taxLabel: '',
    defaultCurrency: '',
    paymentDetails: '',
  })

  useEffect(() => {
    if (profile) {
      setForm({
        firstName: profile.firstName,
        lastName: profile.lastName,
        invoicePrefix: profile.invoicePrefix,
        taxLabel: profile.taxLabel,
        defaultCurrency: profile.defaultCurrency,
        paymentDetails: profile.paymentDetails ?? '',
      })
    }
  }, [profile])

  const mutation = useMutation({
    mutationFn: (body: UpdateProfileRequest) =>
      api.put<ApiResponse<UserProfile>>('/users/me', body).then((res) => res.data.data!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setBannerSuccess('Settings saved.')
      setBannerError('')
      setTimeout(() => setBannerSuccess(''), 3000)
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } }
      setBannerError(e.response?.data?.message ?? 'Something went wrong')
    },
  })

  const set = (field: keyof UpdateProfileRequest) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setBannerError('')
    setBannerSuccess('')
    mutation.mutate(form)
  }

  return (
    <AppShell>
      <Head><title>Settings — Billon</title></Head>
      <div className="max-w-xl">
        <PageHeader title="Settings" />

        {bannerSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-md mb-4">
            {bannerSuccess}
          </div>
        )}
        {bannerError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md mb-4">
            {bannerError}
          </div>
        )}

        {isLoading ? (
          <LoadingSkeleton rows={6} />
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">First name</label>
                <input
                  value={form.firstName}
                  onChange={set('firstName')}
                  required
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Last name</label>
                <input
                  value={form.lastName}
                  onChange={set('lastName')}
                  required
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                value={profile?.email ?? ''}
                readOnly
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Invoice prefix</label>
              <input
                value={form.invoicePrefix}
                onChange={set('invoicePrefix')}
                placeholder="INV"
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

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Default currency</label>
              <select
                value={form.defaultCurrency}
                onChange={set('defaultCurrency')}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="GBP">GBP — British Pound</option>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="CAD">CAD — Canadian Dollar</option>
                <option value="AUD">AUD — Australian Dollar</option>
              </select>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Payment / account details</label>
              <p className="text-xs text-slate-500 mb-2">Shown on every invoice PDF. Enter bank name, account number, sort code, or any payment instructions.</p>
              <textarea
                value={form.paymentDetails ?? ''}
                onChange={set('paymentDetails')}
                rows={4}
                placeholder={'Bank: Barclays\nAccount Number: 12345678\nSort Code: 00-00-00'}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={mutation.isPending}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-md"
              >
                {mutation.isPending ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  )
}
