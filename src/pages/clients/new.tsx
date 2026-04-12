import Head from 'next/head'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import api from '@/lib/api'
import type { ApiResponse, ClientDetail, CreateClientRequest } from '@/lib/types'

export default function NewClientPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CreateClientRequest>({
    name: '',
    email: '',
    companyName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    postcode: '',
    country: '',
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [bannerError, setBannerError] = useState('')

  const set = (field: keyof CreateClientRequest) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  const mutation = useMutation({
    mutationFn: (body: CreateClientRequest) =>
      api.post<ApiResponse<ClientDetail>>('/clients', body).then((res) => res.data.data!),
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      router.push(`/clients/${client.id}`)
    },
    onError: (err: unknown) => {
      const e = err as { response?: { status?: number; data?: { message?: string; data?: { errors?: Record<string, string> } } } }
      if (e.response?.status === 400) {
        const errors = e.response?.data?.data?.errors
        if (errors) setFieldErrors(errors)
        else setBannerError(e.response?.data?.message ?? 'Validation failed')
      } else {
        setBannerError(e.response?.data?.message ?? 'Something went wrong')
      }
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    setBannerError('')
    mutation.mutate(form)
  }

  const Field = ({ label, field, type = 'text', required }: { label: string; field: keyof CreateClientRequest; type?: string; required?: boolean }) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}{required && ' *'}</label>
      <input
        type={type}
        value={form[field] ?? ''}
        onChange={set(field)}
        required={required}
        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {fieldErrors[field] && <p className="text-xs text-red-600 mt-1">{fieldErrors[field]}</p>}
    </div>
  )

  return (
    <AppShell>
      <Head><title>New Client — Billon</title></Head>
      <div className="max-w-2xl">
        <PageHeader title="New Client" backHref="/clients" backLabel="Clients" />

        {bannerError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md mb-4">
            {bannerError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name" field="name" required />
            <Field label="Email" field="email" type="email" required />
            <Field label="Company name" field="companyName" />
            <Field label="Address line 1" field="addressLine1" />
            <Field label="Address line 2" field="addressLine2" />
            <Field label="City" field="city" />
            <Field label="Postcode" field="postcode" />
            <Field label="Country" field="country" />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-md"
            >
              {mutation.isPending ? 'Creating…' : 'Create client'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/clients')}
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
