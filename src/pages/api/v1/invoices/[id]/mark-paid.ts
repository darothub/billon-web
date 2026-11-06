import { sendOk } from '@/server/http/envelope'
import { readId } from '@/server/http/params'
import { apiRoute } from '@/server/http/route'
import { requireAccountId } from '@/server/http/session'
import { moveInvoice } from '@/server/invoices/transitions'

/**
 * POST /api/v1/invoices/{id}/mark-paid — the mark-paid button.
 *
 * A draft has to be sent first; an already paid or voided invoice does not move again.
 */
export default apiRoute({
  POST: async (req, res) => {
    const accountId = await requireAccountId(req)
    sendOk(res, await moveInvoice(accountId, readId(req), 'PAID'), 'Invoice marked paid')
  },
})
