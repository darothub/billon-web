import type { Prisma } from '@prisma/client'
import { computeInvoiceTotals, type Decimal } from './money'

/**
 * Work every figure on a saved invoice out again from its lines and its tax entries.
 *
 * Anything that changes what an invoice is made of — a line added, a line removed, the
 * currency or the tax entries changed — ends here, so the stored figures are never
 * left describing an older version of the invoice.
 */

export function money(value: Decimal): string {
  return value.toString()
}

export async function recalculateInvoice(
  tx: Prisma.TransactionClient,
  invoiceId: number
): Promise<void> {
  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      lineItems: { orderBy: { position: 'asc' } },
      taxEntries: { orderBy: { position: 'asc' } },
    },
  })

  const totals = computeInvoiceTotals({
    currency: invoice.currency,
    lineItems: invoice.lineItems.map((line) => ({
      description: line.description,
      quantity: line.quantity.toString(),
      unitRate: line.unitRate.toString(),
      taxRate: line.taxRate === null ? null : line.taxRate.toString(),
    })),
    taxEntries: invoice.taxEntries.map((entry) => ({
      label: entry.label,
      rate: entry.rate.toString(),
    })),
  })

  await Promise.all(
    invoice.lineItems.map((line, index) =>
      tx.invoiceLine.update({
        where: { id: line.id },
        data: {
          lineTotal: money(totals.lineItems[index].lineTotal),
          taxAmount: money(totals.lineItems[index].taxAmount),
        },
      })
    )
  )

  await Promise.all(
    invoice.taxEntries.map((entry, index) =>
      tx.invoiceTaxEntry.update({
        where: { id: entry.id },
        data: { amount: money(totals.taxEntries[index].amount) },
      })
    )
  )

  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      subtotal: money(totals.subtotal),
      taxTotal: money(totals.taxTotal),
      total: money(totals.total),
    },
  })
}
