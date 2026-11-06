import type { Prisma } from '@prisma/client'
import { badRequest } from '@/server/http/errors'

/**
 * Turning what the database holds into what the screens read.
 *
 * Money is exact right up to this point and becomes an ordinary number only here,
 * because a plain number is the shape the screens already expect. Calendar days go
 * out as 'YYYY-MM-DD', which is what a date field on a form reads; moments go out in
 * full.
 */

type DecimalLike = Prisma.Decimal | { toString(): string }

export function toNumber(value: DecimalLike | null | undefined): number {
  if (value === null || value === undefined) return 0
  return Number(value.toString())
}

export function toNullableNumber(value: DecimalLike | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value.toString())
}

/** A calendar day, with no time of day: '2026-03-01'. */
export function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

/** A moment, in full, or null if it never happened. */
export function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

/** Read a 'YYYY-MM-DD' from a request as the calendar day it names. */
export function parseDateOnly(value: string, what: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw badRequest(`The ${what} has to be a date, such as 2026-03-01.`)
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest(`${value} is not a real date.`)
  }
  return parsed
}

/** Midnight this morning, as a calendar day — what 'past its due date' is measured against. */
export function startOfToday(now: Date = new Date()): Date {
  return new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`)
}
