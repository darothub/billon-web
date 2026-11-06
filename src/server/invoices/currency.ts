/**
 * Which currencies Billon knows, and how many places each one splits into.
 *
 * The number of places is what decides the rounding on an invoice: two for a pound,
 * none at all for a yen. It is taken from the invoice's own currency, never from the
 * account's default, because an invoice raised in yen must not grow a fractional part
 * just because its owner usually bills in pounds.
 */

const MINOR_UNITS: Record<string, number> = {
  AUD: 2,
  BRL: 2,
  CAD: 2,
  CHF: 2,
  CNY: 2,
  CZK: 2,
  DKK: 2,
  EUR: 2,
  GBP: 2,
  HKD: 2,
  HUF: 2,
  ILS: 2,
  INR: 2,
  ISK: 0,
  JPY: 0,
  KRW: 0,
  MXN: 2,
  MYR: 2,
  NGN: 2,
  NOK: 2,
  NZD: 2,
  PHP: 2,
  PLN: 2,
  RON: 2,
  SEK: 2,
  SGD: 2,
  THB: 2,
  TRY: 2,
  TWD: 2,
  USD: 2,
  VND: 0,
  ZAR: 2,
}

export const KNOWN_CURRENCIES = Object.keys(MINOR_UNITS).sort()

export function isKnownCurrency(code: unknown): boolean {
  return typeof code === 'string' && code.toUpperCase() in MINOR_UNITS
}

/** How many decimal places this currency rounds to. Two, unless it is one of the few. */
export function minorUnitsFor(code: string): number {
  return MINOR_UNITS[code.toUpperCase()] ?? 2
}
