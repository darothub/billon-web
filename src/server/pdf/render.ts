import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { readInvoiceDetail } from '@/server/invoices/queries'
import { readProfile } from '@/server/profile/store'
import { prisma } from '@/server/db/client'
import { InvoiceDocument } from './InvoiceDocument'

/**
 * Turning one invoice into a PDF.
 *
 * It renders in plain Node, so a document comes back well inside the time a person
 * will wait, without a headless browser to install and keep alive on the hosting.
 *
 * The invoice is read through the ownership-filtered store, so asking for somebody
 * else's produces a refusal rather than a document.
 */

export interface RenderedPdf {
  body: Buffer
  fileName: string
}

export async function renderInvoicePdf(accountId: number, id: number): Promise<RenderedPdf> {
  const [invoice, profile] = await Promise.all([
    readInvoiceDetail(accountId, id),
    readProfile(accountId),
  ])

  const element = createElement(InvoiceDocument, {
    invoice,
    profile,
    logo: await readLogoForPdf(accountId),
  })

  // The renderer's own type wants a document element described by its props; ours is
  // described by the invoice it draws, so the shape is stated rather than inferred.
  const body = await renderToBuffer(element as unknown as Parameters<typeof renderToBuffer>[0])

  return { body: Buffer.from(body), fileName: `${invoice.invoiceNumber}.pdf` }
}

async function readLogoForPdf(
  accountId: number
): Promise<{ data: Buffer; format: 'png' | 'jpg' } | null> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { logoImage: true, logoMimeType: true },
  })

  if (!account?.logoImage || !account.logoMimeType) return null

  return {
    data: Buffer.from(account.logoImage),
    format: account.logoMimeType === 'image/png' ? 'png' : 'jpg',
  }
}
