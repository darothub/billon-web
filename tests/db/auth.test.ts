import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { hashPassword, prisma, verifyPassword } from '../helpers/contract'
import { call, handlerAt } from '../helpers/http'
import { assertScratchDatabase, resetDatabase, makeAccount } from '../helpers/db'

/**
 * Signing up, signing in, and what happens to a person whose password was scrambled
 * by the Java service before the move.
 */

let register: Awaited<ReturnType<typeof handlerAt>>
let login: Awaited<ReturnType<typeof handlerAt>>
let me: Awaited<ReturnType<typeof handlerAt>>

beforeAll(async () => {
  assertScratchDatabase()
  register = await handlerAt('v1/auth/register')
  login = await handlerAt('v1/auth/login')
  me = await handlerAt('v1/users/me/index')
})

beforeEach(resetDatabase)

describe('signing up', () => {
  const signUp = {
    email: 'new.person@example.com',
    password: 'a-brand-new-password',
    firstName: 'Grace',
    lastName: 'Hopper',
  }

  it('gives a brand-new person a sign-in token and their profile straight away', async () => {
    const res = await call(register, { method: 'POST', body: signUp })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('success')
    expect(typeof res.body.data.token).toBe('string')
    expect(res.body.data.token.length).toBeGreaterThan(20)
    expect(res.body.data.user).toMatchObject({
      email: 'new.person@example.com',
      firstName: 'Grace',
      lastName: 'Hopper',
      invoiceNextNumber: 1,
    })
    expect(res.body.data.user.invoicePrefix).toBeTruthy()
    expect(res.body.data.user.defaultCurrency).toBeTruthy()
    expect(res.body.data.user.taxLabel).toBeTruthy()
  })

  it('the token it hands out works immediately on the next request', async () => {
    const created = await call(register, { method: 'POST', body: signUp })
    const profile = await call(me, { method: 'GET', token: created.body.data.token })

    expect(profile.status).toBe(200)
    expect(profile.body.data.email).toBe('new.person@example.com')
  })

  it('lets that person sign in again straight away with the password they just chose', async () => {
    await call(register, { method: 'POST', body: signUp })
    const res = await call(login, {
      method: 'POST',
      body: { email: signUp.email, password: signUp.password },
    })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(typeof res.body.data.token).toBe('string')
    expect(res.body.data.user.email).toBe('new.person@example.com')
  })

  it('refuses an email that already has an account, without handing out a token', async () => {
    await call(register, { method: 'POST', body: signUp })
    const res = await call(register, { method: 'POST', body: signUp })

    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.body.status).toBe('error')
    expect(res.body.message).toMatch(/already/i)
    expect(res.body.data).toBeNull()
  })

  it('never puts a password, scrambled or otherwise, in a reply', async () => {
    const res = await call(register, { method: 'POST', body: signUp })
    const asText = JSON.stringify(res.body)
    expect(asText).not.toContain(signUp.password)
    expect(asText).not.toMatch(/passwordHash|passwordAlgorithm/)
  })
})

describe('signing in with the wrong details', () => {
  beforeEach(async () => {
    await makeAccount({ email: 'real@example.com', password: 'the-right-password' })
  })

  it('refuses a wrong password with a clear message and no token', async () => {
    const res = await call(login, {
      method: 'POST',
      body: { email: 'real@example.com', password: 'not-the-right-password' },
    })

    expect(res.status).toBe(401)
    expect(res.body.status).toBe('error')
    expect(res.body.message).toMatch(/email or password/i)
    expect(res.body.data).toBeNull()
    expect(JSON.stringify(res.body)).not.toContain('token')
  })

  it('refuses an email nobody has, with a clear message and no token', async () => {
    const res = await call(login, {
      method: 'POST',
      body: { email: 'nobody@example.com', password: 'anything-at-all' },
    })

    expect(res.status).toBe(401)
    expect(res.body.status).toBe('error')
    expect(res.body.data).toBeNull()
    expect(JSON.stringify(res.body)).not.toContain('token')
  })

  it('says the same thing either way, so nobody can find out who has an account', async () => {
    const wrongPassword = await call(login, {
      method: 'POST',
      body: { email: 'real@example.com', password: 'wrong' },
    })
    const unknownEmail = await call(login, {
      method: 'POST',
      body: { email: 'nobody@example.com', password: 'wrong' },
    })

    expect(wrongPassword.body.message).toBe(unknownEmail.body.message)
    expect(wrongPassword.status).toBe(unknownEmail.status)
  })
})

describe('people who already had a Billon account before the move', () => {
  it('verifies a Java BCrypt hash and upgrades its algorithm label on first sign-in', async () => {
    const person = {
      email: 'carried.over@example.com',
      plainPassword: 'the-password-from-before-the-move',
      passwordHash: await hashPassword('the-password-from-before-the-move'),
    }
    const account = await makeAccount({
      email: person.email,
      passwordHash: person.passwordHash,
      passwordAlgorithm: 'spring-bcrypt',
      legacyId: 101,
    })

    const res = await call(login, {
      method: 'POST',
      body: { email: person.email, password: person.plainPassword },
    })

    expect(res.status).toBe(200)
    expect(JSON.stringify(res.body)).not.toMatch(/reset|choose a new password/i)
    const after = await prisma.account.findUniqueOrThrow({ where: { id: account.id } })
    expect(after.passwordAlgorithm).toBe('bcrypt')
    expect(after.passwordHash).not.toBe(person.passwordHash)
    expect(await verifyPassword(person.plainPassword, after.passwordHash, 'bcrypt')).toBe(true)
  })
})

describe('what is kept about a password', () => {
  it('the accounts table holds no password in readable form', async () => {
    const plain = 'a-password-a-person-would-actually-type'
    await call(register, {
      method: 'POST',
      body: { email: 'stored@example.com', password: plain, firstName: 'A', lastName: 'B' },
    })

    const row = await prisma.account.findUniqueOrThrow({ where: { email: 'stored@example.com' } })
    expect(row.passwordHash).not.toBe(plain)
    expect(row.passwordHash).not.toContain(plain)
    expect(row.passwordHash.length).toBeGreaterThan(40)
    // Nothing else on the row may be carrying it either.
    expect(JSON.stringify(row)).not.toContain(plain)
  })

  it('a password never reaches the activity log', async () => {
    const plain = 'another-password-a-person-would-type'
    await call(register, {
      method: 'POST',
      body: { email: 'logged@example.com', password: plain, firstName: 'A', lastName: 'B' },
    })
    await call(login, { method: 'POST', body: { email: 'logged@example.com', password: plain } })
    await call(login, { method: 'POST', body: { email: 'logged@example.com', password: 'wrong' } })

    const entries = await prisma.activityLog.findMany()
    expect(JSON.stringify(entries)).not.toContain(plain)
  })
})

describe('losing the sign-in token', () => {
  it('a request with no token is refused with the code that signs the browser out', async () => {
    const res = await call(me, { method: 'GET' })
    expect(res.status).toBe(401)
    expect(res.body.status).toBe('error')
    expect(res.body.data).toBeNull()
  })

  it('a made-up token is refused rather than believed', async () => {
    const res = await call(me, { method: 'GET', token: 'not.a.real.token' })
    expect(res.status).toBe(401)
  })

  it('a token signed with the wrong secret is refused', async () => {
    // Take a real token and change its signature.
    const account = await makeAccount()
    const tampered = account.token.slice(0, -3) + 'aaa'
    const res = await call(me, { method: 'GET', token: tampered })
    expect(res.status).toBe(401)
  })

  it('shows nothing at all alongside the refusal — no stale information', async () => {
    await makeAccount()
    const res = await call(me, { method: 'GET' })
    expect(res.body.data).toBeNull()
    expect(res.buffer.toString()).not.toMatch(/@example\.com/)
  })
})
