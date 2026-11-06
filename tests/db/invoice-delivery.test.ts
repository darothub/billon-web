import { beforeEach, describe, expect, it } from 'vitest'
import type { Email } from '@/server/email/sender'
import { MailDeliveryError } from '@/server/email/sender'
import { sendInvoice, type DeliveryDependencies } from '@/server/invoices/sender'
import { prisma } from '../helpers/contract'
import { invoiceBody, makeAccount, makeClient, resetDatabase } from '../helpers/db'
import { call, handlerAt } from '../helpers/http'

async function draft() {
  const account = await makeAccount()
  const client = await makeClient(account.id)
  const invoices = await handlerAt('v1/invoices/index')
  const created = await call(invoices, {
    method: 'POST',
    token: account.token,
    body: invoiceBody(client.id),
  })
  return { account, id: created.body.data.id as number }
}

function delivery(deliver: DeliveryDependencies['deliver']): DeliveryDependencies {
  return {
    renderPdf: async (_accountId, id) => ({
      body: Buffer.from('%PDF-test'),
      fileName: `invoice-${id}.pdf`,
    }),
    deliver,
  }
}

beforeEach(resetDatabase)

describe('sending an invoice', () => {
  it('delivers exactly one PDF attachment before committing SENT', async () => {
    const { account, id } = await draft()
    const messages: Email[] = []
    const result = await sendInvoice(account.id, id, delivery(async (message) => {
      messages.push(message)
      expect((await prisma.invoice.findUniqueOrThrow({ where: { id } })).status).toBe('DRAFT')
      return { sent: true }
    }))

    expect(messages).toHaveLength(1)
    expect(messages[0].attachments).toHaveLength(1)
    expect(messages[0].attachments![0].contentType).toBe('application/pdf')
    expect(result.status).toBe('SENT')
    expect(result.sentAt).toBeTruthy()
  })

  it('leaves the invoice draft and records a provider rejection', async () => {
    const { account, id } = await draft()
    await expect(sendInvoice(account.id, id, delivery(async () => {
      throw new MailDeliveryError('The mail provider rejected the message.')
    }))).rejects.toThrow(/rejected/)

    expect((await prisma.invoice.findUniqueOrThrow({ where: { id } })).status).toBe('DRAFT')
    const failed = await prisma.activityLog.findFirst({
      where: { subject: 'invoice', subjectId: id, action: 'email failed' },
    })
    expect(failed?.detail).toMatch(/rejected/)
  })

  it('leaves the invoice draft and records a PDF failure', async () => {
    const { account, id } = await draft()
    const broken = delivery(async () => ({ sent: true }))
    broken.renderPdf = async () => { throw new Error('renderer failed') }

    await expect(sendInvoice(account.id, id, broken)).rejects.toThrow(/could not be delivered/)
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id } })).status).toBe('DRAFT')
    expect(await prisma.activityLog.findFirst({
      where: { subjectId: id, action: 'delivery failed' },
    })).not.toBeNull()
  })
})
