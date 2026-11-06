import { sendOk } from '@/server/http/envelope'
import { readId } from '@/server/http/params'
import { apiRoute } from '@/server/http/route'
import { requireAccountId } from '@/server/http/session'
import { removeLineItem } from '@/server/invoices/lines'

/**
 * DELETE /api/v1/invoices/{id}/line-items/{itemId} — the line editor removing one
 * line. Answers with the whole invoice, figures worked out afresh.
 */
export default apiRoute({
  DELETE: async (req, res) => {
    const accountId = await requireAccountId(req)
    const invoice = await removeLineItem(accountId, readId(req), readId(req, 'itemId'))
    sendOk(res, invoice, 'Line removed')
  },
})
