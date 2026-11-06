// Format: "GBP 1215.00"
export function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(2)}`
}

// Format: "31 Mar 2026" from "2026-03-31"
export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// Short date: "31 Mar"
export function formatDateShort(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })
}

/** A sentence a person can act on, from whatever a failed request threw. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } }; request?: unknown }
  const message = e.response?.data?.message
  if (message) return message
  if (e.request && !e.response) {
    return 'We could not reach Billon. Check your internet connection and try again.'
  }
  return fallback
}
