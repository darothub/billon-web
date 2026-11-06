import type { ClientDetail, ClientSummary } from '@/lib/types'
import { toIso } from '@/server/util/format'

/**
 * A client as the screens read it.
 *
 * The invoice count is counted from the invoices themselves rather than kept on the
 * client, so it can never drift out of step with what is really there.
 */

export interface ClientRow {
  id: number
  name: string
  email: string
  companyName: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  postcode: string | null
  country: string | null
  createdAt: Date
  updatedAt: Date
}

export function toClientSummary(row: ClientRow, invoiceCount: number): ClientSummary {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    companyName: row.companyName,
    invoiceCount,
    createdAt: toIso(row.createdAt) as string,
  }
}

export function toClientDetail(row: ClientRow, invoiceCount: number): ClientDetail {
  return {
    ...toClientSummary(row, invoiceCount),
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    postcode: row.postcode,
    country: row.country,
    updatedAt: toIso(row.updatedAt) as string,
  }
}
