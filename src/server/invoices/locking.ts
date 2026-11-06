import type { Prisma } from '@prisma/client'
import type { InvoiceStatus } from '@/lib/types'
import { badRequest, notFound } from '@/server/http/errors'

export interface LockedInvoice {
  id: number
  status: InvoiceStatus
  invoiceNumber: string
  issueDate: Date
  dueDate: Date
}

/** Lock one owned invoice so two state-changing requests cannot pass at once. */
export async function lockOwnedInvoice(
  tx: Prisma.TransactionClient,
  accountId: number,
  invoiceId: number
): Promise<LockedInvoice> {
  const rows = await tx.$queryRaw<LockedInvoice[]>`
    SELECT "id", "status", "invoiceNumber", "issueDate", "dueDate"
      FROM "Invoice"
     WHERE "id" = ${invoiceId} AND "accountId" = ${accountId}
     FOR UPDATE
  `
  if (rows.length === 0) throw notFound('That invoice')
  return { ...rows[0], status: rows[0].status as InvoiceStatus }
}

export function assertDraft(invoice: LockedInvoice, action = 'changed'): void {
  if (invoice.status === 'DRAFT') return
  throw badRequest(`Only a draft invoice can be ${action}. This invoice is ${invoice.status}.`)
}
