import { beforeAll, describe, expect, it } from 'vitest'
import { call, handlerAt } from '../helpers/http'
import { prisma } from '../helpers/contract'
import { runMigration } from '../../scripts/migrate'

interface InheritedAccount {
  email: string
  password: string
}

let people: InheritedAccount[] = []

beforeAll(async () => {
  const sourceUrl = process.env.LEGACY_DATABASE_URL ?? ''
  const targetUrl = process.env.DATABASE_URL ?? ''
  const secret = process.env.LEGACY_AUTH_ACCOUNTS_JSON ?? ''
  if (!sourceUrl || !targetUrl || !secret) {
    throw new Error(
      'Restored sign-in verification requires LEGACY_DATABASE_URL, DATABASE_URL, and ' +
      'LEGACY_AUTH_ACCOUNTS_JSON in protected release settings.'
    )
  }
  people = JSON.parse(secret) as InheritedAccount[]
  if (people.length < 3 || people.some((person) => !person.email || !person.password)) {
    throw new Error('LEGACY_AUTH_ACCOUNTS_JSON must contain at least three email/password pairs.')
  }
  await runMigration({ sourceUrl, targetUrl })
}, 600_000)

describe('three inherited accounts', () => {
  it('sign in on the first attempt and upgrade their confirmed legacy hashes', async () => {
    const login = await handlerAt('v1/auth/login')
    for (const person of people) {
      const response = await call(login, {
        method: 'POST',
        body: { email: person.email, password: person.password },
      })
      expect(response.status, `${person.email} could not sign in`).toBe(200)
      expect(response.body.data.user.email).toBe(person.email.toLowerCase())
      const row = await prisma.account.findUniqueOrThrow({ where: { email: person.email.toLowerCase() } })
      expect(row.passwordAlgorithm).toBe('bcrypt')
      expect(row.passwordHash).not.toContain(person.password)
    }
  })
})
