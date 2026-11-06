import type { Prisma } from '@prisma/client'
import type { InvoiceDetail } from '@/lib/types'
import { prisma } from '@/server/db/client'
import { badRequest, conflict } from '@/server/http/errors'
import { recordActivity } from '@/server/activity/log'
import { parseDateOnly } from '@/server/util/format'
import type { UpdateInvoiceInput } from '@/server/validation/invoices'
import { lockOwnedInvoice, assertDraft } from './locking'
import { readInvoiceDetail } from './queries'
import { recalculateInvoice } from './recalculate'

/**
 * Changing an invoice from the edit page.
 *
 * Anything that changes what the figures are worked out from — the currency, the tax
 * entries — is followed by working them all out afresh, so what is stored always
 * describes the invoice as it now stands.
 */

export async function updateInvoice(
  accountId: number,
  id: number,
  input: UpdateInvoiceInput
): Promise<InvoiceDetail> {
  await prisma.$transaction(async (tx) => {
    const existing = await lockOwnedInvoice(tx, accountId, id)
    assertDraft(existing, 'edited')
    const data: Prisma.InvoiceUpdateInput = {}

    if (input.invoiceNumber !== undefined) {
      await assertNumberIsFree(tx, accountId, id, input.invoiceNumber)
      data.invoiceNumber = input.invoiceNumber
    }
    const issueDate = input.issueDate === undefined
      ? existing.issueDate
      : parseDateOnly(input.issueDate, 'issue date')
    const dueDate = input.dueDate === undefined
      ? existing.dueDate
      : parseDateOnly(input.dueDate, 'due date')
    if (dueDate < issueDate) throw badRequest('The due date cannot be before the issue date.')
    if (input.issueDate !== undefined) data.issueDate = issueDate
    if (input.dueDate !== undefined) data.dueDate = dueDate
    if (input.currency !== undefined) data.currency = input.currency
    if (input.taxLabel !== undefined) data.taxLabel = input.taxLabel
    if (input.note !== undefined) data.note = input.note ?? null

    await tx.invoice.update({ where: { id }, data })

    if (input.taxEntries !== undefined && input.taxEntries !== null) {
      await tx.invoiceTaxEntry.deleteMany({ where: { invoiceId: id } })
      if (input.taxEntries.length > 0) {
        await tx.invoiceTaxEntry.createMany({
          data: input.taxEntries.map((entry, position) => ({
            invoiceId: id,
            label: entry.label,
            rate: String(entry.rate),
            // Filled in a moment later by working the whole invoice out afresh.
            amount: '0',
            position,
          })),
        })
      }
    }

    await recalculateInvoice(tx, id)
    await recordActivity(
      { accountId, subject: 'invoice', subjectId: id, action: 'changed' },
      tx
    )
  })

  return readInvoiceDetail(accountId, id)
}

/**
 * A number typed on the edit page is checked against the account's other invoices
 * first, so the person gets a sentence rather than a database complaint.
 */
async function assertNumberIsFree(
  tx: Prisma.TransactionClient,
  accountId: number,
  id: number,
  invoiceNumber: string
): Promise<void> {
  const clash = await tx.invoice.findFirst({
    where: { accountId, invoiceNumber, NOT: { id } },
    select: { id: true },
  })
  if (clash) {
    throw conflict('That invoice number is already used by another invoice on your account.')
  }
}
