import type { Prisma } from '@prisma/client'
import type { InvoiceSummary, PageResponse } from '@/lib/types'
import { prisma } from '@/server/db/client'
import { buildPage, type PageParams } from '@/server/http/page'
import { toInvoiceSummary } from './serialize'

/**
 * The invoice list, with the three filters the screens already send: a status, a
 * client, and how to sort. It answers the invoices page, the dashboard's recent list
 * and the invoice list on a client's page — all three are the same request with
 * different filters.
 */

const SORTABLE = ['createdAt', 'issueDate', 'dueDate', 'invoiceNumber', 'total', 'status'] as const

export const INVOICE_SORT_FIELDS = SORTABLE

export interface InvoiceFilters {
  status?: string
  clientId?: number
}

export async function listInvoices(
  accountId: number,
  params: PageParams,
  filters: InvoiceFilters = {}
): Promise<PageResponse<InvoiceSummary>> {
  const where: Prisma.InvoiceWhereInput = { accountId }
  if (filters.status) where.status = filters.status.toUpperCase()
  if (filters.clientId) where.clientId = filters.clientId

  const [rows, totalElements] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: orderBy(params),
      skip: params.page * params.size,
      take: params.size,
      include: { client: { select: { name: true } } },
    }),
    prisma.invoice.count({ where }),
  ])

  return buildPage(rows.map(toInvoiceSummary), {
    page: params.page,
    size: params.size,
    totalElements,
  })
}

function orderBy(params: PageParams): Prisma.InvoiceOrderByWithRelationInput[] {
  // The second key means a page boundary cannot show the same invoice twice when two
  // of them share a created date to the microsecond.
  return [...primaryOrder(params), { id: 'desc' }]
}

function primaryOrder(params: PageParams): Prisma.InvoiceOrderByWithRelationInput[] {
  const direction = params.sort?.direction ?? 'desc'
  switch (params.sort?.field) {
    case 'createdAt':
      return [{ createdAt: direction }]
    case 'issueDate':
      return [{ issueDate: direction }]
    case 'dueDate':
      return [{ dueDate: direction }]
    case 'invoiceNumber':
      return [{ invoiceNumber: direction }]
    case 'total':
      return [{ total: direction }]
    case 'status':
      return [{ status: direction }]
    default:
      // Newest first, which is what the invoices page and the dashboard both want.
      return [{ createdAt: 'desc' }]
  }
}
