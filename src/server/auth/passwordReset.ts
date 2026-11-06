import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/server/db/client'
import { recordActivity } from '@/server/activity/log'
import { sendEmail } from '@/server/email/sender'
import { badRequest } from '@/server/http/errors'
import type { ForgotPasswordInput, ResetPasswordInput } from '@/server/validation/profile'
import { CURRENT_ALGORITHM, hashPassword } from './password'

/**
 * Forgotten passwords.
 *
 * Asking for a reset always looks the same from outside, whether or not the email
 * has an account. The link carries a random token; only its fingerprint is stored,
 * it works once, and it lapses after an hour.
 */

const LIFETIME_MS = 60 * 60 * 1000
const INVALID_LINK = 'This reset link is invalid or has expired. Please request a new one.'

const fingerprint = (token: string) => createHash('sha256').update(token).digest('hex')

function appUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
}

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
  const email = input.email.trim().toLowerCase()
  const account = await prisma.account.findUnique({
    where: { email },
    select: { id: true, firstName: true },
  })
  if (!account) return

  const token = randomBytes(32).toString('hex')
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { accountId: account.id } }),
    prisma.passwordResetToken.create({
      data: {
        accountId: account.id,
        tokenHash: fingerprint(token),
        expiresAt: new Date(Date.now() + LIFETIME_MS),
      },
    }),
  ])

  const link = `${appUrl()}/reset-password?token=${token}`
  try {
    if (!process.env.SMTP_HOST && process.env.NODE_ENV !== 'production') {
      console.info(`[billon] password reset link for ${email}: ${link}`)
      return
    }
    await sendEmail({
      to: email,
      subject: 'Reset your Billon password',
      text:
        `Hi ${account.firstName},\n\n` +
        `Use the link below to choose a new password. It works once and expires in one hour.\n\n` +
        `${link}\n\n` +
        `If you did not ask for this, you can ignore this email.`,
    })
  } catch (error) {
    // The caller must not learn whether the address has an account.
    console.error('[billon] could not send a password reset email', error)
  }
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: fingerprint(input.token) },
  })
  if (!record || record.usedAt || record.expiresAt < new Date()) throw badRequest(INVALID_LINK)

  const passwordHash = await hashPassword(input.newPassword)
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    })
    if (claimed.count === 0) throw badRequest(INVALID_LINK)

    await tx.account.update({
      where: { id: record.accountId },
      data: { passwordHash, passwordAlgorithm: CURRENT_ALGORITHM },
    })
    await tx.passwordResetToken.deleteMany({
      where: { accountId: record.accountId, id: { not: record.id } },
    })
    await recordActivity(
      { accountId: record.accountId, subject: 'account', subjectId: record.accountId, action: 'password reset' },
      tx
    )
  })
}
