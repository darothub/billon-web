interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-4 py-4 text-sm text-slate-600">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 0}
        className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 disabled:cursor-not-allowed"
      >
        ← Previous
      </button>
      <span>Page {page + 1} of {totalPages}</span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages - 1}
        className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 disabled:cursor-not-allowed"
      >
        Next →
      </button>
    </div>
  )
}
