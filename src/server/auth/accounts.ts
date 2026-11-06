import type { AuthResponse } from '@/lib/types'
import { prisma } from '@/server/db/client'
import { ApiError, conflict } from '@/server/http/errors'
import { recordActivity } from '@/server/activity/log'
import { PROFILE_FIELDS, toUserProfile } from '@/server/profile/store'
import type { LoginInput, RegisterInput } from '@/server/validation/profile'
import { CURRENT_ALGORITHM, hashPassword, needsRehash, verifyPassword } from './password'
import { signToken } from './token'

/**
 * Signing up and signing in.
 *
 * A wrong password and an email nobody has are refused with exactly the same words
 * and the same code, so nobody can use the sign-in page to find out who has an
 * account. No password, scrambled or otherwise, appears in any reply or in the
 * activity record.
 */

const REFUSED = 'That email or password is not right. Please try again.'

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const email = input.email.toLowerCase()

  const taken = await prisma.account.findUnique({ where: { email }, select: { id: true } })
  if (taken) throw conflict('An account with that email address already exists.')

  const passwordHash = await hashPassword(input.password)
  const account = await prisma.$transaction(async (tx) => {
    const created = await tx.account.create({
      data: {
        email,
        passwordHash,
        passwordAlgorithm: CURRENT_ALGORITHM,
        firstName: input.firstName,
        lastName: input.lastName,
        defaultCurrency: 'GBP',
        invoicePrefix: 'INV-',
        invoiceNextNumber: 1,
        taxLabel: 'VAT',
      },
      select: PROFILE_FIELDS,
    })
    await recordActivity({
      accountId: created.id,
      subject: 'account',
      subjectId: created.id,
      action: 'created',
    }, tx)
    return created
  })

  return { token: await signToken({ accountId: account.id }), user: toUserProfile(account) }
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const email = input.email.trim().toLowerCase()
  const account = await prisma.account.findUnique({ where: { email } })
  if (!account) throw new ApiError(401, REFUSED)

  const correct = await verifyPassword(
    input.password,
    account.passwordHash,
    account.passwordAlgorithm
  )
  if (!correct) throw new ApiError(401, REFUSED)

  // Somebody carried over from the old service signs in with the password they
  // already use, and their scramble quietly becomes a current one on the way past.
  if (needsRehash(account.passwordAlgorithm, account.passwordHash)) {
    const passwordHash = await hashPassword(input.password)
    await prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: account.id },
        data: { passwordHash, passwordAlgorithm: CURRENT_ALGORITHM },
      })
      await recordActivity({
        accountId: account.id,
        subject: 'account',
        subjectId: account.id,
        action: 'password hash upgraded',
      }, tx)
    })
  }

  const profile = await prisma.account.findUniqueOrThrow({
    where: { id: account.id },
    select: PROFILE_FIELDS,
  })

  return { token: await signToken({ accountId: account.id }), user: toUserProfile(profile) }
}
