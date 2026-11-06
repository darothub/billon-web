import { describe, it, expect } from 'vitest'
import { computeInvoiceTotals } from '../helpers/contract'
import { expectMoney, expectExact, isExactMoney } from '../helpers/money'

/**
 * The money calculator. This is one of the two places where a mistake reaches a
 * paying customer, so these tests are deliberately arithmetic-specific: changing a
 * rounding rule or a multiplication has to break something here.
 */
describe('working out the money on an invoice', () => {
  it('handles several different tax rates on one invoice', () => {
    const result = computeInvoiceTotals({
      currency: 'GBP',
      lineItems: [
        { description: 'Standard rated', quantity: 2, unitRate: 100, taxRate: 0.2 },
        { description: 'Reduced rated', quantity: 1, unitRate: 200, taxRate: 0.05 },
        { description: 'Zero rated', quantity: 3, unitRate: 50, taxRate: 0 },
        { description: 'No tax given', quantity: 1, unitRate: 40 },
      ],
    })

    // 200 + 200 + 150 + 40
    expectMoney(result.subtotal, '590.00')
    // 40.00 + 10.00 + 0.00 + 0.00
    expectMoney(result.taxTotal, '50.00')
    expectMoney(result.total, '640.00')

    expectMoney(result.lineItems[0].lineTotal, '200.00')
    expectMoney(result.lineItems[0].taxAmount, '40.00')
    expectMoney(result.lineItems[1].taxAmount, '10.00')
    expectMoney(result.lineItems[2].taxAmount, '0.00')
    expectMoney(result.lineItems[3].taxAmount, '0.00')
  })

  it('rounds an awkward amount to the penny rather than truncating it', () => {
    // 3 x 33.335 = 100.005 — the classic half-penny that a truncating or
    // float-rounding implementation gets wrong.
    const result = computeInvoiceTotals({
      currency: 'GBP',
      lineItems: [{ description: 'Hours', quantity: 3, unitRate: 33.335, taxRate: 0.175 }],
    })

    expectMoney(result.subtotal, '100.01')
    // 100.005 x 0.175 = 17.500875 -> 17.50
    expectMoney(result.taxTotal, '17.50')
    expectMoney(result.total, '117.51')
  })

  it('rounds each half-penny up rather than to the nearest even number', () => {
    const result = computeInvoiceTotals({
      currency: 'GBP',
      lineItems: [
        { description: 'a', quantity: 1, unitRate: 0.125 },
        { description: 'b', quantity: 1, unitRate: 0.135 },
      ],
    })
    // Banker's rounding would give 0.12 and 0.14; an invoice rounds half away from zero.
    expectMoney(result.lineItems[0].lineTotal, '0.13')
    expectMoney(result.lineItems[1].lineTotal, '0.14')
    expectMoney(result.total, '0.27')
  })

  it('uses the invoice currency, not the account default, to decide the smallest unit', () => {
    // The account's default is GBP; this invoice is in JPY, which has no minor unit.
    const result = computeInvoiceTotals({
      currency: 'JPY',
      accountDefaultCurrency: 'GBP',
      lineItems: [{ description: 'Translation', quantity: 3, unitRate: 1333.4, taxRate: 0.1 }],
    })

    expectMoney(result.subtotal, '4000.00')
    expect(String(result.currency)).toBe('JPY')
    // 4000 x 0.1 — a whole number of yen, no fractional part invented.
    expect(Number(String(result.total)) % 1).toBe(0)
    expectExact(result.total, '4400', 0)
  })

  it('works out each named tax entry as well as the per-line tax', () => {
    const result = computeInvoiceTotals({
      currency: 'GBP',
      lineItems: [{ description: 'Build', quantity: 1, unitRate: 1000 }],
      taxEntries: [
        { label: 'VAT', rate: 0.2 },
        { label: 'City levy', rate: 0.015 },
      ],
    })

    expectMoney(result.subtotal, '1000.00')
    expectMoney(result.taxEntries[0].amount, '200.00')
    expectMoney(result.taxEntries[1].amount, '15.00')
    expectMoney(result.taxTotal, '215.00')
    expectMoney(result.total, '1215.00')
  })

  it('adds many awkward amounts with no penny of drift', () => {
    // 10,000 lines of 0.07. In ordinary floating point this accumulates visible
    // error; held exactly it is 700 to as many places as you care to look.
    const lineItems = Array.from({ length: 10_000 }, (_, i) => ({
      description: `Item ${i}`,
      quantity: 1,
      unitRate: 0.07,
    }))
    const result = computeInvoiceTotals({ currency: 'GBP', lineItems })

    expectMoney(result.subtotal, '700.00')
    expectExact(result.subtotal, '700', 10)
    expectExact(result.total, '700', 10)
  })

  it('holds amounts exactly rather than as approximate decimal numbers', () => {
    const result = computeInvoiceTotals({
      currency: 'GBP',
      lineItems: [
        { description: 'a', quantity: 1, unitRate: 0.1, taxRate: 0.2 },
        { description: 'b', quantity: 1, unitRate: 0.2, taxRate: 0.2 },
      ],
    })

    expect(isExactMoney(result.subtotal)).toBe(true)
    expect(isExactMoney(result.taxTotal)).toBe(true)
    expect(isExactMoney(result.total)).toBe(true)
    // 0.1 + 0.2 is the textbook float failure; exactly held it is 0.30, not 0.30000000000000004.
    expectExact(result.subtotal, '0.30', 17)
  })

  it('ignores totals that arrived in the request', () => {
    const result = computeInvoiceTotals({
      currency: 'GBP',
      lineItems: [{ description: 'Work', quantity: 1, unitRate: 100, taxRate: 0.2 }],
      // A caller trying to dictate the figures.
      subtotal: 1,
      taxTotal: 0,
      total: 1,
    } as never)

    expectMoney(result.subtotal, '100.00')
    expectMoney(result.taxTotal, '20.00')
    expectMoney(result.total, '120.00')
  })
})
