import type { UserProfile } from '@/lib/types'
import { prisma } from '@/server/db/client'
import { unauthorised } from '@/server/http/errors'
import { recordActivity } from '@/server/activity/log'
import type { UpdateProfileInput } from '@/server/validation/profile'

/**
 * The signed-in person's own details.
 *
 * The profile is the account row minus the password fields and minus the picture
 * itself; the logo's address is worked out from the id and the moment the picture was
 * last replaced, so a changed logo can never be shown from a stale copy.
 *
 * Saving the settings page never touches the next-number counter. Only raising an
 * invoice moves that, and only inside the transaction that saves the invoice.
 */

export interface AccountForProfile {
  id: number
  email: string
  firstName: string
  lastName: string
  defaultCurrency: string
  invoicePrefix: string
  invoiceNextNumber: number
  taxLabel: string
  bankName: string | null
  bankAccountNumber: string | null
  bankSortCode: string | null
  paymentDetails: string | null
  logoMimeType: string | null
  logoUpdatedAt: Date | null
}

export const PROFILE_FIELDS = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  defaultCurrency: true,
  invoicePrefix: true,
  invoiceNextNumber: true,
  taxLabel: true,
  bankName: true,
  bankAccountNumber: true,
  bankSortCode: true,
  paymentDetails: true,
  logoMimeType: true,
  logoUpdatedAt: true,
} as const

export function toUserProfile(account: AccountForProfile): UserProfile {
  return {
    id: account.id,
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    defaultCurrency: account.defaultCurrency,
    invoicePrefix: account.invoicePrefix,
    invoiceNextNumber: account.invoiceNextNumber,
    taxLabel: account.taxLabel,
    logoUrl: logoUrlFor(account),
    bankName: account.bankName,
    bankAccountNumber: account.bankAccountNumber,
    bankSortCode: account.bankSortCode,
    paymentDetails: account.paymentDetails,
  }
}

/** Changes whenever the picture changes, so a browser never shows an old one. */
export function logoUrlFor(account: AccountForProfile): string | null {
  if (!account.logoMimeType || !account.logoUpdatedAt) return null
  return `/api/v1/users/${account.id}/logo?v=${account.logoUpdatedAt.getTime()}`
}

export async function readProfile(accountId: number): Promise<UserProfile> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: PROFILE_FIELDS,
  })
  if (!account) throw unauthorised()
  return toUserProfile(account)
}

export async function updateProfile(
  accountId: number,
  input: UpdateProfileInput
): Promise<UserProfile> {
  const account = await prisma.$transaction(async (tx) => {
    const updated = await tx.account.update({
      where: { id: accountId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        invoicePrefix: input.invoicePrefix,
        taxLabel: input.taxLabel,
        defaultCurrency: input.defaultCurrency,
        bankName: input.bankName ?? null,
        bankAccountNumber: input.bankAccountNumber ?? null,
        bankSortCode: input.bankSortCode ?? null,
        paymentDetails: input.paymentDetails ?? null,
      },
      select: PROFILE_FIELDS,
    })
    await recordActivity(
      { accountId, subject: 'account', subjectId: accountId, action: 'changed' },
      tx
    )
    return updated
  })
  return toUserProfile(account)
}
