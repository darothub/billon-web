import type { CurrencyTotal } from '@/lib/types'
import { formatMoney } from '@/lib/utils'

interface StatCardProps {
  title: string
  count: number
  totals?: CurrencyTotal[]
  colorClass?: string
}

export function StatCard({ title, count, totals, colorClass }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{title}</p>
      <p className={`text-3xl font-bold mb-2 ${colorClass ?? 'text-slate-900'}`}>{count}</p>
      {totals && totals.length > 0 ? (
        <div className="space-y-0.5">
          {totals.map((t) => (
            <p key={t.currency} className="text-sm text-slate-600">
              {formatMoney(t.amount, t.currency)}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">—</p>
      )}
    </div>
  )
}
