import { formatMoney } from '@/lib/utils'

interface StatCardProps {
  title: string
  count: number
  totals?: Record<string, number>
  colorClass?: string
}

export function StatCard({ title, count, totals, colorClass }: StatCardProps) {
  const totalEntries = totals ? Object.entries(totals).filter(([, amount]) => amount > 0) : []

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{title}</p>
      <p className={`text-3xl font-bold mb-2 ${colorClass ?? 'text-slate-900'}`}>{count}</p>
      {totalEntries.length > 0 ? (
        <div className="space-y-0.5">
          {totalEntries.map(([currency, amount]) => (
            <p key={currency} className="text-sm text-slate-600">
              {formatMoney(amount, currency)}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">—</p>
      )}
    </div>
  )
}
