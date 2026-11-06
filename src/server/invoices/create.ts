import type { InvoiceDetail } from '@/lib/types'
import { prisma } from '@/server/db/client'
import { badRequest, unauthorised } from '@/server/http/errors'
import { recordActivity } from '@/server/activity/log'
import { parseDateOnly } from '@/server/util/format'
import type { CreateInvoiceInput } from '@/server/validation/invoices'
import { computeInvoiceTotals } from './money'
import { allocateInvoiceNumber } from './numbering'
import { readInvoiceDetail } from './queries'
import { money } from './recalculate'

/**
 * Raising an invoice, lines and tax entries and all, in one go.
 *
 * Everything that can be refused is checked before the transaction opens, so a
 * refused invoice never burns an invoice number. Inside the transaction only two
 * things happen: the account's counter moves on, and the invoice is written — which
 * is what makes two invoices raised at the same instant impossible to give the same
 * number.
 */

export async function createInvoice(
  accountId: number,
  input: CreateInvoiceInput
): Promise<InvoiceDetail> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { taxLabel: true, defaultCurrency: true },
  })
  if (!account) throw unauthorised()

  // The client is checked against this account, so nobody can raise an invoice
  // against somebody else's client by putting their record number in the request.
  const client = await prisma.client.findFirst({
    where: { id: input.clientId, accountId },
    select: { id: true },
  })
  if (!client) throw badRequest('That client could not be found on your account.')

  const issueDate = parseDateOnly(input.issueDate, 'issue date')
  const dueDate = parseDateOnly(input.dueDate, 'due date')

  const totals = computeInvoiceTotals({
    currency: input.currency,
    accountDefaultCurrency: account.defaultCurrency,
    lineItems: input.lineItems,
    taxEntries: input.taxEntries ?? [],
  })

  const created = await prisma.$transaction(
    async (tx) => {
      const automaticNumber = await allocateInvoiceNumber(tx, accountId)
      const invoiceNumber = input.invoiceNumber?.trim() || automaticNumber

      const invoice = await tx.invoice.create({
        data: {
          accountId,
          clientId: input.clientId,
          invoiceNumber,
          status: 'DRAFT',
          issueDate,
          dueDate,
          currency: totals.currency,
          taxLabel: input.taxLabel?.trim() || account.taxLabel,
          note: input.note ?? null,
          subtotal: money(totals.subtotal),
          taxTotal: money(totals.taxTotal),
          total: money(totals.total),
          lineItems: {
            create: totals.lineItems.map((line) => ({
              description: line.description,
              quantity: money(line.quantity),
              unitRate: money(line.unitRate),
              taxRate: line.taxRate === null ? null : money(line.taxRate),
              lineTotal: money(line.lineTotal),
              taxAmount: money(line.taxAmount),
              position: line.position,
            })),
          },
          taxEntries: {
            create: totals.taxEntries.map((entry) => ({
              label: entry.label,
              rate: money(entry.rate),
              amount: money(entry.amount),
              position: entry.position,
            })),
          },
        },
        select: { id: true, invoiceNumber: true },
      })
      await recordActivity({
        accountId,
        subject: 'invoice',
        subjectId: invoice.id,
        action: 'created',
        detail: `raised as ${invoice.invoiceNumber}`,
      }, tx)
      return invoice
    },
    { maxWait: 20_000, timeout: 20_000 }
  )

  return readInvoiceDetail(accountId, created.id)
}
