import { describe, it, expect } from 'vitest'
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  addLineItemSchema,
  createClientSchema,
  updateProfileSchema,
} from '../helpers/contract'

/**
 * Bad input is refused politely, with a message a screen can put in front of a
 * person. Each case below checks both halves of that promise: that it is refused,
 * and that what comes back is a sentence rather than a stack trace.
 */

function refusalFor(schema: { safeParse(v: unknown): any }, value: unknown): string {
  const result = schema.safeParse(value)
  expect(result.success).toBe(false)
  const messages: string[] = result.error.issues.map((i: { message: string }) => i.message)
  const joined = messages.join(' | ')
  expect(joined.length).toBeGreaterThan(3)
  // Zod's own defaults leak type-checker language at people; these must be rewritten.
  expect(joined).not.toMatch(/Expected .* received|Invalid input|Required$/)
  return joined
}

const validInvoice = {
  clientId: 1,
  currency: 'GBP',
  issueDate: '2026-03-01',
  dueDate: '2026-03-31',
  lineItems: [{ description: 'Work', quantity: 1, unitRate: 100 }],
}

describe('refusing a bad invoice', () => {
  it('accepts a good one, so the refusals below mean something', () => {
    expect(createInvoiceSchema.safeParse(validInvoice).success).toBe(true)
  })

  it('refuses an invoice with no client', () => {
    const message = refusalFor(createInvoiceSchema, { ...validInvoice, clientId: undefined })
    expect(message).toMatch(/client/i)
  })

  it('refuses a due date earlier than the issue date', () => {
    const message = refusalFor(createInvoiceSchema, {
      ...validInvoice,
      issueDate: '2026-03-31',
      dueDate: '2026-03-01',
    })
    expect(message).toMatch(/due date/i)
  })

  it('accepts a due date equal to the issue date', () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      issueDate: '2026-03-01',
      dueDate: '2026-03-01',
    })
    expect(result.success).toBe(true)
  })

  it('refuses a negative quantity', () => {
    const message = refusalFor(createInvoiceSchema, {
      ...validInvoice,
      lineItems: [{ description: 'Work', quantity: -1, unitRate: 100 }],
    })
    expect(message).toMatch(/quantity/i)
  })

  it('refuses a quantity of zero', () => {
    refusalFor(createInvoiceSchema, {
      ...validInvoice,
      lineItems: [{ description: 'Work', quantity: 0, unitRate: 100 }],
    })
  })

  it('refuses a negative rate', () => {
    const message = refusalFor(createInvoiceSchema, {
      ...validInvoice,
      lineItems: [{ description: 'Work', quantity: 1, unitRate: -100 }],
    })
    expect(message).toMatch(/rate|amount/i)
  })

  it('refuses an unknown currency', () => {
    const message = refusalFor(createInvoiceSchema, { ...validInvoice, currency: 'ZZZ' })
    expect(message).toMatch(/currency/i)
  })

  it('refuses a currency that is not three letters', () => {
    refusalFor(createInvoiceSchema, { ...validInvoice, currency: 'pounds' })
  })

  it('refuses an invoice with no lines at all', () => {
    refusalFor(createInvoiceSchema, { ...validInvoice, lineItems: [] })
  })

  it('refuses a tax rate that is not a fraction between nought and one', () => {
    refusalFor(createInvoiceSchema, {
      ...validInvoice,
      lineItems: [{ description: 'Work', quantity: 1, unitRate: 100, taxRate: 20 }],
    })
  })
})

describe('refusing a bad change to an invoice', () => {
  it('refuses a due date moved before the issue date', () => {
    const message = refusalFor(updateInvoiceSchema, {
      issueDate: '2026-05-10',
      dueDate: '2026-05-01',
    })
    expect(message).toMatch(/due date/i)
  })

  it('refuses an unknown currency on an edit', () => {
    refusalFor(updateInvoiceSchema, { currency: 'XYZ' })
  })

  it('allows changing one field on its own', () => {
    expect(updateInvoiceSchema.safeParse({ note: 'Thanks!' }).success).toBe(true)
  })
})

describe('refusing a bad line', () => {
  it('refuses a line with no description', () => {
    refusalFor(addLineItemSchema, { description: '', quantity: 1, unitRate: 10 })
  })

  it('refuses a negative quantity on a single added line', () => {
    refusalFor(addLineItemSchema, { description: 'Work', quantity: -2, unitRate: 10 })
  })

  it('refuses a negative rate on a single added line', () => {
    refusalFor(addLineItemSchema, { description: 'Work', quantity: 2, unitRate: -10 })
  })
})

describe('refusing a bad client', () => {
  it('refuses a client with no name', () => {
    const message = refusalFor(createClientSchema, { name: '', email: 'a@b.example' })
    expect(message).toMatch(/name/i)
  })

  it('refuses an email that is not an email', () => {
    const message = refusalFor(createClientSchema, { name: 'Beta', email: 'not-an-email' })
    expect(message).toMatch(/email/i)
  })
})

describe('refusing a bad profile', () => {
  it('refuses an unknown default currency', () => {
    refusalFor(updateProfileSchema, {
      firstName: 'Ada',
      lastName: 'Lovelace',
      invoicePrefix: 'INV-',
      taxLabel: 'VAT',
      defaultCurrency: 'ZZZ',
    })
  })

  it('does not accept the next-number counter from the settings page', () => {
    const parsed = updateProfileSchema.parse({
      firstName: 'Ada',
      lastName: 'Lovelace',
      invoicePrefix: 'INV-',
      taxLabel: 'VAT',
      defaultCurrency: 'GBP',
      invoiceNextNumber: 9999,
    })
    expect((parsed as Record<string, unknown>).invoiceNextNumber).toBeUndefined()
  })
})
