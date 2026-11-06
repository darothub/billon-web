import { sendOk } from '@/server/http/envelope'
import { readId } from '@/server/http/params'
import { apiRoute } from '@/server/http/route'
import { requireAccountId } from '@/server/http/session'
import { moveInvoice } from '@/server/invoices/transitions'

/**
 * POST /api/v1/invoices/{id}/void — the void button.
 *
 * A draft or a sent invoice may be voided; an already paid or voided one may not.
 */
export default apiRoute({
  POST: async (req, res) => {
    const accountId = await requireAccountId(req)
    sendOk(res, await moveInvoice(accountId, readId(req), 'VOID'), 'Invoice voided')
  },
})
