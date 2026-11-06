import type { UserProfile } from '@/lib/types'
import { prisma } from '@/server/db/client'
import { badRequest, notFound } from '@/server/http/errors'
import { recordActivity } from '@/server/activity/log'
import { PROFILE_FIELDS, toUserProfile } from './store'

/**
 * The account's logo.
 *
 * The picture is kept in the database rather than on the web server's own disk,
 * because that disk is emptied on every deployment and a logo uploaded on Monday
 * would vanish on Tuesday. Logos are small and there is at most one per account, so
 * this meets the promise that it survives without adding a second paid service, a
 * second set of credentials and a second thing to misconfigure.
 */

export const MAX_LOGO_BYTES = 2 * 1024 * 1024

const ACCEPTED = ['image/png', 'image/jpeg', 'image/jpg']

export const WRONG_TYPE_MESSAGE =
  'A logo has to be a PNG or a JPEG image. Please choose a different file.'

export const TOO_LARGE_MESSAGE =
  'That logo is too large — the limit is 2 MB. Please choose a smaller image.'

export async function saveLogo(
  accountId: number,
  image: Buffer,
  mimeType: string
): Promise<UserProfile> {
  const type = mimeType.toLowerCase().split(';')[0].trim()
  if (!ACCEPTED.includes(type)) throw badRequest(WRONG_TYPE_MESSAGE)
  if (image.length > MAX_LOGO_BYTES) throw badRequest(TOO_LARGE_MESSAGE)
  if (image.length === 0) throw badRequest('That file was empty.')

  const account = await prisma.$transaction(async (tx) => {
    const updated = await tx.account.update({
      where: { id: accountId },
      data: {
        logoImage: Uint8Array.from(image),
        logoMimeType: type === 'image/jpg' ? 'image/jpeg' : type,
        logoUpdatedAt: new Date(),
      },
      select: PROFILE_FIELDS,
    })
    await recordActivity(
      { accountId, subject: 'account', subjectId: accountId, action: 'logo changed' },
      tx
    )
    return updated
  })

  return toUserProfile(account)
}

export interface StoredLogo {
  image: Buffer
  mimeType: string
  updatedAt: Date
}

/** The picture itself. The request handler authenticates its owner before calling. */
export async function readLogo(accountId: number): Promise<StoredLogo> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { logoImage: true, logoMimeType: true, logoUpdatedAt: true },
  })

  if (!account?.logoImage || !account.logoMimeType) throw notFound('That logo')

  return {
    image: Buffer.from(account.logoImage),
    mimeType: account.logoMimeType,
    updatedAt: account.logoUpdatedAt ?? new Date(0),
  }
}
