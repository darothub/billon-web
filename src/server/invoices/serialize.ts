import type { Prisma } from '@prisma/client'
import type {
  InvoiceDetail,
  InvoiceLineItemResponse,
  InvoiceStatus,
  InvoiceSummary,
  TaxEntry,
} from '@/lib/types'
import { toClientDetail } from '@/server/clients/serialize'
import { toDateOnly, toIso, toNullableNumber, toNumber } from '@/server/util/format'

/**
 * An invoice as the screens read it.
 *
 * This is the one place a money value stops being an exact decimal and becomes an
 * ordinary number, because that is the shape the screens already expect. Nothing
 * downstream of here does arithmetic.
 */

export type InvoiceWithEverything = Prisma.InvoiceGetPayload<{
  include: { client: true; lineItems: true; taxEntries: true }
}>

export type InvoiceWithClientName = Prisma.InvoiceGetPayload<{
  include: { client: { select: { name: true } } }
}>

export function toInvoiceSummary(row: InvoiceWithClientName): InvoiceSummary {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    clientName: row.client.name,
    status: row.status as InvoiceStatus,
    issueDate: toDateOnly(row.issueDate),
    dueDate: toDateOnly(row.dueDate),
    currency: row.currency,
    total: toNumber(row.total),
    createdAt: toIso(row.createdAt) as string,
  }
}

export function toInvoiceDetail(
  row: InvoiceWithEverything,
  clientInvoiceCount: number
): InvoiceDetail {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    client: toClientDetail(row.client, clientInvoiceCount),
    status: row.status as InvoiceStatus,
    issueDate: toDateOnly(row.issueDate),
    dueDate: toDateOnly(row.dueDate),
    currency: row.currency,
    taxLabel: row.taxLabel,
    taxEntries: row.taxEntries
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(toTaxEntry),
    note: row.note,
    lineItems: row.lineItems
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(toLineItem),
    subtotal: toNumber(row.subtotal),
    taxTotal: toNumber(row.taxTotal),
    total: toNumber(row.total),
    sentAt: toIso(row.sentAt),
    paidAt: toIso(row.paidAt),
    voidedAt: toIso(row.voidedAt),
    createdAt: toIso(row.createdAt) as string,
    updatedAt: toIso(row.updatedAt) as string,
  }
}

function toTaxEntry(entry: { label: string; rate: Prisma.Decimal }): TaxEntry {
  return { label: entry.label, rate: toNumber(entry.rate) }
}

function toLineItem(line: InvoiceWithEverything['lineItems'][number]): InvoiceLineItemResponse {
  return {
    id: line.id,
    description: line.description,
    quantity: toNumber(line.quantity),
    unitRate: toNumber(line.unitRate),
    taxRate: toNullableNumber(line.taxRate),
    lineTotal: toNumber(line.lineTotal),
    taxAmount: toNumber(line.taxAmount),
    position: line.position,
  }
}
