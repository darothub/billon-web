import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import https from 'node:https'
import { call, handlerAt } from '../helpers/http'
import { expectMoney } from '../helpers/money'
import { assertScratchDatabase, resetDatabase } from '../helpers/db'

/**
 * The whole journey, with the Java service switched off.
 *
 * 'Switched off' is enforced rather than assumed: before anything runs, outgoing
 * HTTP is replaced with something that throws. If any step still reaches out to
 * the removed Java host — or anywhere else — the journey fails loudly here rather than
 * on the day somebody actually turns the old service off.
 *
 * The full-working-day part of the criterion cannot be a unit test; it is a soak
 * recorded in tests/manual/changeover-checklist.md and checked by the release gate.
 */

const outbound: string[] = []
const realHttpRequest = http.request
const realHttpsRequest = https.request

beforeAll(async () => {
  assertScratchDatabase()
  const block = (label: string) =>
    ((...args: unknown[]) => {
      const target = typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0])
      outbound.push(`${label} ${target}`)
      throw new Error(
        `Something tried to make an outgoing request (${label} ${target}). ` +
          'The Java service is switched off; nothing in this journey may leave the app.'
      )
    }) as never
  http.request = block('http')
  https.request = block('https')
  await resetDatabase()
})

afterAll(() => {
  http.request = realHttpRequest
  https.request = realHttpsRequest
})

describe('a person gets through their whole working day with the Java service off', () => {
  it('signs in, sees the dashboard, lists and opens clients, raises, sends, pays and downloads', async () => {
    const register = await handlerAt('v1/auth/register')
    const login = await handlerAt('v1/auth/login')
    const me = await handlerAt('v1/users/me/index')
    const summary = await handlerAt('v1/dashboard/summary')
    const clients = await handlerAt('v1/clients/index')
    const client = await handlerAt('v1/clients/[id]')
    const invoices = await handlerAt('v1/invoices/index')
    const invoice = await handlerAt('v1/invoices/[id]/index')
    const send = await handlerAt('v1/invoices/[id]/send')
    const markPaid = await handlerAt('v1/invoices/[id]/mark-paid')
    const pdf = await handlerAt('v1/invoices/[id]/pdf')

    const steps: Array<{ what: string; status: number; body: any }> = []
    const step = (what: string, res: { status: number; body: any }) => {
      steps.push({ what, ...res })
      return res
    }

    // Sign up once so there is somebody to sign in as, then sign in properly.
    await call(register, {
      method: 'POST',
      body: {
        email: 'day@example.com',
        password: 'a-whole-working-day',
        firstName: 'Ada',
        lastName: 'Lovelace',
      },
    })

    const signedIn = step(
      'sign in',
      await call(login, {
        method: 'POST',
        body: { email: 'day@example.com', password: 'a-whole-working-day' },
      })
    )
    const token: string = signedIn.body.data.token
    expect(token).toBeTruthy()

    step('read the profile for the top bar', await call(me, { method: 'GET', token }))
    step('see the dashboard figures', await call(summary, { method: 'GET', token }))

    const created = step(
      'create a client',
      await call(clients, {
        method: 'POST',
        token,
        body: { name: 'Beta Ltd', email: 'accounts@beta.example', companyName: 'Beta Ltd' },
      })
    )
    const clientId: number = created.body.data.id

    step('list clients', await call(clients, { method: 'GET', token, query: { size: '20' } }))
    step(
      'open a client',
      await call(client, { method: 'GET', token, query: { id: String(clientId) } })
    )

    const raised = step(
      'raise an invoice',
      await call(invoices, {
        method: 'POST',
        token,
        body: {
          clientId,
          currency: 'GBP',
          issueDate: '2026-03-01',
          dueDate: '2026-03-31',
          taxLabel: 'VAT',
          lineItems: [
            { description: 'Discovery', quantity: 2, unitRate: 500, taxRate: 0.2 },
            { description: 'Expenses', quantity: 1, unitRate: 43.5 },
          ],
        },
      })
    )
    const invoiceId: number = raised.body.data.id
    expectMoney(raised.body.data.subtotal, '1043.50')
    expectMoney(raised.body.data.total, '1243.50')

    step('send it', await call(send, { method: 'POST', token, query: { id: String(invoiceId) } }))
    step(
      'mark it paid',
      await call(markPaid, { method: 'POST', token, query: { id: String(invoiceId) } })
    )

    const shown = step(
      'open the invoice',
      await call(invoice, { method: 'GET', token, query: { id: String(invoiceId) } })
    )
    expect(shown.body.data.status).toBe('PAID')
    expect(shown.body.data.sentAt).toBeTruthy()
    expect(shown.body.data.paidAt).toBeTruthy()

    const document = await call(pdf, { method: 'GET', token, query: { id: String(invoiceId) } })
    steps.push({ what: 'download the PDF', status: document.status, body: null })
    expect(document.buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')

    // None of those steps showed an error.
    const failures = steps.filter((s) => s.status >= 400)
    expect(
      failures,
      'these steps of the day showed an error:\n' +
        failures.map((f) => `  ${f.what}: ${f.status} ${f.body?.message ?? ''}`).join('\n')
    ).toEqual([])
    for (const s of steps) {
      if (s.body) expect(s.body.status, `${s.what} did not report success`).toBe('success')
    }
  })

  it('nothing in the whole journey reached outside the app', () => {
    expect(
      outbound,
      `these outgoing requests were attempted: ${outbound.join(', ')}`
    ).toEqual([])
  })
})
