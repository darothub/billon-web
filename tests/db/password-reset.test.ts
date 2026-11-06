import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { prisma, verifyPassword } from '../helpers/contract'
import { assertScratchDatabase, resetDatabase, makeAccount, type TestAccount } from '../helpers/db'

/**
 * Asking for a password reset link and using it. The three things that matter:
 * an address with no account looks exactly like one with an account, a link
 * lapses after an hour, and a link works once.
 *
 * Without SMTP settings outside production the link is written to the console
 * rather than emailed, so the tests read the token from there — the same place
 * a developer would.
 */

let requestPasswordReset: typeof import('@/server/auth/passwordReset').requestPasswordReset
let resetPassword: typeof import('@/server/auth/passwordReset').resetPassword
let info: ReturnType<typeof vi.spyOn>
let account: TestAccount

const NEW_PASSWORD = 'a-much-better-password'
const INVALID = /invalid or has expired/

beforeAll(async () => {
  assertScratchDatabase()
  ;({ requestPasswordReset, resetPassword } = await import('@/server/auth/passwordReset'))
})

beforeEach(async () => {
  await resetDatabase()
  account = await makeAccount({ email: 'ada@example.com' })
  info = vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  info.mockRestore()
})

/** The token from the most recent reset link written to the console. */
function issuedToken(): string {
  const lines = info.mock.calls.map((call) => String(call[0]))
  const match = /token=([0-9a-f]+)/.exec(lines[lines.length - 1] ?? '')
  if (!match) throw new Error('No reset link was issued.')
  return match[1]
}

async function passwordWorks(plain: string): Promise<boolean> {
  const row = await prisma.account.findUniqueOrThrow({ where: { id: account.id } })
  return verifyPassword(plain, row.passwordHash, row.passwordAlgorithm)
}

describe('asking for a reset link', () => {
  it('stores only a fingerprint of the token, valid for about an hour', async () => {
    await requestPasswordReset({ email: account.email })

    const token = issuedToken()
    const rows = await prisma.passwordResetToken.findMany({ where: { accountId: account.id } })
    expect(rows).toHaveLength(1)
    expect(rows[0].tokenHash).not.toBe(token)
    expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(rows[0].usedAt).toBeNull()

    const lifetime = rows[0].expiresAt.getTime() - Date.now()
    expect(lifetime).toBeGreaterThan(59 * 60 * 1000)
    expect(lifetime).toBeLessThanOrEqual(60 * 60 * 1000)
  })

  it('ignores case and surrounding spaces in the email', async () => {
    await requestPasswordReset({ email: '  ADA@Example.com ' })

    expect(await prisma.passwordResetToken.count({ where: { accountId: account.id } })).toBe(1)
  })

  it('replaces the earlier link when a second one is requested', async () => {
    await requestPasswordReset({ email: account.email })
    const first = issuedToken()
    await requestPasswordReset({ email: account.email })
    const second = issuedToken()

    expect(second).not.toBe(first)
    expect(await prisma.passwordResetToken.count({ where: { accountId: account.id } })).toBe(1)
    await expect(resetPassword({ token: first, newPassword: NEW_PASSWORD })).rejects.toThrow(INVALID)
    await expect(resetPassword({ token: second, newPassword: NEW_PASSWORD })).resolves.toBeUndefined()
  })
})

describe('an email with no account', () => {
  it('returns quietly, stores nothing and sends nothing', async () => {
    await expect(requestPasswordReset({ email: 'nobody@example.com' })).resolves.toBeUndefined()

    expect(await prisma.passwordResetToken.count()).toBe(0)
    expect(info).not.toHaveBeenCalled()
  })

  it('does not disturb the tokens of real accounts', async () => {
    await requestPasswordReset({ email: account.email })
    await requestPasswordReset({ email: 'nobody@example.com' })

    expect(await prisma.passwordResetToken.count({ where: { accountId: account.id } })).toBe(1)
  })
})

describe('using a reset link', () => {
  it('sets the new password, and the old one stops working', async () => {
    await requestPasswordReset({ email: account.email })

    await resetPassword({ token: issuedToken(), newPassword: NEW_PASSWORD })

    expect(await passwordWorks(NEW_PASSWORD)).toBe(true)
    expect(await passwordWorks(account.password)).toBe(false)
  })

  it('records the reset in the activity log', async () => {
    await requestPasswordReset({ email: account.email })
    await resetPassword({ token: issuedToken(), newPassword: NEW_PASSWORD })

    const entries = await prisma.activityLog.findMany({ where: { accountId: account.id } })
    expect(entries.map((entry) => entry.action)).toContain('password reset')
  })

  it('refuses a token that was never issued', async () => {
    await requestPasswordReset({ email: account.email })

    await expect(
      resetPassword({ token: 'f'.repeat(64), newPassword: NEW_PASSWORD })
    ).rejects.toThrow(INVALID)
    expect(await passwordWorks(account.password)).toBe(true)
  })
})

describe('expiry', () => {
  it('refuses a link older than an hour and leaves the password alone', async () => {
    await requestPasswordReset({ email: account.email })
    const token = issuedToken()
    await prisma.passwordResetToken.updateMany({
      where: { accountId: account.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    await expect(resetPassword({ token, newPassword: NEW_PASSWORD })).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(INVALID),
    })
    expect(await passwordWorks(account.password)).toBe(true)
    expect(await passwordWorks(NEW_PASSWORD)).toBe(false)
  })

  it('still accepts a link a moment before it lapses', async () => {
    await requestPasswordReset({ email: account.email })
    const token = issuedToken()
    await prisma.passwordResetToken.updateMany({
      where: { accountId: account.id },
      data: { expiresAt: new Date(Date.now() + 60 * 1000) },
    })

    await expect(resetPassword({ token, newPassword: NEW_PASSWORD })).resolves.toBeUndefined()
  })
})

describe('reuse', () => {
  it('works once: the same link is refused the second time', async () => {
    await requestPasswordReset({ email: account.email })
    const token = issuedToken()

    await resetPassword({ token, newPassword: NEW_PASSWORD })

    await expect(
      resetPassword({ token, newPassword: 'someone-elses-choice' })
    ).rejects.toThrow(INVALID)
    expect(await passwordWorks(NEW_PASSWORD)).toBe(true)
    expect(await passwordWorks('someone-elses-choice')).toBe(false)
  })

  it('lets only one of two simultaneous uses succeed', async () => {
    await requestPasswordReset({ email: account.email })
    const token = issuedToken()

    const outcomes = await Promise.allSettled([
      resetPassword({ token, newPassword: 'first-simultaneous-choice' }),
      resetPassword({ token, newPassword: 'second-simultaneous-choice' }),
    ])

    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter((o) => o.status === 'rejected')).toHaveLength(1)
  })

  it('clears the account\'s other tokens once a reset succeeds', async () => {
    await requestPasswordReset({ email: account.email })
    const token = issuedToken()
    await prisma.passwordResetToken.create({
      data: {
        accountId: account.id,
        tokenHash: 'e'.repeat(64),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    })

    await resetPassword({ token, newPassword: NEW_PASSWORD })

    const left = await prisma.passwordResetToken.findMany({ where: { accountId: account.id } })
    expect(left).toHaveLength(1)
    expect(left[0].usedAt).not.toBeNull()
  })

  it('does not let one account\'s link change another account\'s password', async () => {
    const other = await makeAccount({ email: 'grace@example.com' })
    await requestPasswordReset({ email: account.email })

    await resetPassword({ token: issuedToken(), newPassword: NEW_PASSWORD })

    const row = await prisma.account.findUniqueOrThrow({ where: { id: other.id } })
    expect(await verifyPassword(other.password, row.passwordHash, row.passwordAlgorithm)).toBe(true)
  })
})
