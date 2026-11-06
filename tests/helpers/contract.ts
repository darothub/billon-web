/**
 * The one place the tests name the server's internals.
 *
 * These tests were written before the server half existed, from the agreed design.
 * The module PATHS below come straight from that design and should be right. The
 * exported NAMES are the tests' assumption — if the build chose different ones,
 * rename them here and nowhere else, and every test file follows.
 *
 * Assumed surface:
 *   src/server/db/client.ts        prisma
 *   src/server/invoices/money.ts   computeInvoiceTotals
 *   src/server/invoices/numbering.ts  formatInvoiceNumber, allocateInvoiceNumber
 *   src/server/invoices/lifecycle.ts  canTransition, assertTransition, canDelete, stampFor
 *   src/server/auth/token.ts       signToken
 *   src/server/auth/password.ts    hashPassword, verifyPassword
 *   src/server/http/envelope.ts    ok, fail
 *   src/server/http/page.ts        parsePageParams, buildPage
 *   src/server/validation/*.ts     the Zod schemas
 *   src/server/jobs/markOverdue.ts markOverdue
 *   scripts/migrate/index.ts       runMigration
 */

export { prisma } from '@/server/db/client'

export { computeInvoiceTotals } from '@/server/invoices/money'
export { formatInvoiceNumber, allocateInvoiceNumber } from '@/server/invoices/numbering'
export {
  canTransition,
  assertTransition,
  canDelete,
  stampFor,
} from '@/server/invoices/lifecycle'

export { signToken } from '@/server/auth/token'
export { hashPassword, verifyPassword } from '@/server/auth/password'

export { ok, fail } from '@/server/http/envelope'
export { parsePageParams, buildPage } from '@/server/http/page'

export { createClientSchema, updateClientSchema } from '@/server/validation/clients'
export {
  createInvoiceSchema,
  updateInvoiceSchema,
  addLineItemSchema,
} from '@/server/validation/invoices'
export { updateProfileSchema } from '@/server/validation/profile'

export { markOverdue } from '@/server/jobs/markOverdue'

/** Anything money-shaped: a Prisma Decimal, a decimal string, or a plain number. */
export type MoneyLike = { toFixed(dp: number): string } | string | number
