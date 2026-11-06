import { sendOk } from '@/server/http/envelope'
import { readId } from '@/server/http/params'
import { apiRoute } from '@/server/http/route'
import { requireAccountId } from '@/server/http/session'
import { sendInvoice } from '@/server/invoices/sender'

/**
 * POST /api/v1/invoices/{id}/send — the send button.
 *
 * Delivers one PDF attachment, then moves a draft to sent and stamps the moment.
 * Delivery failure is visible and leaves the invoice draft.
 */
export default apiRoute({
  POST: async (req, res) => {
    const accountId = await requireAccountId(req)
    sendOk(res, await sendInvoice(accountId, readId(req)), 'Invoice sent')
  },
})
