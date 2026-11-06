import type { PrismaClient } from '@prisma/client'
import { minorUnitsFor } from '../../src/server/invoices/currency'

import type { Row } from './source'
import {
  date,
  decimal,
  legacyLogo,
  lineAmounts,
  maybeDate,
  maybeText,
  text,
  whole,
  type LegacyTaxEntry,
} from './values'

export type Target = PrismaClient

export async function upsertAccount(target: Target, row: Row): Promise<number> {
  const legacyId = whole(row.id)
  const logo = legacyLogo(row.logoUrl)
  const shared = {
    email: text(row.email).toLowerCase(),
    passwordHash: text(row.passwordHash),
    passwordAlgorithm: 'spring-bcrypt',
    firstName: text(row.firstName),
    lastName: text(row.lastName),
    defaultCurrency: text(row.defaultCurrency) || 'GBP',
    invoicePrefix: row.invoicePrefix === null ? 'INV' : text(row.invoicePrefix),
    invoiceNextNumber: whole(row.invoiceNextNumber, 1),
    taxLabel: text(row.taxLabel) || 'VAT',
    bankName: maybeText(row.bankName),
    bankAccountNumber: maybeText(row.bankAccountNumber),
    bankSortCode: maybeText(row.bankSortCode),
    paymentDetails: maybeText(row.paymentDetails),
    logoImage: logo?.image ?? null,
    logoMimeType: logo?.mimeType ?? null,
    logoUpdatedAt: logo ? (maybeDate(row.updatedAt) ?? date(row.createdAt)) : null,
    updatedAt: maybeDate(row.updatedAt) ?? date(row.createdAt),
  }

  const saved = await target.account.upsert({
    where: { legacyId },
    create: { legacyId, ...shared, createdAt: date(row.createdAt) },
    update: shared,
    select: { id: true },
  })
  return saved.id
}

export async function upsertClient(target: Target, row: Row, accountId: number): Promise<number> {
  const legacyId = whole(row.id)
  const shared = {
    accountId,
    name: text(row.name),
    email: text(row.email),
    companyName: maybeText(row.companyName),
    addressLine1: maybeText(row.addressLine1),
    addressLine2: maybeText(row.addressLine2),
    city: maybeText(row.city),
    postcode: maybeText(row.postcode),
    country: maybeText(row.country),
    updatedAt: maybeDate(row.updatedAt) ?? date(row.createdAt),
  }
  const saved = await target.client.upsert({
    where: { legacyId },
    create: { legacyId, ...shared, createdAt: date(row.createdAt) },
    update: shared,
    select: { id: true },
  })
  return saved.id
}

export async function upsertInvoice(
  target: Target,
  row: Row,
  accountId: number,
  clientId: number
): Promise<number> {
  const legacyId = whole(row.id)
  const shared = {
    accountId,
    clientId,
    invoiceNumber: text(row.invoiceNumber),
    status: text(row.status).toUpperCase() || 'DRAFT',
    issueDate: date(row.issueDate),
    dueDate: date(row.dueDate),
    currency: text(row.currency) || 'GBP',
    taxLabel: text(row.taxLabel) || 'VAT',
    note: maybeText(row.note),
    subtotal: decimal(row.subtotal),
    taxTotal: decimal(row.taxTotal),
    total: decimal(row.total),
    sentAt: maybeDate(row.sentAt),
    paidAt: maybeDate(row.paidAt),
    voidedAt: maybeDate(row.voidedAt),
    updatedAt: maybeDate(row.updatedAt) ?? date(row.createdAt),
  }
  const saved = await target.invoice.upsert({
    where: { legacyId },
    create: { legacyId, ...shared, createdAt: date(row.createdAt) },
    update: shared,
    select: { id: true },
  })
  return saved.id
}

export async function upsertLine(target: Target, row: Row, invoiceId: number): Promise<void> {
  const legacyId = whole(row.id)
  const amounts = lineAmounts(row)
  const shared = {
    invoiceId,
    description: text(row.description),
    quantity: decimal(row.quantity, '1'),
    unitRate: decimal(row.unitRate),
    taxRate: row.taxRate === null || row.taxRate === undefined ? null : decimal(row.taxRate),
    ...amounts,
    position: whole(row.position),
  }
  await target.invoiceLine.upsert({
    where: { legacyId },
    create: { legacyId, ...shared },
    update: shared,
  })
}

export async function pruneMigratedLines(
  target: Target,
  invoiceId: number,
  retainedLegacyIds: number[]
): Promise<void> {
  if (retainedLegacyIds.length > 0) {
    await target.invoiceLine.deleteMany({
      where: { invoiceId, legacyId: { notIn: retainedLegacyIds } },
    })
  } else {
    await target.invoiceLine.deleteMany({ where: { invoiceId, legacyId: { not: null } } })
  }
}

export async function replaceTaxEntries(
  target: Target,
  invoiceId: number,
  entries: LegacyTaxEntry[]
): Promise<void> {
  await target.$transaction(async (tx) => {
    await tx.invoiceTaxEntry.deleteMany({ where: { invoiceId } })
    if (entries.length === 0) return
    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } })
    const places = minorUnitsFor(invoice.currency)
    await tx.invoiceTaxEntry.createMany({
      data: entries.map((entry) => ({
        invoiceId,
        label: entry.label,
        rate: entry.rate,
        amount: invoice.subtotal.mul(entry.rate).toDecimalPlaces(places).toString(),
        position: entry.position,
      })),
    })
  })
}
