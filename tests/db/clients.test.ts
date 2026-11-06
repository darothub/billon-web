import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { prisma } from '../helpers/contract'
import { call, handlerAt } from '../helpers/http'
import {
  assertScratchDatabase,
  resetDatabase,
  makeAccount,
  makeClient,
  makeInvoice,
  type TestAccount,
} from '../helpers/db'

/**
 * The clients page and the client page, end to end, with the Java service switched
 * off — which here means simply that nothing in this file talks to anything but
 * this project and its own database.
 */

let clients: Awaited<ReturnType<typeof handlerAt>>
let client: Awaited<ReturnType<typeof handlerAt>>
let account: TestAccount

beforeAll(async () => {
  assertScratchDatabase()
  clients = await handlerAt('v1/clients/index')
  client = await handlerAt('v1/clients/[id]')
})

beforeEach(async () => {
  await resetDatabase()
  account = await makeAccount()
})

describe('listing clients', () => {
  beforeEach(async () => {
    for (const name of ['Delta Co', 'Alpha Ltd', 'Charlie plc', 'Bravo GmbH', 'Echo SA']) {
      await makeClient(account.id, { name, email: `${name.split(' ')[0].toLowerCase()}@ex.example` })
    }
  })

  it('pages the way the clients page asks it to', async () => {
    const first = await call(clients, {
      method: 'GET',
      token: account.token,
      query: { page: '0', size: '2' },
    })

    expect(first.status).toBe(200)
    expect(first.body.data.content).toHaveLength(2)
    expect(first.body.data.page).toBe(0)
    expect(first.body.data.size).toBe(2)
    expect(first.body.data.totalElements).toBe(5)
    expect(first.body.data.totalPages).toBe(3)
    expect(first.body.data.first).toBe(true)
    expect(first.body.data.last).toBe(false)

    const last = await call(clients, {
      method: 'GET',
      token: account.token,
      query: { page: '2', size: '2' },
    })
    expect(last.body.data.content).toHaveLength(1)
    expect(last.body.data.first).toBe(false)
    expect(last.body.data.last).toBe(true)
  })

  it("sorts by name ascending, which is what every client dropdown sends", async () => {
    const res = await call(clients, {
      method: 'GET',
      token: account.token,
      query: { size: '100', sort: 'name,asc' },
    })
    const names = res.body.data.content.map((c: { name: string }) => c.name)
    expect(names).toEqual(['Alpha Ltd', 'Bravo GmbH', 'Charlie plc', 'Delta Co', 'Echo SA'])
  })

  it('searches by name', async () => {
    const res = await call(clients, {
      method: 'GET',
      token: account.token,
      query: { search: 'brav' },
    })
    expect(res.body.data.totalElements).toBe(1)
    expect(res.body.data.content[0].name).toBe('Bravo GmbH')
  })

  it('shows against each client the number of invoices that client actually has', async () => {
    const alpha = await prisma.client.findFirstOrThrow({ where: { name: 'Alpha Ltd' } })
    const bravo = await prisma.client.findFirstOrThrow({ where: { name: 'Bravo GmbH' } })
    await makeInvoice(account.id, alpha.id, { invoiceNumber: 'INV-0001' })
    await makeInvoice(account.id, alpha.id, { invoiceNumber: 'INV-0002' })
    await makeInvoice(account.id, alpha.id, { invoiceNumber: 'INV-0003' })
    await makeInvoice(account.id, bravo.id, { invoiceNumber: 'INV-0004' })

    const res = await call(clients, {
      method: 'GET',
      token: account.token,
      query: { size: '100', sort: 'name,asc' },
    })
    const byName = Object.fromEntries(
      res.body.data.content.map((c: { name: string; invoiceCount: number }) => [
        c.name,
        c.invoiceCount,
      ])
    )
    expect(byName['Alpha Ltd']).toBe(3)
    expect(byName['Bravo GmbH']).toBe(1)
    expect(byName['Charlie plc']).toBe(0)
  })

  it('the count follows the invoices, so deleting one brings it down', async () => {
    const alpha = await prisma.client.findFirstOrThrow({ where: { name: 'Alpha Ltd' } })
    const first = await makeInvoice(account.id, alpha.id, { invoiceNumber: 'INV-0001' })
    await makeInvoice(account.id, alpha.id, { invoiceNumber: 'INV-0002' })
    await prisma.invoice.delete({ where: { id: first.id } })

    const res = await call(clients, { method: 'GET', token: account.token, query: { search: 'Alpha' } })
    expect(res.body.data.content[0].invoiceCount).toBe(1)
  })

  it("never lists another account's clients", async () => {
    const other = await makeAccount()
    await makeClient(other.id, { name: 'Somebody Elses Client' })

    const res = await call(clients, { method: 'GET', token: account.token, query: { size: '100' } })
    const names = res.body.data.content.map((c: { name: string }) => c.name)
    expect(names).not.toContain('Somebody Elses Client')
    expect(res.body.data.totalElements).toBe(5)
  })
})

describe('a client from start to finish', () => {
  it('creates, opens, changes and deletes a client', async () => {
    // Create
    const created = await call(clients, {
      method: 'POST',
      token: account.token,
      body: {
        name: 'Zeta Studios',
        email: 'hello@zeta.example',
        companyName: 'Zeta Studios Ltd',
        addressLine1: '1 High Street',
        city: 'Leeds',
        postcode: 'LS1 1AA',
        country: 'United Kingdom',
      },
    })
    expect(created.status).toBe(201)
    expect(created.body.status).toBe('success')
    const id = created.body.data.id
    expect(typeof id).toBe('number')

    // Open
    const opened = await call(client, {
      method: 'GET',
      token: account.token,
      query: { id: String(id) },
    })
    expect(opened.status).toBe(200)
    expect(opened.body.data).toMatchObject({
      id,
      name: 'Zeta Studios',
      email: 'hello@zeta.example',
      city: 'Leeds',
      postcode: 'LS1 1AA',
    })

    // Change
    const changed = await call(client, {
      method: 'PUT',
      token: account.token,
      query: { id: String(id) },
      body: { name: 'Zeta Studios Europe', email: 'accounts@zeta.example', city: 'Manchester' },
    })
    expect(changed.status).toBe(200)
    expect(changed.body.data.name).toBe('Zeta Studios Europe')
    expect(changed.body.data.city).toBe('Manchester')

    const reopened = await call(client, {
      method: 'GET',
      token: account.token,
      query: { id: String(id) },
    })
    expect(reopened.body.data.name).toBe('Zeta Studios Europe')

    // Delete
    const deleted = await call(client, {
      method: 'DELETE',
      token: account.token,
      query: { id: String(id) },
    })
    expect(deleted.status).toBe(200)
    expect(deleted.body.status).toBe('success')

    const gone = await call(client, {
      method: 'GET',
      token: account.token,
      query: { id: String(id) },
    })
    expect(gone.status).toBe(404)
    expect(await prisma.client.findUnique({ where: { id } })).toBeNull()
  })

  it('refuses to delete a client that still has invoices, and says why', async () => {
    const beta = await makeClient(account.id)
    await makeInvoice(account.id, beta.id, { invoiceNumber: 'INV-0001' })

    const res = await call(client, {
      method: 'DELETE',
      token: account.token,
      query: { id: String(beta.id) },
    })

    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.body.status).toBe('error')
    expect(res.body.message).toMatch(/invoice/i)
    expect(await prisma.client.findUnique({ where: { id: beta.id } })).not.toBeNull()
  })

  it('takes the owner from the sign-in token, not from the request', async () => {
    const other = await makeAccount()
    const created = await call(clients, {
      method: 'POST',
      token: account.token,
      body: { name: 'Planted', email: 'p@ex.example', accountId: other.id },
    })

    const row = await prisma.client.findUniqueOrThrow({ where: { id: created.body.data.id } })
    expect(row.accountId).toBe(account.id)
  })
})
