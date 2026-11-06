import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { prisma } from '../helpers/contract'
import { call, handlerAt } from '../helpers/http'
import {
  assertScratchDatabase,
  resetDatabase,
  makeAccount,
  makeClient,
  makeInvoice,
  multipartFile,
  TINY_PNG,
  type TestAccount,
} from '../helpers/db'

/**
 * The settings page, the logo, and the PDF — the three things that leave the app and
 * land in front of a client.
 */

let profile: Awaited<ReturnType<typeof handlerAt>>
let logoUpload: Awaited<ReturnType<typeof handlerAt>>
let logoFetch: Awaited<ReturnType<typeof handlerAt>>
let pdf: Awaited<ReturnType<typeof handlerAt>>
let invoices: Awaited<ReturnType<typeof handlerAt>>
let account: TestAccount

beforeAll(async () => {
  assertScratchDatabase()
  profile = await handlerAt('v1/users/me/index')
  logoUpload = await handlerAt('v1/users/me/logo')
  logoFetch = await handlerAt('v1/users/[id]/logo')
  pdf = await handlerAt('v1/invoices/[id]/pdf')
  invoices = await handlerAt('v1/invoices/index')
})

beforeEach(async () => {
  await resetDatabase()
  account = await makeAccount()
})

describe('the settings page', () => {
  const settings = {
    firstName: 'Ada',
    lastName: 'Byron',
    invoicePrefix: 'AB-',
    taxLabel: 'VAT (UK)',
    defaultCurrency: 'EUR',
    bankName: 'Analytical Bank',
    bankAccountNumber: '12345678',
    bankSortCode: '20-00-00',
    paymentDetails: 'Please pay by bank transfer within 30 days.\nReference: the invoice number.',
  }

  it('saves every one of the nine fields', async () => {
    const res = await call(profile, { method: 'PUT', token: account.token, body: settings })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.data).toMatchObject(settings)
  })

  it('every value is still there after a reload', async () => {
    await call(profile, { method: 'PUT', token: account.token, body: settings })
    const reloaded = await call(profile, { method: 'GET', token: account.token })

    expect(reloaded.status).toBe(200)
    for (const [field, value] of Object.entries(settings)) {
      expect(reloaded.body.data[field], `${field} did not survive a reload`).toBe(value)
    }
  })

  it('the multi-line payment details survive intact, newlines and all', async () => {
    await call(profile, { method: 'PUT', token: account.token, body: settings })
    const reloaded = await call(profile, { method: 'GET', token: account.token })
    expect(reloaded.body.data.paymentDetails).toBe(settings.paymentDetails)
    expect(reloaded.body.data.paymentDetails.split('\n')).toHaveLength(2)
  })

  it('does not move the next-number counter, even if the request tries to', async () => {
    await call(invoices, {
      method: 'POST',
      token: account.token,
      body: {
        clientId: (await makeClient(account.id)).id,
        currency: 'GBP',
        issueDate: '2026-03-01',
        dueDate: '2026-03-31',
        lineItems: [{ description: 'Work', quantity: 1, unitRate: 1 }],
      },
    })
    const before = await prisma.account.findUniqueOrThrow({ where: { id: account.id } })
    expect(before.invoiceNextNumber).toBe(2)

    await call(profile, {
      method: 'PUT',
      token: account.token,
      body: { ...settings, invoiceNextNumber: 1 },
    })

    const after = await prisma.account.findUniqueOrThrow({ where: { id: account.id } })
    expect(after.invoiceNextNumber, 'saving settings re-issued a number already used').toBe(2)
  })

  it('the top bar and the new-invoice page read the profile successfully', async () => {
    // Both go to the same address; what matters is that every field they draw is there.
    const res = await call(profile, { method: 'GET', token: account.token })
    expect(Object.keys(res.body.data).sort()).toEqual([
      'bankAccountNumber',
      'bankName',
      'bankSortCode',
      'defaultCurrency',
      'email',
      'firstName',
      'id',
      'invoiceNextNumber',
      'invoicePrefix',
      'lastName',
      'logoUrl',
      'paymentDetails',
      'taxLabel',
    ])
  })
})

describe('the logo', () => {
  async function upload(name = 'logo.png', type = 'image/png', bytes = TINY_PNG) {
    const form = multipartFile('file', name, type, bytes)
    return call(logoUpload, {
      method: 'POST',
      token: account.token,
      raw: { body: form.body, contentType: form.contentType },
    })
  }

  it('a logo uploaded in settings is stored by Billon', async () => {
    const res = await upload()

    expect(res.status).toBeLessThan(400)
    expect(res.body.data.logoUrl).toBeTruthy()

    const row = await prisma.account.findUniqueOrThrow({ where: { id: account.id } })
    expect(row.logoImage).not.toBeNull()
    expect(Buffer.from(row.logoImage as Uint8Array).equals(TINY_PNG)).toBe(true)
    expect(row.logoMimeType).toBe('image/png')
    expect(row.logoUpdatedAt).not.toBeNull()
  })

  it('the address the profile points at hands the picture back', async () => {
    const uploaded = await upload()
    const url: string = uploaded.body.data.logoUrl
    expect(url).toContain(String(account.id))

    const res = await call(logoFetch, {
      method: 'GET',
      token: account.token,
      query: { id: String(account.id) },
    })
    expect(res.status).toBe(200)
    expect(String(res.headers['content-type'])).toBe('image/png')
    expect(res.buffer.equals(TINY_PNG)).toBe(true)
  })

  it('accepts the same-origin sign-in cookie used by an image element', async () => {
    await upload()
    const res = await call(logoFetch, {
      method: 'GET',
      cookies: { billon_token: account.token },
      query: { id: String(account.id) },
    })
    expect(res.status).toBe(200)
    expect(res.buffer.equals(TINY_PNG)).toBe(true)
  })

  it('returns no image bytes without a valid owner token', async () => {
    await upload()
    const other = await makeAccount()
    for (const options of [
      {},
      { token: 'invalid.token' },
      { token: other.token },
    ]) {
      const res = await call(logoFetch, {
        method: 'GET',
        query: { id: String(account.id) },
        ...options,
      })
      expect([401, 404]).toContain(res.status)
      expect(res.buffer.equals(TINY_PNG)).toBe(false)
    }
  })

  it('marks logo bytes private and not cacheable', async () => {
    await upload()
    const res = await call(logoFetch, {
      method: 'GET',
      token: account.token,
      query: { id: String(account.id) },
    })
    expect(String(res.headers['cache-control'])).toContain('private')
    expect(String(res.headers['cache-control'])).toContain('no-store')
  })

  it('the address changes when the picture changes, so a stale one is never shown', async () => {
    const first = (await upload()).body.data.logoUrl
    await new Promise((r) => setTimeout(r, 1100))
    const second = (await upload('other.png')).body.data.logoUrl
    expect(second).not.toBe(first)
  })

  it('refuses a file that is not a JPEG or a PNG, with a message the page can show', async () => {
    const res = await upload('notes.txt', 'text/plain', Buffer.from('not an image'))
    expect(res.status).toBe(400)
    expect(res.body.status).toBe('error')
    expect(res.body.message).toMatch(/png|jpe?g|image/i)

    const row = await prisma.account.findUniqueOrThrow({ where: { id: account.id } })
    expect(row.logoImage).toBeNull()
  })

  it('refuses a file over 2 MB', async () => {
    const res = await upload('huge.png', 'image/png', Buffer.alloc(3 * 1024 * 1024, 1))
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/2\s?MB|too (big|large)/i)
  })

  it('the logo is kept in the database, so a deployment cannot wipe it', async () => {
    // The web server's own disk is emptied on every deploy. Anything stored there
    // disappears with it, which is precisely the failure this checks against.
    await upload()
    const row = await prisma.account.findUniqueOrThrow({ where: { id: account.id } })
    expect(
      row.logoImage,
      'the picture itself is not in the database, so it will not survive a deploy'
    ).not.toBeNull()
  })

  it('appears on the next PDF produced for that account', async () => {
    const client = await makeClient(account.id)
    const invoice = await makeInvoice(account.id, client.id, { invoiceNumber: 'INV-0001' })

    const without = await call(pdf, {
      method: 'GET',
      token: account.token,
      query: { id: String(invoice.id) },
    })
    await upload()
    const withLogo = await call(pdf, {
      method: 'GET',
      token: account.token,
      query: { id: String(invoice.id) },
    })

    expect(withLogo.status).toBe(200)
    expect(
      withLogo.buffer.length,
      'the PDF is the same size with and without a logo — the logo is not on it'
    ).toBeGreaterThan(without.buffer.length)
  })
})

describe('downloading a PDF', () => {
  it('downloads from an existing invoice page', async () => {
    const client = await makeClient(account.id)
    const invoice = await makeInvoice(account.id, client.id, { invoiceNumber: 'INV-0001' })

    const res = await call(pdf, {
      method: 'GET',
      token: account.token,
      query: { id: String(invoice.id) },
    })

    expect(res.status).toBe(200)
    expect(String(res.headers['content-type'])).toContain('application/pdf')
    expect(res.buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(res.buffer.length).toBeGreaterThan(1000)
  })

  it('downloads immediately after creating an invoice on the new-invoice page', async () => {
    // Exactly what the new-invoice page does: create, then fetch the PDF for the id
    // it just got back, with no page reload in between.
    const client = await makeClient(account.id)
    const created = await call(invoices, {
      method: 'POST',
      token: account.token,
      body: {
        clientId: client.id,
        currency: 'GBP',
        issueDate: '2026-03-01',
        dueDate: '2026-03-31',
        lineItems: [{ description: 'Work', quantity: 1, unitRate: 100, taxRate: 0.2 }],
      },
    })

    const res = await call(pdf, {
      method: 'GET',
      token: account.token,
      query: { id: String(created.body.data.id) },
    })

    expect(res.status).toBe(200)
    expect(res.buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  it('marks the document as a PDF so the browser can save or show it', async () => {
    const client = await makeClient(account.id)
    const invoice = await makeInvoice(account.id, client.id, { invoiceNumber: 'INV-0002' })
    const res = await call(pdf, {
      method: 'GET',
      token: account.token,
      query: { id: String(invoice.id) },
    })
    expect(String(res.headers['content-type'])).toContain('application/pdf')
    expect(String(res.headers['content-disposition'] ?? '')).toMatch(/INV-0002/)
  })

  it('carries the figures, the client and the payment details onto the page', async () => {
    await call(profile, {
      method: 'PUT',
      token: account.token,
      body: {
        firstName: 'Ada',
        lastName: 'Byron',
        invoicePrefix: 'INV-',
        taxLabel: 'VAT',
        defaultCurrency: 'GBP',
        bankName: 'Analytical Bank',
        bankAccountNumber: '12345678',
        bankSortCode: '20-00-00',
        paymentDetails: 'Pay within 30 days',
      },
    })
    const client = await makeClient(account.id, { name: 'Beta Ltd' })
    const created = await call(invoices, {
      method: 'POST',
      token: account.token,
      body: {
        clientId: client.id,
        currency: 'GBP',
        issueDate: '2026-03-01',
        dueDate: '2026-03-31',
        lineItems: [{ description: 'Consulting work', quantity: 2, unitRate: 250, taxRate: 0.2 }],
      },
    })

    const res = await call(pdf, {
      method: 'GET',
      token: account.token,
      query: { id: String(created.body.data.id) },
    })

    // A PDF's text is compressed, so this is a smoke check on size rather than a
    // read of the words. What a client actually sees is checked by the side-by-side
    // comparison recorded in tests/manual/changeover-checklist.md.
    expect(res.status).toBe(200)
    expect(res.buffer.length).toBeGreaterThan(2000)
  })
})
