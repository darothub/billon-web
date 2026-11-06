import Decimal from 'decimal.js'

import type { Row } from './source'

export const text = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value)

export const maybeText = (value: unknown): string | null => {
  const result = text(value)
  return result === '' ? null : result
}

export const whole = (value: unknown, fallback = 0): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
}

export const decimal = (value: unknown, fallback = '0'): string =>
  value === null || value === undefined ? fallback : String(value)

export const date = (value: unknown): Date =>
  value instanceof Date ? value : new Date(String(value))

export const maybeDate = (value: unknown): Date | null =>
  value === null || value === undefined ? null : date(value)

export function lineAmounts(row: Row): { lineTotal: string; taxAmount: string } {
  const lineTotal = new Decimal(decimal(row.quantity, '1'))
    .times(decimal(row.unitRate))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  const taxAmount = row.taxRate === null || row.taxRate === undefined
    ? new Decimal(0)
    : lineTotal.times(decimal(row.taxRate)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  return { lineTotal: lineTotal.toString(), taxAmount: taxAmount.toString() }
}

export interface LegacyTaxEntry {
  label: string
  rate: string
  position: number
}

export function legacyTaxEntries(invoice: Row): LegacyTaxEntry[] {
  if (invoice.taxEntries === null || invoice.taxEntries === undefined) return []
  const parsed = typeof invoice.taxEntries === 'string'
    ? JSON.parse(invoice.taxEntries)
    : invoice.taxEntries
  if (!Array.isArray(parsed)) throw new Error(`invoice ${invoice.id} has invalid tax_entries JSON`)
  return parsed.map((entry, position) => ({
    label: text((entry as Row).label),
    rate: decimal((entry as Row).rate),
    position,
  }))
}

export function legacyLogo(value: unknown): {
  image: Uint8Array<ArrayBuffer>
  mimeType: 'image/png' | 'image/jpeg'
} | null {
  const source = maybeText(value)
  if (!source) return null
  const match = /^data:(image\/(?:png|jpeg|jpg));base64,([a-z\d+/=\s]+)$/i.exec(source)
  if (!match) throw new Error('a legacy logo is not a PNG or JPEG data URL')
  const mimeType = match[1].toLowerCase() === 'image/png' ? 'image/png' : 'image/jpeg'
  return { image: Uint8Array.from(Buffer.from(match[2], 'base64')), mimeType }
}
