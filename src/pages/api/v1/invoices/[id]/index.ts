import { sendOk } from '@/server/http/envelope'
import { readBody, readId } from '@/server/http/params'
import { apiRoute } from '@/server/http/route'
import { requireAccountId } from '@/server/http/session'
import { readInvoiceDetail } from '@/server/invoices/queries'
import { deleteInvoice } from '@/server/invoices/transitions'
import { updateInvoice } from '@/server/invoices/update'
import { updateInvoiceSchema } from '@/server/validation/invoices'

/**
 * GET, PUT and DELETE /api/v1/invoices/{id} — the invoice page and the edit page.
 * Only a draft may be deleted; anything else has to be voided instead.
 */
export default apiRoute({
  GET: async (req, res) => {
    const accountId = await requireAccountId(req)
    sendOk(res, await readInvoiceDetail(accountId, readId(req)))
  },

  PUT: async (req, res) => {
    const accountId = await requireAccountId(req)
    const input = updateInvoiceSchema.parse(readBody(req))
    sendOk(res, await updateInvoice(accountId, readId(req), input), 'Invoice saved')
  },

  DELETE: async (req, res) => {
    const accountId = await requireAccountId(req)
    await deleteInvoice(accountId, readId(req))
    sendOk(res, null, 'Invoice deleted')
  },
})
