import { useRouter } from 'next/router'
import Link from 'next/link'
import type { InvoiceSummary } from '@/lib/types'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, formatMoney } from '@/lib/utils'

interface RecentInvoicesTableProps {
  invoices: InvoiceSummary[] | undefined
  isLoading: boolean
}

export function RecentInvoicesTable({ invoices, isLoading }: RecentInvoicesTableProps) {
  const router = useRouter()

  if (isLoading) return <LoadingSkeleton rows={5} />

  if (!invoices || invoices.length === 0) {
    return (
      <EmptyState
        message="No invoices yet. Create your first invoice"
        action={{ label: 'Create invoice', href: '/invoices/new' }}
      />
    )
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left text-xs font-medium text-slate-500 uppercase pb-2 pr-4">Number</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase pb-2 pr-4">Client</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase pb-2 pr-4">Status</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase pb-2 pr-4">Due</th>
              <th className="text-right text-xs font-medium text-slate-500 uppercase pb-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr
                key={inv.id}
                onClick={() => router.push(`/invoices/${inv.id}`)}
                className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
              >
                <td className="py-3 pr-4 text-slate-700 font-medium">{inv.invoiceNumber}</td>
                <td className="py-3 pr-4 text-slate-700">{inv.clientName}</td>
                <td className="py-3 pr-4"><StatusBadge status={inv.status} /></td>
                <td className="py-3 pr-4 text-slate-600">{formatDate(inv.dueDate)}</td>
                <td className="py-3 text-right text-slate-700">{formatMoney(inv.total, inv.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-right">
        <Link href="/invoices" className="text-sm text-indigo-600 hover:text-indigo-800">
          View all →
        </Link>
      </div>
    </div>
  )
}
