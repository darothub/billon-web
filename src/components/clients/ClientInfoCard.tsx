import { useState } from 'react'
import type { ClientDetail, UpdateClientRequest } from '@/lib/types'

interface ClientInfoCardProps {
  client: ClientDetail
  editing: boolean
  onEdit: () => void
  onSave: (data: UpdateClientRequest) => void
  onCancel: () => void
  saving?: boolean
}

export function ClientInfoCard({ client, editing, onEdit, onSave, onCancel, saving }: ClientInfoCardProps) {
  const [form, setForm] = useState<UpdateClientRequest>({
    name: client.name,
    email: client.email,
    companyName: client.companyName ?? '',
    addressLine1: client.addressLine1 ?? '',
    addressLine2: client.addressLine2 ?? '',
    city: client.city ?? '',
    postcode: client.postcode ?? '',
    country: client.country ?? '',
  })

  const set = (field: keyof UpdateClientRequest) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  if (editing) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Name *</label>
            <input
              value={form.name}
              onChange={set('name')}
              required
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              required
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Company</label>
            <input
              value={form.companyName ?? ''}
              onChange={set('companyName')}
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Address line 1</label>
            <input
              value={form.addressLine1 ?? ''}
              onChange={set('addressLine1')}
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Address line 2</label>
            <input
              value={form.addressLine2 ?? ''}
              onChange={set('addressLine2')}
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">City</label>
            <input
              value={form.city ?? ''}
              onChange={set('city')}
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Postcode</label>
            <input
              value={form.postcode ?? ''}
              onChange={set('postcode')}
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Country</label>
            <input
              value={form.country ?? ''}
              onChange={set('country')}
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => onSave(form)}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm rounded-md"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-slate-200 text-slate-700 text-sm rounded-md hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const field = (label: string, value: string | null | undefined) =>
    value ? (
      <div key={label}>
        <dt className="text-xs font-medium text-slate-500">{label}</dt>
        <dd className="text-sm text-slate-800 mt-0.5">{value}</dd>
      </div>
    ) : null

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('Name', client.name)}
        {field('Email', client.email)}
        {field('Company', client.companyName)}
        {field('Address', [client.addressLine1, client.addressLine2].filter(Boolean).join(', '))}
        {field('City', client.city)}
        {field('Postcode', client.postcode)}
        {field('Country', client.country)}
      </dl>
      <div className="mt-4">
        <button
          onClick={onEdit}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md"
        >
          Edit
        </button>
      </div>
    </div>
  )
}
