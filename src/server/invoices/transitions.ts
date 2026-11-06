import type { InvoiceDetail, InvoiceStatus } from '@/lib/types'
import { prisma } from '@/server/db/client'
import { recordActivity, statusChangeDetail } from '@/server/activity/log'
import { actionFor, assertDeletable, assertTransition, stampFor } from './lifecycle'
import { lockOwnedInvoice } from './locking'
import { readInvoiceDetail } from './queries'

/**
 * Moving an invoice from one state to the next, and removing a draft.
 *
 * A move that is not allowed changes nothing at all: the check happens before the
 * write, and nothing is written down as having happened either — a refused move that
 * still left an entry in the record would be worse than no record.
 */

export async function moveInvoice(
  accountId: number,
  id: number,
  to: InvoiceStatus
): Promise<InvoiceDetail> {
  const at = new Date()
  await prisma.$transaction(async (tx) => {
    const invoice = await lockOwnedInvoice(tx, accountId, id)
    assertTransition(invoice.status, to)
    await tx.invoice.update({
      where: { id },
      data: { status: to, ...stampFor(to, at) },
    })
    await recordActivity({
      accountId,
      subject: 'invoice',
      subjectId: id,
      action: actionFor(to),
      detail: statusChangeDetail(invoice.status, to),
    }, tx)
  })

  return readInvoiceDetail(accountId, id)
}

export async function deleteInvoice(accountId: number, id: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const invoice = await lockOwnedInvoice(tx, accountId, id)
    assertDeletable(invoice.status)
    await tx.invoice.delete({ where: { id } })
    await recordActivity({
      accountId,
      subject: 'invoice',
      subjectId: id,
      action: 'deleted',
      detail: `deleted ${invoice.invoiceNumber} while it was a draft`,
    }, tx)
  })
}
