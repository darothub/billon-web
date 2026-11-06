import { sendOk } from '@/server/http/envelope'
import { parsePageParams } from '@/server/http/page'
import { readBody, readQuery } from '@/server/http/params'
import { apiRoute } from '@/server/http/route'
import { requireAccountId } from '@/server/http/session'
import { createInvoice } from '@/server/invoices/create'
import { INVOICE_SORT_FIELDS, listInvoices } from '@/server/invoices/list'
import { createInvoiceSchema } from '@/server/validation/invoices'

/**
 * GET /api/v1/invoices — the invoices page, the dashboard's recent list, and the
 * invoice list on a client's page: the same request with different filters.
 * POST /api/v1/invoices — the new-invoice page.
 */
export default apiRoute({
  GET: async (req, res) => {
    const accountId = await requireAccountId(req)
    const params = parsePageParams(req.query, INVOICE_SORT_FIELDS)
    const clientId = readQuery(req, 'clientId')

    sendOk(
      res,
      await listInvoices(accountId, params, {
        status: readQuery(req, 'status'),
        clientId: clientId ? Number(clientId) : undefined,
      })
    )
  },

  POST: async (req, res) => {
    const accountId = await requireAccountId(req)
    const input = createInvoiceSchema.parse(readBody(req))
    sendOk(res, await createInvoice(accountId, input), 'Invoice created', 201)
  },
})
