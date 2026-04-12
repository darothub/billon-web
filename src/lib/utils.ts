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
