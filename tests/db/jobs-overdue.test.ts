import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest'
import { prisma, markOverdue } from '../helpers/contract'
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
 * The nightly sweep that turns unpaid invoices overdue.
 *
 * The failure this guards against is not the sweep getting an invoice wrong. It is
 * the sweep silently not running at all — no error, no broken screen, invoices just
 * quietly stop turning overdue and the dashboard goes stale. So half of this file is
 * about being able to see that it ran.
 */

let job: Awaited<ReturnType<typeof handlerAt>>
let invoiceHandler: Awaited<ReturnType<typeof handlerAt>>
let account: TestAccount
let clientId: number

const SECRET = process.env.CRON_SECRET ?? 'test-cron-secret'

beforeAll(async () => {
  assertScratchDatabase()
  process.env.CRON_SECRET = SECRET
  job = await handlerAt('v1/jobs/mark-overdue')
  invoiceHandler = await handlerAt('v1/invoices/[id]/index')
})

beforeEach(async () => {
  await resetDatabase()
  account = await makeAccount()
  clientId = (await makeClient(account.id)).id
})

const realTransaction = prisma.$transaction
afterEach(() => {
  vi.restoreAllMocks()
  ;(prisma as any).$transaction = realTransaction
})

/**
 * Make the next sweep fail after its work is done but before it commits, the way a
 * database going away would. The sweep writes through the transaction's own client,
 * so a spy on `prisma.invoice` never fires; this lets the real update run inside the
 * real transaction and then throws, which also proves the rollback. The client is
 * swapped by hand rather than with vi.spyOn, because restoring a spy on Prisma's
 * client leaves `$transaction` undefined for every later test.
 */
function failSweepBeforeCommit(error: Error) {
  const real = realTransaction.bind(prisma) as (fn: unknown) => Promise<unknown>
  ;(prisma as any).$transaction = (fn: (tx: unknown) => Promise<unknown>) => {
    ;(prisma as any).$transaction = realTransaction
    return real(async (tx: unknown) => {
      await fn(tx)
      throw error
    })
  }
}

describe('unpaid invoices past their due date', () => {
  it('an unpaid invoice with a due date in the past is found marked overdue', async () => {
    const late = await makeInvoice(account.id, clientId, {
      invoiceNumber: 'INV-0001',
      status: 'SENT',
      issueDate: '2026-01-01',
      dueDate: '2026-01-31',
      sentAt: new Date('2026-01-01'),
    })

    // Nobody opens a screen; the schedule calls the address.
    const res = await call(job, { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } })
    expect(res.status).toBe(200)

    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: late.id } })
    expect(after.status).toBe('OVERDUE')
  })

  it('the invoice page shows it as overdue the next morning, with nobody pressing anything', async () => {
    const late = await makeInvoice(account.id, clientId, {
      invoiceNumber: 'INV-0002',
      status: 'SENT',
      dueDate: '2026-01-31',
    })
    await call(job, { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } })

    const shown = await call(invoiceHandler, {
      method: 'GET',
      token: account.token,
      query: { id: String(late.id) },
    })
    expect(shown.body.data.status).toBe('OVERDUE')
  })

  it('leaves alone anything that is not an unpaid invoice past its date', async () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const keep = {
      draft: await makeInvoice(account.id, clientId, {
        invoiceNumber: 'K1',
        status: 'DRAFT',
        dueDate: '2026-01-01',
      }),
      paid: await makeInvoice(account.id, clientId, {
        invoiceNumber: 'K2',
        status: 'PAID',
        dueDate: '2026-01-01',
      }),
      voided: await makeInvoice(account.id, clientId, {
        invoiceNumber: 'K3',
        status: 'VOID',
        dueDate: '2026-01-01',
      }),
      notYetDue: await makeInvoice(account.id, clientId, {
        invoiceNumber: 'K4',
        status: 'SENT',
        dueDate: future,
      }),
    }

    await call(job, { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } })

    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: keep.draft.id } })).status).toBe(
      'DRAFT'
    )
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: keep.paid.id } })).status).toBe(
      'PAID'
    )
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: keep.voided.id } })).status).toBe(
      'VOID'
    )
    expect(
      (await prisma.invoice.findUniqueOrThrow({ where: { id: keep.notYetDue.id } })).status
    ).toBe('SENT')
  })

  it('an invoice due today is not yet overdue', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const due = await makeInvoice(account.id, clientId, {
      invoiceNumber: 'T1',
      status: 'SENT',
      dueDate: today,
    })
    await call(job, { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } })
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: due.id } })).status).toBe('SENT')
  })

  it('sweeps every account, not just one', async () => {
    const other = await makeAccount()
    const otherClient = await makeClient(other.id)
    const mine = await makeInvoice(account.id, clientId, {
      invoiceNumber: 'M1',
      status: 'SENT',
      dueDate: '2026-01-01',
    })
    const theirs = await makeInvoice(other.id, otherClient.id, {
      invoiceNumber: 'O1',
      status: 'SENT',
      dueDate: '2026-01-01',
    })

    await call(job, { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } })

    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: mine.id } })).status).toBe(
      'OVERDUE'
    )
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: theirs.id } })).status).toBe(
      'OVERDUE'
    )
  })
})

describe('only the schedule may set the sweep going', () => {
  it('refuses a call with no secret', async () => {
    const res = await call(job, { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('refuses a call with the wrong secret', async () => {
    const res = await call(job, { method: 'POST', headers: { authorization: 'Bearer nope' } })
    expect(res.status).toBe(401)
  })

  it('accepts a plain GET as well as a POST, because the schedule may send either', async () => {
    const res = await call(job, { method: 'GET', headers: { authorization: `Bearer ${SECRET}` } })
    expect(
      res.status,
      'the schedule makes a GET; if only POST is accepted the job silently never runs'
    ).toBe(200)
  })
})

describe('being able to see that the sweep ran', () => {
  it('records that it ran, when, and how many invoices it changed', async () => {
    await makeInvoice(account.id, clientId, {
      invoiceNumber: 'R1',
      status: 'SENT',
      dueDate: '2026-01-01',
    })
    await makeInvoice(account.id, clientId, {
      invoiceNumber: 'R2',
      status: 'SENT',
      dueDate: '2026-01-02',
    })

    const before = new Date()
    await call(job, { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } })

    const run = await prisma.jobRun.findFirstOrThrow({
      where: { jobName: 'mark-overdue' },
      orderBy: { startedAt: 'desc' },
    })
    expect(run.startedAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 2000)
    expect(run.finishedAt).not.toBeNull()
    expect(run.invoicesChanged).toBe(2)
    expect(run.outcome).toBe('SUCCEEDED')
  })

  it('the answer says the same thing, so a schedule log shows it without opening the database', async () => {
    await makeInvoice(account.id, clientId, {
      invoiceNumber: 'R3',
      status: 'SENT',
      dueDate: '2026-01-01',
    })
    const res = await call(job, { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } })

    expect(res.body.data.invoicesChanged).toBe(1)
    expect(res.body.data.startedAt).toBeTruthy()
    expect(res.body.data.finishedAt).toBeTruthy()
  })

  it('when it last ran can be answered without guesswork', async () => {
    await call(job, { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } })
    await call(job, { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } })

    const runs = await prisma.jobRun.findMany({
      where: { jobName: 'mark-overdue' },
      orderBy: { startedAt: 'desc' },
    })
    expect(runs.length).toBe(2)
    expect(runs[0].startedAt.getTime()).toBeGreaterThanOrEqual(runs[1].startedAt.getTime())
  })

  it('a run that fails is noticed rather than passing silently', async () => {
    await makeInvoice(account.id, clientId, {
      invoiceNumber: 'F1',
      status: 'SENT',
      dueDate: '2026-01-01',
    })

    // Make the sweep fail on purpose, the way a database going away would.
    failSweepBeforeCommit(new Error('the database went away mid-sweep'))

    const res = await call(job, { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } })

    // It surfaces: the answer says it failed…
    expect(res.status).toBeGreaterThanOrEqual(500)
    expect(res.body.status).toBe('error')

    // …and the record of the run says so too, with why.
    const run = await prisma.jobRun.findFirstOrThrow({
      where: { jobName: 'mark-overdue' },
      orderBy: { startedAt: 'desc' },
    })
    expect(run.outcome).toBe('FAILED')
    expect(run.errorMessage).toContain('went away')
  })

  it('a failed run does not leave half the invoices changed', async () => {
    const first = await makeInvoice(account.id, clientId, {
      invoiceNumber: 'F2',
      status: 'SENT',
      dueDate: '2026-01-01',
    })
    failSweepBeforeCommit(new Error('failed part way'))

    await call(job, { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } })

    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: first.id } })).status).toBe('SENT')
  })

  it('the sweep can also be run directly, and says what it did', async () => {
    await makeInvoice(account.id, clientId, {
      invoiceNumber: 'D1',
      status: 'SENT',
      dueDate: '2026-01-01',
    })
    const result = await markOverdue()
    expect(result.invoicesChanged).toBe(1)
    expect(result.outcome).toBe('SUCCEEDED')
  })
})

describe('the schedule is actually switched on', () => {
  it('the hosting configuration asks for a nightly call to the sweep', async () => {
    const { readFileSync, existsSync } = await import('node:fs')
    const { join } = await import('node:path')
    const path = join(__dirname, '..', '..', 'vercel.json')
    expect(existsSync(path), 'vercel.json does not exist, so nothing triggers the sweep').toBe(true)

    const config = JSON.parse(readFileSync(path, 'utf8')) as {
      crons?: Array<{ path: string; schedule: string }>
    }
    const cron = (config.crons ?? []).find((c) => c.path.includes('mark-overdue'))
    expect(cron, 'no scheduled call to the overdue sweep').toBeDefined()
    expect(cron!.schedule, 'the sweep is not scheduled daily').toMatch(/^\S+\s+\S+\s+\*\s+\*\s+\*$/)
  })
})
