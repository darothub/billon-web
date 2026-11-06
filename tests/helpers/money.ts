import { expect } from 'vitest'
import type { MoneyLike } from './contract'

/**
 * Turn whatever the server handed back into a fixed-point string, without ever
 * routing it through a JavaScript number — because routing it through a number is
 * exactly the fault these helpers exist to catch.
 */
export function toFixedString(value: MoneyLike, dp: number): string {
  if (typeof value === 'number') return value.toFixed(dp)
  if (typeof value === 'string') return fixedFromString(value, dp)
  if (value && typeof (value as { toFixed?: unknown }).toFixed === 'function') {
    return (value as { toFixed(dp: number): string }).toFixed(dp)
  }
  throw new Error(`not a money value: ${String(value)}`)
}

function fixedFromString(value: string, dp: number): string {
  const negative = value.startsWith('-')
  const [whole, frac = ''] = value.replace('-', '').split('.')
  const padded = (frac + '0'.repeat(dp)).slice(0, dp)
  return `${negative ? '-' : ''}${whole}${dp > 0 ? `.${padded}` : ''}`
}

/** Assert a money value to the penny. */
export function expectMoney(actual: MoneyLike, expected: string): void {
  expect(toFixedString(actual, 2)).toBe(expected)
}

/**
 * Assert a money value carries no drift at all — not merely none visible at two
 * decimal places. A float that has accumulated error shows it here even when it
 * still rounds to the right penny, which is the failure that survives a naive test.
 */
export function expectExact(actual: MoneyLike, expected: string, dp = 10): void {
  expect(toFixedString(actual, dp)).toBe(fixedFromString(expected, dp))
}

/**
 * Is this value held exactly, rather than as an approximate binary float?
 * A JavaScript number cannot represent 0.10, so a money value arriving as one has
 * already lost the guarantee no matter what it currently prints as.
 */
export function isExactMoney(value: unknown): boolean {
  if (typeof value === 'number') return false
  if (typeof value === 'string') return /^-?\d+(\.\d+)?$/.test(value)
  return Boolean(value && typeof (value as { toFixed?: unknown }).toFixed === 'function')
}
