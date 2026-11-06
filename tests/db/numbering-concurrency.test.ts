import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { prisma } from '../helpers/contract'
import { call, handlerAt } from '../helpers/http'
import {
  assertScratchDatabase,
  resetDatabase,
  makeAccount,
  makeClient,
  invoiceBody,
  type TestAccount,
} from '../helpers/db'

/**
 * Invoice numbers. Two invoices in one account sharing a number is a bookkeeping
 * problem that surfaces months later at tax time, so this is tested twice over: the
 * code must not produce a duplicate, and the database must refuse one even if the
 * code someday tries.
 */

let invoices: Awaited<ReturnType<typeof handlerAt>>

beforeAll(async () => {
  assertScratchDatabase()
  invoices = await handlerAt('v1/invoices/index')
})

beforeEach(resetDatabase)

async function accountWithClient(overrides: Parameters<typeof makeAccount>[0] = {}) {
  const account = await makeAccount(overrides)
  const client = await makeClient(account.id)
  return { account, clientId: client.id }
}

describe('carrying on an existing account sequence after the move', () => {
  /**
   * Three accounts as they arrive from the old database: each mid-sequence, each
   * with a different prefix, and each with numbers already issued.
   */
  const CARRIED_OVER = [
    { email: 'seq1@example.com', invoicePrefix: 'INV-', invoiceNextNumber: 48, expect: 'INV-0048' },
    { email: 'seq2@example.com', invoicePrefix: '2026/', invoiceNextNumber: 7, expect: '2026/0007' },
    { email: 'seq3@example.com', invoicePrefix: 'AC-', invoiceNextNumber: 1204, expect: 'AC-1204' },
  ]

  it.each(CARRIED_OVER)(
    '$email takes $expect — the next number in its own sequence',
    async (person) => {
      const { account, clientId } = await accountWithClient({
        email: person.email,
        invoicePrefix: person.invoicePrefix,
        invoiceNextNumber: person.invoiceNextNumber,
      })

      const res = await call(invoices, {
        method: 'POST',
        token: account.token,
        body: invoiceBody(clientId),
      })

      expect(res.body.data.invoiceNumber).toBe(person.expect)
      expect(res.body.data.invoiceNumber).not.toMatch(/0*1$/)
    }
  )

  it('does not restart at one, and does not reuse a number already issued', async () => {
    const { account, clientId } = await accountWithClient({ invoiceNextNumber: 48 })
    // The numbers this account already issued before the move.
    for (const n of [45, 46, 47]) {
      await prisma.invoice.create({
        data: {
          accountId: account.id,
          clientId,
          invoiceNumber: `INV-${String(n).padStart(4, '0')}`,
          status: 'PAID',
          issueDate: new Date('2025-12-01'),
          dueDate: new Date('2025-12-31'),
          currency: 'GBP',
          taxLabel: 'VAT',
          subtotal: '10.00',
          taxTotal: '0.00',
          total: '10.00',
        },
      })
    }

    const first = await call(invoices, {
      method: 'POST',
      token: account.token,
      body: invoiceBody(clientId),
    })
    const second = await call(invoices, {
      method: 'POST',
      token: account.token,
      body: invoiceBody(clientId),
    })

    expect(first.body.data.invoiceNumber).toBe('INV-0048')
    expect(second.body.data.invoiceNumber).toBe('INV-0049')

    const all = await prisma.invoice.findMany({ where: { accountId: account.id } })
    const numbers = all.map((i) => i.invoiceNumber)
    expect(new Set(numbers).size).toBe(numbers.length)
  })

  it('each account has its own sequence — one does not disturb another', async () => {
    const a = await accountWithClient({ email: 'a@example.com', invoiceNextNumber: 10 })
    const b = await accountWithClient({ email: 'b@example.com', invoiceNextNumber: 900 })

    const fromA = await call(invoices, {
      method: 'POST',
      token: a.account.token,
      body: invoiceBody(a.clientId),
    })
    const fromB = await call(invoices, {
      method: 'POST',
      token: b.account.token,
      body: invoiceBody(b.clientId),
    })

    expect(fromA.body.data.invoiceNumber).toBe('INV-0010')
    expect(fromB.body.data.invoiceNumber).toBe('INV-0900')
  })
})

describe('many invoices raised at the very same moment', () => {
  it('produces no two invoices with the same number', async () => {
    const { account, clientId } = await accountWithClient({ invoiceNextNumber: 1 })
    const attempts = 25

    const results = await Promise.all(
      Array.from({ length: attempts }, () =>
        call(invoices, { method: 'POST', token: account.token, body: invoiceBody(clientId) })
      )
    )

    const succeeded = results.filter((r) => r.status < 400)
    expect(
      succeeded.length,
      'some simultaneous creations failed:\n' +
        results
          .filter((r) => r.status >= 400)
          .map((r) => `  ${r.status} ${r.body?.message}`)
          .join('\n')
    ).toBe(attempts)

    const numbers = succeeded.map((r) => r.body.data.invoiceNumber as string)
    expect(new Set(numbers).size, `duplicate numbers issued: ${numbers.sort().join(', ')}`).toBe(
      attempts
    )

    // And the sequence has no gaps and no repeats.
    expect(numbers.sort()).toEqual(
      Array.from({ length: attempts }, (_, i) => `INV-${String(i + 1).padStart(4, '0')}`).sort()
    )

    const after = await prisma.account.findUniqueOrThrow({ where: { id: account.id } })
    expect(after.invoiceNextNumber).toBe(attempts + 1)
  })

  it('the invoices really are all there, one row each', async () => {
    const { account, clientId } = await accountWithClient()
    await Promise.all(
      Array.from({ length: 10 }, () =>
        call(invoices, { method: 'POST', token: account.token, body: invoiceBody(clientId) })
      )
    )
    expect(await prisma.invoice.count({ where: { accountId: account.id } })).toBe(10)
  })
})

describe('the database itself refuses a duplicate number', () => {
  it('inserting a duplicate directly is refused', async () => {
    const { account, clientId } = await accountWithClient()
    const row = {
      accountId: account.id,
      clientId,
      invoiceNumber: 'INV-0001',
      status: 'DRAFT',
      issueDate: new Date('2026-01-01'),
      dueDate: new Date('2026-01-31'),
      currency: 'GBP',
      taxLabel: 'VAT',
      subtotal: '1.00',
      taxTotal: '0.00',
      total: '1.00',
    }
    await prisma.invoice.create({ data: row })

    // Straight past every line of application code, into the table itself.
    await expect(prisma.invoice.create({ data: row })).rejects.toThrowError(
      /unique|duplicate|P2002/i
    )

    expect(await prisma.invoice.count({ where: { invoiceNumber: 'INV-0001' } })).toBe(1)
  })

  it('but two different accounts may each have an INV-0001', async () => {
    const a = await accountWithClient({ email: 'one@example.com' })
    const b = await accountWithClient({ email: 'two@example.com' })
    const row = (accountId: number, clientId: number) => ({
      accountId,
      clientId,
      invoiceNumber: 'INV-0001',
      status: 'DRAFT',
      issueDate: new Date('2026-01-01'),
      dueDate: new Date('2026-01-31'),
      currency: 'GBP',
      taxLabel: 'VAT',
      subtotal: '1.00',
      taxTotal: '0.00',
      total: '1.00',
    })

    await prisma.invoice.create({ data: row(a.account.id, a.clientId) })
    await expect(
      prisma.invoice.create({ data: row(b.account.id, b.clientId) })
    ).resolves.toBeTruthy()
  })
})
