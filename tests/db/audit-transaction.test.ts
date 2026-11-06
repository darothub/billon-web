import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../helpers/contract'
import { invoiceBody, makeAccount, makeClient, resetDatabase } from '../helpers/db'
import { call, handlerAt } from '../helpers/http'

let invoices: Awaited<ReturnType<typeof handlerAt>>

beforeAll(async () => {
  invoices = await handlerAt('v1/invoices/index')
})

beforeEach(resetDatabase)

afterEach(async () => {
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "force_audit_failure" ON "ActivityLog"')
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS force_audit_failure()')
})

describe('product changes and their audit records are atomic', () => {
  it('rolls invoice creation and its allocated number back if the audit insert fails', async () => {
    const account = await makeAccount({ invoiceNextNumber: 17 })
    const client = await makeClient(account.id)
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION force_audit_failure() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'forced audit failure'; END;
      $$ LANGUAGE plpgsql
    `)
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "force_audit_failure" BEFORE INSERT ON "ActivityLog"
      FOR EACH ROW EXECUTE FUNCTION force_audit_failure()
    `)

    const response = await call(invoices, {
      method: 'POST',
      token: account.token,
      body: invoiceBody(client.id),
    })

    expect(response.status).toBe(500)
    expect(await prisma.invoice.count({ where: { accountId: account.id } })).toBe(0)
    const after = await prisma.account.findUniqueOrThrow({ where: { id: account.id } })
    expect(after.invoiceNextNumber).toBe(17)
  })
})
