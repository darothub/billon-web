import type { Prisma } from '@prisma/client'
import type { ClientSummary, PageResponse } from '@/lib/types'
import { prisma } from '@/server/db/client'
import { buildPage, type PageParams } from '@/server/http/page'
import { toClientSummary } from './serialize'

/**
 * The clients list: paged, sortable, searchable, and carrying each client's invoice
 * count. The count comes back with the same query as the clients themselves, because
 * counting them one client at a time is how a list of forty becomes slow.
 */

const SORTABLE = ['name', 'email', 'createdAt', 'updatedAt'] as const

export const CLIENT_SORT_FIELDS = SORTABLE

export async function listClients(
  accountId: number,
  params: PageParams,
  search?: string
): Promise<PageResponse<ClientSummary>> {
  const where: Prisma.ClientWhereInput = { accountId }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [rows, totalElements] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: orderBy(params),
      skip: params.page * params.size,
      take: params.size,
      include: { _count: { select: { invoices: true } } },
    }),
    prisma.client.count({ where }),
  ])

  return buildPage(
    rows.map((row) => toClientSummary(row, row._count.invoices)),
    { page: params.page, size: params.size, totalElements }
  )
}

function orderBy(params: PageParams): Prisma.ClientOrderByWithRelationInput {
  const direction = params.sort?.direction ?? 'asc'
  switch (params.sort?.field) {
    case 'name':
      return { name: direction }
    case 'email':
      return { email: direction }
    case 'createdAt':
      return { createdAt: direction }
    case 'updatedAt':
      return { updatedAt: direction }
    default:
      // What every client dropdown expects when it asks for nothing in particular.
      return { name: 'asc' }
  }
}
