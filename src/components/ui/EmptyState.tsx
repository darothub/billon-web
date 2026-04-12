import Link from 'next/link'

interface EmptyStateProps {
  message: string
  action?: {
    label: string
    href: string
  }
}

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-3">📄</div>
      <p className="text-sm text-slate-500 mb-3">{message}</p>
      {action && (
        <Link
          href={action.href}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          {action.label} →
        </Link>
      )}
    </div>
  )
}
