import { describe, it, expect } from 'vitest'
import { formatInvoiceNumber } from '../helpers/contract'

/**
 * How an invoice number is spelled. The allocation itself — moving the counter on
 * safely — needs a real database and lives in tests/db/numbering-concurrency.test.ts;
 * this file pins the part that decides what a person actually sees.
 *
 * ASSUMPTION, needs confirming against the Java service before this file is trusted:
 * that numbers are padded to four digits. If the Java service wrote 'INV-1' rather
 * than 'INV-0001', change the expectations here — but change them from real invoice
 * numbers taken out of the live database, not from preference, because an existing
 * account's sequence has to carry on looking the way it already looks.
 */
describe('spelling an invoice number', () => {
  it('puts the account prefix in front of the number', () => {
    expect(formatInvoiceNumber('INV-', 1)).toBe('INV-0001')
  })

  it('keeps the numbers sortable by padding short ones', () => {
    expect(formatInvoiceNumber('INV-', 7)).toBe('INV-0007')
    expect(formatInvoiceNumber('INV-', 42)).toBe('INV-0042')
    expect(formatInvoiceNumber('INV-', 999)).toBe('INV-0999')
  })

  it('does not truncate a number that has outgrown the padding', () => {
    expect(formatInvoiceNumber('INV-', 12345)).toBe('INV-12345')
    expect(formatInvoiceNumber('INV-', 1_000_000)).toBe('INV-1000000')
  })

  it('respects whatever prefix the account chose, including an empty one', () => {
    expect(formatInvoiceNumber('2026/', 3)).toBe('2026/0003')
    expect(formatInvoiceNumber('', 3)).toBe('0003')
  })
})
