import type { InvoiceStatus } from '@/lib/types'

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  DRAFT:   'bg-slate-100 text-slate-600',
  SENT:    'bg-blue-100 text-blue-700',
  OVERDUE: 'bg-red-100 text-red-700',
  PAID:    'bg-green-100 text-green-700',
  VOID:    'bg-slate-100 text-slate-400',
}

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  )
}
