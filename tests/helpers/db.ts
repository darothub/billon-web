import { prisma, hashPassword, signToken } from './contract'

/**
 * Everything the database-backed tests need: a guard that refuses to run anywhere
 * dangerous, a wipe between tests, and small factories so each test says only what
 * is interesting about its own situation.
 *
 * There is deliberately no "skip if there is no database". A silently skipped test
 * for invoice numbering or for one account reading another's invoices is worse than
 * no test, because the build goes green and nobody looks again.
 */

const url = process.env.DATABASE_URL ?? ''

export function assertScratchDatabase(): void {
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. The database tests need a scratch PostgreSQL:\n' +
        '  docker compose up -d\n' +
        '  DATABASE_URL=postgresql://billon:billon@localhost:5432/billon_test npx prisma migrate deploy\n' +
        '  DATABASE_URL=postgresql://billon:billon@localhost:5432/billon_test npx vitest run --project db'
    )
  }
  // These tests truncate every table. Make it impossible to point them at live data.
  const looksLocal = /localhost|127\.0\.0\.1|host\.docker\.internal/.test(url)
  const looksScratch = /_test|_scratch|_ci/.test(url)
  if (!looksLocal && !looksScratch) {
    throw new Error(
      `Refusing to run destructive tests against ${redact(url)} — the database tests ` +
        'truncate every table. Point DATABASE_URL at a local or *_test database.'
    )
  }
}

function redact(value: string): string {
  return value.replace(/\/\/[^@]*@/, '//***@')
}

/** Empty every table, so each test starts from a known-empty Billon. */
export async function resetDatabase(): Promise<void> {
  assertScratchDatabase()
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "InvoiceTaxEntry", "InvoiceLine", "Invoice", "Client",
      "ActivityLog", "JobRun", "MigrationRun", "Account"
    RESTART IDENTITY CASCADE
  `)
}

export interface TestAccount {
  id: number
  email: string
  password: string
  token: string
}

let accountSeq = 0

export async function makeAccount(
  overrides: Partial<{
    email: string
    password: string
    firstName: string
    lastName: string
    invoicePrefix: string
    invoiceNextNumber: number
    defaultCurrency: string
    taxLabel: string
    passwordHash: string
    passwordAlgorithm: string
    legacyId: number
  }> = {}
): Promise<TestAccount> {
  accountSeq += 1
  const password = overrides.password ?? 'correct-horse-battery-staple'
  const email = overrides.email ?? `tester${accountSeq}@example.com`
  const account = await prisma.account.create({
    data: {
      email,
      passwordHash: overrides.passwordHash ?? (await hashPassword(password)),
      passwordAlgorithm: overrides.passwordAlgorithm ?? 'bcrypt',
      firstName: overrides.firstName ?? 'Ada',
      lastName: overrides.lastName ?? 'Lovelace',
      defaultCurrency: overrides.defaultCurrency ?? 'GBP',
      invoicePrefix: overrides.invoicePrefix ?? 'INV-',
      invoiceNextNumber: overrides.invoiceNextNumber ?? 1,
      taxLabel: overrides.taxLabel ?? 'VAT',
      legacyId: overrides.legacyId ?? null,
    },
  })
  return {
    id: account.id,
    email,
    password,
    token: await signToken({ accountId: account.id }),
  }
}

export async function makeClient(
  accountId: number,
  overrides: Partial<{ name: string; email: string; companyName: string }> = {}
) {
  return prisma.client.create({
    data: {
      accountId,
      name: overrides.name ?? 'Beta Ltd',
      email: overrides.email ?? 'accounts@beta.example',
      companyName: overrides.companyName ?? 'Beta Ltd',
    },
  })
}

/**
 * A saved invoice, created through the store the same way the app does, so the
 * figures on it are Billon's own rather than something a test typed in.
 */
export async function makeInvoice(
  accountId: number,
  clientId: number,
  overrides: Partial<{
    invoiceNumber: string
    status: string
    issueDate: string
    dueDate: string
    currency: string
    total: string
    subtotal: string
    taxTotal: string
    sentAt: Date | null
    paidAt: Date | null
    voidedAt: Date | null
  }> = {}
) {
  return prisma.invoice.create({
    data: {
      accountId,
      clientId,
      invoiceNumber: overrides.invoiceNumber ?? `INV-${Date.now()}-${Math.random()}`.slice(0, 24),
      status: overrides.status ?? 'DRAFT',
      issueDate: new Date(overrides.issueDate ?? '2026-01-05'),
      dueDate: new Date(overrides.dueDate ?? '2026-02-05'),
      currency: overrides.currency ?? 'GBP',
      taxLabel: 'VAT',
      subtotal: overrides.subtotal ?? '100.00',
      taxTotal: overrides.taxTotal ?? '20.00',
      total: overrides.total ?? '120.00',
      sentAt: overrides.sentAt ?? null,
      paidAt: overrides.paidAt ?? null,
      voidedAt: overrides.voidedAt ?? null,
      lineItems: {
        create: [
          {
            description: 'Consulting',
            quantity: '1',
            unitRate: '100.00',
            taxRate: '0.20',
            lineTotal: '100.00',
            taxAmount: '20.00',
            position: 0,
          },
        ],
      },
    },
    include: { lineItems: true },
  })
}

/** A minimal, valid create-invoice request body, for tests that vary one thing. */
export function invoiceBody(clientId: number, overrides: Record<string, unknown> = {}) {
  return {
    clientId,
    currency: 'GBP',
    issueDate: '2026-03-01',
    dueDate: '2026-03-31',
    taxLabel: 'VAT',
    lineItems: [{ description: 'Design work', quantity: 2, unitRate: 250, taxRate: 0.2 }],
    ...overrides,
  }
}

/** A multipart form body carrying one file, for the logo upload address. */
export function multipartFile(
  fieldName: string,
  fileName: string,
  contentType: string,
  content: Buffer
): { body: Buffer; contentType: string } {
  const boundary = '----billontest' + Math.random().toString(16).slice(2)
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`)
  return {
    body: Buffer.concat([head, content, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  }
}

/** The smallest real PNG there is — enough to be a genuine image upload. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)
