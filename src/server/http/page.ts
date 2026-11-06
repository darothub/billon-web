import type { PageResponse } from '@/lib/types'
import { badRequest } from './errors'

/**
 * The paging the screens send, and the page shape they read back.
 *
 * The shape is a Java convention the screens already depend on — content, page, size,
 * totalElements, totalPages, first, last — so it is built here once rather than
 * reinvented, slightly differently, by each address.
 */

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 200

/**
 * A sort field ends up in a query, so it is checked against a known list rather than
 * trusted. Anything not named here is refused.
 */
export const SORTABLE_FIELDS = [
  'name',
  'email',
  'createdAt',
  'updatedAt',
  'issueDate',
  'dueDate',
  'invoiceNumber',
  'status',
  'total',
] as const

export interface SortOrder {
  field: string
  direction: 'asc' | 'desc'
}

export interface PageParams {
  page: number
  size: number
  sort: SortOrder | null
}

type QueryValue = string | string[] | number | undefined

export function parsePageParams(
  query: Record<string, QueryValue>,
  allowed: readonly string[] = SORTABLE_FIELDS
): PageParams {
  return {
    page: Math.max(0, wholeNumber(query.page, 0)),
    size: Math.min(MAX_PAGE_SIZE, Math.max(1, wholeNumber(query.size, DEFAULT_PAGE_SIZE))),
    sort: parseSort(first(query.sort), allowed),
  }
}

function parseSort(raw: string | undefined, allowed: readonly string[]): SortOrder | null {
  if (!raw) return null
  const [field, direction = 'asc'] = raw.split(',').map((part) => part.trim())
  if (!allowed.includes(field)) {
    throw badRequest(`Sorting by '${field}' is not something this list can do.`)
  }
  if (direction !== 'asc' && direction !== 'desc') {
    throw badRequest(`'${direction}' is not a direction to sort in — use asc or desc.`)
  }
  return { field, direction }
}

export function buildPage<T>(
  content: T[],
  meta: { page: number; size: number; totalElements: number }
): PageResponse<T> {
  const size = Math.max(1, meta.size)
  const totalPages = meta.totalElements === 0 ? 0 : Math.ceil(meta.totalElements / size)
  return {
    content,
    page: meta.page,
    size: meta.size,
    totalElements: meta.totalElements,
    totalPages,
    first: meta.page <= 0,
    last: meta.page >= totalPages - 1,
  }
}

function first(value: QueryValue): string | undefined {
  if (Array.isArray(value)) return value[0]
  if (value === undefined) return undefined
  return String(value)
}

function wholeNumber(value: QueryValue, fallback: number): number {
  const raw = first(value)
  if (raw === undefined || raw === '') return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
}
