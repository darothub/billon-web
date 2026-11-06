import { z } from 'zod'
import {
  currencyField,
  dateField,
  dueDateIsNotBeforeIssueDate,
  optionalText,
  requiredText,
  taxEntrySchema,
  taxRateField,
} from './common'

/**
 * What an invoice may be raised or changed with.
 *
 * No total appears anywhere below. Billon works the figures out itself, so a set of
 * totals sent by a screen is dropped rather than believed.
 */

export const addLineItemSchema = z.object({
  description: requiredText('a description for this line', 500),
  quantity: z
    .number({
      required_error: 'Enter a quantity for this line.',
      invalid_type_error: 'A quantity has to be a number.',
    })
    .gt(0, 'A quantity has to be more than zero.'),
  unitRate: z
    .number({
      required_error: 'Enter a unit rate for this line.',
      invalid_type_error: 'A unit rate has to be a number.',
    })
    .min(0, 'A unit rate cannot be negative.'),
  taxRate: taxRateField.optional().nullable(),
})

export const createInvoiceSchema = z
  .object({
    clientId: z
      .number({
        required_error: 'Choose a client for this invoice.',
        invalid_type_error: 'Choose a client for this invoice.',
      })
      .int('Choose a client for this invoice.')
      .positive('Choose a client for this invoice.'),
    invoiceNumber: z.string().trim().max(60, 'That invoice number is too long.').optional(),
    currency: currencyField,
    issueDate: dateField('issue date'),
    dueDate: dateField('due date'),
    taxLabel: z.string().trim().max(60, 'That tax name is too long.').optional(),
    note: optionalText(2000),
    lineItems: z
      .array(addLineItemSchema, {
        required_error: 'An invoice needs at least one line.',
        invalid_type_error: 'An invoice needs at least one line.',
      })
      .min(1, 'An invoice needs at least one line.'),
    taxEntries: z.array(taxEntrySchema).optional().nullable(),
  })
  .superRefine(dueDateIsNotBeforeIssueDate)

export const updateInvoiceSchema = z
  .object({
    invoiceNumber: z.string().trim().min(1, 'An invoice number cannot be blank.').max(60).optional(),
    issueDate: dateField('issue date').optional(),
    dueDate: dateField('due date').optional(),
    currency: currencyField.optional(),
    taxLabel: z.string().trim().max(60, 'That tax name is too long.').optional(),
    note: optionalText(2000),
    taxEntries: z.array(taxEntrySchema).optional().nullable(),
  })
  .superRefine(dueDateIsNotBeforeIssueDate)

export type AddLineItemInput = z.infer<typeof addLineItemSchema>
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>
