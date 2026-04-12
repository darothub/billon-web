import Link from 'next/link'
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  backHref?: string
  backLabel?: string
  action?: ReactNode
}

export function PageHeader({ title, backHref, backLabel, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        {backHref && (
          <Link
            href={backHref}
            className="text-sm text-slate-500 hover:text-slate-700 mb-1 block"
          >
            ← {backLabel ?? 'Back'}
          </Link>
        )}
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
