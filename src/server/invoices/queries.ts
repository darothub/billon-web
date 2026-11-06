import type { InvoiceDetail, InvoiceStatus } from '@/lib/types'
import { prisma } from '@/server/db/client'
import { notFound } from '@/server/http/errors'
import { toInvoiceDetail } from './serialize'

/**
 * Reading one invoice, always filtered by the account it belongs to.
 *
 * Everything that acts on an invoice starts here, so no handler has to remember to
 * check who owns it — asking for somebody else's simply finds nothing.
 */

export interface OwnedInvoice {
  id: number
  status: InvoiceStatus
  invoiceNumber: string
  currency: string
  clientId: number
  accountId: number
}

export async function findOwnedInvoice(accountId: number, id: number): Promise<OwnedInvoice> {
  const row = await prisma.invoice.findFirst({
    where: { id, accountId },
    select: {
      id: true,
      status: true,
      invoiceNumber: true,
      currency: true,
      clientId: true,
      accountId: true,
    },
  })
  if (!row) throw notFound('That invoice')
  return { ...row, status: row.status as InvoiceStatus }
}

/** The whole invoice, with its client, its lines and its tax entries. */
export async function readInvoiceDetail(accountId: number, id: number): Promise<InvoiceDetail> {
  const row = await prisma.invoice.findFirst({
    where: { id, accountId },
    include: { client: true, lineItems: true, taxEntries: true },
  })
  if (!row) throw notFound('That invoice')

  const clientInvoiceCount = await prisma.invoice.count({ where: { clientId: row.clientId } })
  return toInvoiceDetail(row, clientInvoiceCount)
}
