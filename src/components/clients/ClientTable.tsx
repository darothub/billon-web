import { useRouter } from 'next/router'
import type { ClientSummary } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'

interface ClientTableProps {
  clients: ClientSummary[] | undefined
  isLoading: boolean
}

export function ClientTable({ clients, isLoading }: ClientTableProps) {
  const router = useRouter()

  if (isLoading) return <LoadingSkeleton rows={5} />

  if (!clients || clients.length === 0) {
    return (
      <EmptyState
        message="No clients yet."
        action={{ label: 'Add your first client', href: '/clients/new' }}
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left text-xs font-medium text-slate-500 uppercase pb-2 pr-4">Name</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase pb-2 pr-4">Email</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase pb-2 pr-4">Invoices</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase pb-2">Added</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr
              key={client.id}
              onClick={() => router.push(`/clients/${client.id}`)}
              className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
            >
              <td className="py-3 pr-4 text-slate-700 font-medium">{client.name}</td>
              <td className="py-3 pr-4 text-slate-600">{client.email}</td>
              <td className="py-3 pr-4 text-slate-600">{client.invoiceCount}</td>
              <td className="py-3 text-slate-600">{formatDate(client.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
