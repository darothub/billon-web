import type { Prisma } from '@prisma/client'
import { notFound } from '@/server/http/errors'

/**
 * Handing out the next invoice number for an account.
 *
 * The counter is moved on and read back in a single statement, inside the same
 * transaction that saves the invoice. Reading it and then writing it back as two
 * steps is what lets two invoices raised at the same instant receive the same number;
 * one returning update makes that impossible. The unique rule in the database is the
 * second line of defence, so even a future bug elsewhere fails honestly.
 */

const PADDING = 4

export function formatInvoiceNumber(prefix: string, sequence: number): string {
  return `${prefix ?? ''}${String(sequence).padStart(PADDING, '0')}`
}

interface Allocated {
  invoicePrefix: string
  allocated: number
}

export async function allocateInvoiceNumber(
  tx: Prisma.TransactionClient,
  accountId: number
): Promise<string> {
  const rows = await tx.$queryRaw<Allocated[]>`
    UPDATE "Account"
       SET "invoiceNextNumber" = "invoiceNextNumber" + 1
     WHERE "id" = ${accountId}
    RETURNING "invoicePrefix", "invoiceNextNumber" - 1 AS "allocated"
  `

  if (rows.length === 0) throw notFound('That account')
  return formatInvoiceNumber(rows[0].invoicePrefix, Number(rows[0].allocated))
}
