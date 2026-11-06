import type { ClientDetail } from '@/lib/types'
import { prisma } from '@/server/db/client'
import { badRequest, notFound } from '@/server/http/errors'
import { recordActivity } from '@/server/activity/log'
import type { CreateClientInput, UpdateClientInput } from '@/server/validation/clients'
import { toClientDetail } from './serialize'

/**
 * Creating, reading, changing and deleting one account's clients.
 *
 * Every read and write is filtered by the account from the sign-in token. Asking for
 * somebody else's client by putting their record number in the address simply finds
 * nothing, which is refused as 'not found' — a refusal that also declines to confirm
 * the record exists at all.
 */

export async function readClient(accountId: number, id: number): Promise<ClientDetail> {
  const row = await prisma.client.findFirst({
    where: { id, accountId },
    include: { _count: { select: { invoices: true } } },
  })
  if (!row) throw notFound('That client')
  return toClientDetail(row, row._count.invoices)
}

export async function createClient(
  accountId: number,
  input: CreateClientInput
): Promise<ClientDetail> {
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.client.create({
      data: { ...writable(input), accountId },
      include: { _count: { select: { invoices: true } } },
    })
    await recordActivity(
      { accountId, subject: 'client', subjectId: created.id, action: 'created' },
      tx
    )
    return created
  })
  return toClientDetail(row, row._count.invoices)
}

export async function updateClient(
  accountId: number,
  id: number,
  input: UpdateClientInput
): Promise<ClientDetail> {
  const existing = await prisma.client.findFirst({ where: { id, accountId }, select: { id: true } })
  if (!existing) throw notFound('That client')

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.client.update({
      where: { id },
      data: writable(input),
      include: { _count: { select: { invoices: true } } },
    })
    await recordActivity(
      { accountId, subject: 'client', subjectId: id, action: 'changed' },
      tx
    )
    return updated
  })
  return toClientDetail(row, row._count.invoices)
}

export async function deleteClient(accountId: number, id: number): Promise<void> {
  const existing = await prisma.client.findFirst({
    where: { id, accountId },
    select: { id: true, _count: { select: { invoices: true } } },
  })
  if (!existing) throw notFound('That client')

  if (existing._count.invoices > 0) {
    throw badRequest(
      `That client still has ${existing._count.invoices} ` +
        `invoice${existing._count.invoices === 1 ? '' : 's'}. ` +
        'Remove or void those first, so no invoice is left without who it was for.'
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.client.delete({ where: { id } })
    await recordActivity({ accountId, subject: 'client', subjectId: id, action: 'deleted' }, tx)
  })
}

/** Only the fields a person may set. The owner is never among them. */
function writable(input: CreateClientInput) {
  return {
    name: input.name,
    email: input.email,
    companyName: input.companyName ?? null,
    addressLine1: input.addressLine1 ?? null,
    addressLine2: input.addressLine2 ?? null,
    city: input.city ?? null,
    postcode: input.postcode ?? null,
    country: input.country ?? null,
  }
}
