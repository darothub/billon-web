import type { InvoiceDetail } from '@/lib/types'
import { recordActivity } from '@/server/activity/log'
import { prisma } from '@/server/db/client'
import { MailDeliveryError, sendEmail } from '@/server/email/sender'
import { ApiError } from '@/server/http/errors'
import { renderInvoicePdf } from '@/server/pdf/render'
import { assertDraft, lockOwnedInvoice } from './locking'
import { readInvoiceDetail } from './queries'

export interface DeliveryDependencies {
  renderPdf: typeof renderInvoicePdf
  deliver: typeof sendEmail
}

const DELIVERY: DeliveryDependencies = { renderPdf: renderInvoicePdf, deliver: sendEmail }

/**
 * The send button.
 *
 * A row lock makes simultaneous clicks serialize. The status changes only after the
 * PDF exists and the mail provider accepts one message. A delivery failure records a
 * safe outcome and leaves the invoice draft.
 */

export async function sendInvoice(
  accountId: number,
  id: number,
  delivery: DeliveryDependencies = DELIVERY
): Promise<InvoiceDetail> {
  let deliveryStarted = false
  let failureAction = 'delivery failed'
  try {
    await prisma.$transaction(async (tx) => {
      const locked = await lockOwnedInvoice(tx, accountId, id)
      assertDraft(locked, 'sent')
      deliveryStarted = true
      const invoice = await readInvoiceDetail(accountId, id)
      const pdf = await delivery.renderPdf(accountId, id)
      failureAction = 'email failed'
      await delivery.deliver({
        to: invoice.client.email,
        subject: `Invoice ${invoice.invoiceNumber}`,
        text: `Please find invoice ${invoice.invoiceNumber} attached, due ${invoice.dueDate}.`,
        attachments: [{
          filename: pdf.fileName,
          content: pdf.body,
          contentType: 'application/pdf',
        }],
      })
      failureAction = 'delivery finalization failed'
      const at = new Date()
      await tx.invoice.update({ where: { id }, data: { status: 'SENT', sentAt: at } })
      await recordActivity({
        accountId,
        subject: 'invoice',
        subjectId: id,
        action: 'emailed',
        detail: 'mail provider accepted one PDF attachment',
      }, tx)
      await recordActivity({
        accountId,
        subject: 'invoice',
        subjectId: id,
        action: 'sent',
        detail: 'status DRAFT to SENT',
      }, tx)
    }, { maxWait: 10_000, timeout: 60_000 })
  } catch (error) {
    if (deliveryStarted) {
      const detail = error instanceof MailDeliveryError
        ? error.message
        : 'The invoice could not be delivered and finalized.'
      await recordActivity({
        accountId,
        subject: 'invoice',
        subjectId: id,
        action: failureAction,
        detail,
      })
      throw new ApiError(502, detail)
    }
    throw error
  }
  return readInvoiceDetail(accountId, id)
}
