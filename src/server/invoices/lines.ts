import type { InvoiceDetail } from '@/lib/types'
import { prisma } from '@/server/db/client'
import { badRequest, notFound } from '@/server/http/errors'
import { recordActivity } from '@/server/activity/log'
import type { AddLineItemInput } from '@/server/validation/invoices'
import { assertDraft, lockOwnedInvoice } from './locking'
import { readInvoiceDetail } from './queries'
import { recalculateInvoice } from './recalculate'

/**
 * The line editor on the edit page, which adds and removes lines one at a time.
 *
 * Both ways round, the whole invoice is worked out again afterwards and handed back,
 * so the page never has to add anything up for itself.
 */

export async function addLineItem(
  accountId: number,
  invoiceId: number,
  input: AddLineItemInput
): Promise<InvoiceDetail> {
  await prisma.$transaction(async (tx) => {
    const invoice = await lockOwnedInvoice(tx, accountId, invoiceId)
    assertDraft(invoice, 'changed')
    const last = await tx.invoiceLine.findFirst({
      where: { invoiceId },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    await tx.invoiceLine.create({
      data: {
        invoiceId,
        description: input.description,
        quantity: String(input.quantity),
        unitRate: String(input.unitRate),
        taxRate: input.taxRate === null || input.taxRate === undefined
          ? null
          : String(input.taxRate),
        // Worked out a moment later, from the invoice as a whole.
        lineTotal: '0',
        taxAmount: '0',
        position: last ? last.position + 1 : 0,
      },
    })

    await recalculateInvoice(tx, invoiceId)
    await recordActivity({
      accountId,
      subject: 'invoice',
      subjectId: invoiceId,
      action: 'line added',
    }, tx)
  })

  return readInvoiceDetail(accountId, invoiceId)
}

export async function removeLineItem(
  accountId: number,
  invoiceId: number,
  lineItemId: number
): Promise<InvoiceDetail> {
  await prisma.$transaction(async (tx) => {
    const invoice = await lockOwnedInvoice(tx, accountId, invoiceId)
    assertDraft(invoice, 'changed')
    const line = await tx.invoiceLine.findFirst({
      where: { id: lineItemId, invoiceId },
      select: { id: true },
    })
    if (!line) throw notFound('That line')
    await tx.invoiceLine.delete({ where: { id: lineItemId } })
    await recalculateInvoice(tx, invoiceId)
    await recordActivity({
      accountId,
      subject: 'invoice',
      subjectId: invoiceId,
      action: 'line removed',
      detail: `line ${lineItemId}`,
    }, tx)
  })

  return readInvoiceDetail(accountId, invoiceId)
}
