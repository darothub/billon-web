import { z } from 'zod'
import { isKnownCurrency } from '@/server/invoices/currency'

/**
 * The pieces every request check is built from.
 *
 * Every message here is written to be put straight in front of a person. Zod's own
 * defaults ('Expected number, received undefined') are type-checker language and are
 * replaced everywhere, because a screen shows whatever comes back.
 */

export const currencyField = z
  .string({
    required_error: 'Choose a currency for this invoice.',
    invalid_type_error: 'Choose a currency for this invoice.',
  })
  .trim()
  .length(3, 'A currency is a three-letter code, such as GBP.')
  .refine((code) => isKnownCurrency(code), {
    message: 'That is not a currency Billon knows. Use a code such as GBP, EUR or USD.',
  })
  .transform((code) => code.toUpperCase())

export const dateField = (what: string) =>
  z
    .string({
      required_error: `Enter the ${what}.`,
      invalid_type_error: `Enter the ${what}.`,
    })
    .regex(/^\d{4}-\d{2}-\d{2}$/, `The ${what} has to be a date, such as 2026-03-01.`)

export const requiredText = (what: string, max = 500) =>
  z
    .string({ required_error: `Enter ${what}.`, invalid_type_error: `Enter ${what}.` })
    .trim()
    .min(1, `Enter ${what}.`)
    .max(max, `That ${what.replace(/^(a|an|the) /, '')} is too long.`)

export const optionalText = (max = 2000) =>
  z
    .string({ invalid_type_error: 'That value has to be text.' })
    .trim()
    .max(max, 'That value is too long.')
    .optional()
    .nullable()

export const emailField = (what: string) =>
  z
    .string({ required_error: `Enter an email address for ${what}.`, invalid_type_error: `Enter an email address for ${what}.` })
    .trim()
    .min(1, `Enter an email address for ${what}.`)
    .email(`Enter a valid email address for ${what}.`)

export const taxRateField = z
  .number({ invalid_type_error: 'A tax rate is a fraction, such as 0.2 for 20%.' })
  .min(0, 'A tax rate cannot be negative.')
  .max(1, 'A tax rate is a fraction between 0 and 1 — use 0.2 for 20%, not 20.')

export const taxEntrySchema = z.object({
  label: requiredText('a name for this tax', 60),
  rate: taxRateField,
})

/** A due date is allowed to be the same day as the issue date, but never earlier. */
export function dueDateIsNotBeforeIssueDate(
  value: { issueDate?: string; dueDate?: string },
  ctx: z.RefinementCtx
): void {
  if (!value.issueDate || !value.dueDate) return
  if (value.dueDate < value.issueDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dueDate'],
      message: 'The due date cannot be before the issue date.',
    })
  }
}
