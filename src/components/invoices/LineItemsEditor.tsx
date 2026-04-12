import { useState } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import type { LineItemDraft, InvoiceLineItemResponse, AddLineItemRequest } from '@/lib/types'
import api from '@/lib/api'

// Create mode: manage local draft state
interface CreateModeProps {
  mode: 'create'
  items: LineItemDraft[]
  onChange: (items: LineItemDraft[]) => void
  invoiceId?: never
  currency: string
}

// Edit mode: each mutation goes to API immediately
interface EditModeProps {
  mode: 'edit'
  items: InvoiceLineItemResponse[]
  invoiceId: number
  onChange?: never
  currency: string
}

type LineItemsEditorProps = CreateModeProps | EditModeProps

function newDraft(): LineItemDraft {
  return {
    localId: Math.random().toString(36).slice(2),
    description: '',
    quantity: '1',
    unitRate: '',
    taxRate: '',
  }
}

function lineTotal(item: LineItemDraft): number {
  const qty = parseFloat(item.quantity) || 0
  const rate = parseFloat(item.unitRate) || 0
  const tax = parseFloat(item.taxRate) || 0
  const sub = qty * rate
  return sub + sub * (tax / 100)
}

function AddLineItemForm({ onAdd, loading }: { onAdd: (body: AddLineItemRequest) => void; loading: boolean }) {
  const [form, setForm] = useState({ description: '', quantity: '1', unitRate: '', taxRate: '' })
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((v) => ({ ...v, [f]: e.target.value }))

  const handleAdd = () => {
    if (!form.description || !form.unitRate) return
    onAdd({
      description: form.description,
      quantity: parseFloat(form.quantity) || 1,
      unitRate: parseFloat(form.unitRate),
      taxRate: form.taxRate ? parseFloat(form.taxRate) / 100 : undefined,
    })
    setForm({ description: '', quantity: '1', unitRate: '', taxRate: '' })
  }

  return (
    <div className="grid grid-cols-12 gap-2 items-start pt-2 border-t border-dashed border-slate-200">
      <input className="col-span-5 border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Description" value={form.description} onChange={set('description')} />
      <input className="col-span-2 border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="1" type="number" min="0" value={form.quantity} onChange={set('quantity')} />
      <input className="col-span-2 border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="0.00" type="number" step="0.01" value={form.unitRate} onChange={set('unitRate')} />
      <input className="col-span-2 border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="0" type="number" max="100" value={form.taxRate} onChange={set('taxRate')} />
      <button
        type="button"
        onClick={handleAdd}
        disabled={loading}
        className="col-span-1 flex items-center justify-center text-indigo-600 hover:text-indigo-800 disabled:opacity-40 mt-1.5"
      >
        <PlusIcon className="w-4 h-4" />
      </button>
    </div>
  )
}

export function LineItemsEditor(props: LineItemsEditorProps) {
  const queryClient = useQueryClient()

  const addLineItemMutation = useMutation({
    mutationFn: (body: AddLineItemRequest) =>
      api.post(`/invoices/${props.invoiceId}/line-items`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', String(props.invoiceId)] })
    },
  })

  const deleteLineItemMutation = useMutation({
    mutationFn: (itemId: number) =>
      api.delete(`/invoices/${props.invoiceId}/line-items/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', String(props.invoiceId)] })
    },
  })

  if (props.mode === 'edit') {
    const items = props.items

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 uppercase px-1">
          <div className="col-span-5">Description</div>
          <div className="col-span-2">Qty</div>
          <div className="col-span-2">Rate</div>
          <div className="col-span-2">Tax %</div>
          <div className="col-span-1"></div>
        </div>
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-12 gap-2 items-center text-sm">
            <div className="col-span-5 text-slate-700">{item.description}</div>
            <div className="col-span-2 text-slate-600">{item.quantity}</div>
            <div className="col-span-2 text-slate-600">{item.unitRate.toFixed(2)}</div>
            <div className="col-span-2 text-slate-600">{item.taxRate != null ? `${(Number(item.taxRate) * 100).toFixed(0)}%` : '—'}</div>
            <div className="col-span-1">
              <button
                onClick={() => deleteLineItemMutation.mutate(item.id)}
                disabled={deleteLineItemMutation.isPending}
                className="text-slate-400 hover:text-red-600 disabled:opacity-40"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        <AddLineItemForm
          onAdd={(body) => addLineItemMutation.mutate(body)}
          loading={addLineItemMutation.isPending}
        />
      </div>
    )
  }

  // Create mode
  const { items, onChange } = props

  const updateItem = (localId: string, field: keyof LineItemDraft, value: string) => {
    onChange(items.map((i) => (i.localId === localId ? { ...i, [field]: value } : i)))
  }

  const removeItem = (localId: string) => {
    onChange(items.filter((i) => i.localId !== localId))
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 uppercase px-1">
        <div className="col-span-5">Description</div>
        <div className="col-span-2">Qty</div>
        <div className="col-span-2">Rate</div>
        <div className="col-span-2">Tax %</div>
        <div className="col-span-1"></div>
      </div>
      {items.map((item) => (
        <div key={item.localId} className="grid grid-cols-12 gap-2 items-start">
          <input
            className="col-span-5 border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Description"
            value={item.description}
            onChange={(e) => updateItem(item.localId, 'description', e.target.value)}
          />
          <input
            className="col-span-2 border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="1"
            type="number"
            min="0"
            value={item.quantity}
            onChange={(e) => updateItem(item.localId, 'quantity', e.target.value)}
          />
          <input
            className="col-span-2 border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="0.00"
            type="number"
            min="0"
            step="0.01"
            value={item.unitRate}
            onChange={(e) => updateItem(item.localId, 'unitRate', e.target.value)}
          />
          <input
            className="col-span-2 border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="0"
            type="number"
            min="0"
            max="100"
            value={item.taxRate}
            onChange={(e) => updateItem(item.localId, 'taxRate', e.target.value)}
          />
          <button
            type="button"
            onClick={() => removeItem(item.localId)}
            className="col-span-1 flex items-center justify-center text-slate-400 hover:text-red-600 mt-1.5"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ))}

      {/* Live totals */}
      {items.length > 0 && (
        <div className="text-right text-sm text-slate-600 space-y-0.5 pt-2 border-t border-slate-100">
          <div>Subtotal: {props.currency} {items.reduce((s, i) => {
            const qty = parseFloat(i.quantity) || 0
            const rate = parseFloat(i.unitRate) || 0
            return s + qty * rate
          }, 0).toFixed(2)}</div>
          <div>Tax: {props.currency} {items.reduce((s, i) => {
            const qty = parseFloat(i.quantity) || 0
            const rate = parseFloat(i.unitRate) || 0
            const tax = parseFloat(i.taxRate) || 0
            return s + qty * rate * (tax / 100)
          }, 0).toFixed(2)}</div>
          <div className="font-semibold text-slate-800">Total: {props.currency} {items.reduce((s, i) => s + lineTotal(i), 0).toFixed(2)}</div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onChange([...items, newDraft()])}
        className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 mt-2"
      >
        <PlusIcon className="w-4 h-4" />
        Add line item
      </button>
    </div>
  )
}
