import Decimal from 'decimal.js'
import { minorUnitsFor } from './currency'

/**
 * Every figure on an invoice.
 *
 * Amounts are held as exact decimals from here all the way to the database, and are
 * only turned into ordinary numbers at the very last moment, when the reply is
 * written — because ordinary computer numbers cannot represent 0.10, and adding a few
 * hundred of them drifts by pennies.
 *
 * Ties round away from zero, which is what an invoice does: 0.125 is 13p, not 12p.
 *
 * Totals sent in a request are ignored. Only what is worked out here is ever saved.
 */

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -30, toExpPos: 30 })

export type DecimalInput = number | string | Decimal

export interface LineInput {
  description?: string
  quantity: DecimalInput
  unitRate: DecimalInput
  taxRate?: DecimalInput | null
}

export interface TaxEntryInput {
  label: string
  rate: DecimalInput
}

export interface TotalsInput {
  currency: string
  lineItems: LineInput[]
  taxEntries?: TaxEntryInput[] | null
  /** Only ever a fallback for a missing currency; never used for rounding. */
  accountDefaultCurrency?: string
}

export interface ComputedLine {
  description: string
  quantity: Decimal
  unitRate: Decimal
  taxRate: Decimal | null
  lineTotal: Decimal
  taxAmount: Decimal
  position: number
}

export interface ComputedTaxEntry {
  label: string
  rate: Decimal
  amount: Decimal
  position: number
}

export interface InvoiceTotals {
  currency: string
  lineItems: ComputedLine[]
  taxEntries: ComputedTaxEntry[]
  subtotal: Decimal
  taxTotal: Decimal
  total: Decimal
}

export function computeInvoiceTotals(input: TotalsInput): InvoiceTotals {
  const currency = String(input.currency || input.accountDefaultCurrency || 'GBP').toUpperCase()
  const places = minorUnitsFor(currency)

  const lineItems = (input.lineItems ?? []).map((line, position) => {
    const quantity = toDecimal(line.quantity)
    const unitRate = toDecimal(line.unitRate)
    const taxRate = line.taxRate === null || line.taxRate === undefined
      ? null
      : toDecimal(line.taxRate)
    const lineTotal = round(quantity.times(unitRate), places)
    const taxAmount = round(taxRate ? lineTotal.times(taxRate) : ZERO, places)
    return {
      description: line.description ?? '',
      quantity,
      unitRate,
      taxRate,
      lineTotal,
      taxAmount,
      position,
    }
  })

  const subtotal = round(sum(lineItems.map((line) => line.lineTotal)), places)

  const taxEntries = (input.taxEntries ?? []).map((entry, position) => {
    const rate = toDecimal(entry.rate)
    return { label: entry.label, rate, amount: round(subtotal.times(rate), places), position }
  })

  // Named tax entries describe the whole invoice, so when there are any they *are*
  // the tax; the per-line rates are still worked out and shown, but adding both would
  // charge the same tax twice.
  const taxTotal = round(
    taxEntries.length > 0
      ? sum(taxEntries.map((entry) => entry.amount))
      : sum(lineItems.map((line) => line.taxAmount)),
    places
  )

  return {
    currency,
    lineItems,
    taxEntries,
    subtotal,
    taxTotal,
    total: round(subtotal.plus(taxTotal), places),
  }
}

const ZERO = new Decimal(0)

function sum(values: Decimal[]): Decimal {
  return values.reduce((running, value) => running.plus(value), ZERO)
}

function round(value: Decimal, places: number): Decimal {
  return value.toDecimalPlaces(places, Decimal.ROUND_HALF_UP)
}

/** Never route a money value through a JavaScript number on the way in. */
export function toDecimal(value: DecimalInput): Decimal {
  if (value instanceof Decimal) return value
  return new Decimal(typeof value === 'number' ? String(value) : value)
}

export { Decimal }
