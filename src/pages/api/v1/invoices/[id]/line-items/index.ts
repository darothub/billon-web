import { sendOk } from '@/server/http/envelope'
import { readBody, readId } from '@/server/http/params'
import { apiRoute } from '@/server/http/route'
import { requireAccountId } from '@/server/http/session'
import { addLineItem } from '@/server/invoices/lines'
import { addLineItemSchema } from '@/server/validation/invoices'

/**
 * POST /api/v1/invoices/{id}/line-items — the line editor on the edit page, which
 * adds lines one at a time. Answers with the whole invoice, figures worked out afresh.
 */
export default apiRoute({
  POST: async (req, res) => {
    const accountId = await requireAccountId(req)
    const input = addLineItemSchema.parse(readBody(req))
    sendOk(res, await addLineItem(accountId, readId(req), input), 'Line added')
  },
})
