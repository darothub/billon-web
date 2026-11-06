import { CLIENT_SORT_FIELDS, listClients } from '@/server/clients/list'
import { createClient } from '@/server/clients/store'
import { sendOk } from '@/server/http/envelope'
import { parsePageParams } from '@/server/http/page'
import { readBody, readQuery } from '@/server/http/params'
import { apiRoute } from '@/server/http/route'
import { requireAccountId } from '@/server/http/session'
import { createClientSchema } from '@/server/validation/clients'

/**
 * GET /api/v1/clients — the clients page, and every client dropdown.
 * POST /api/v1/clients — the new-client page.
 */
export default apiRoute({
  GET: async (req, res) => {
    const accountId = await requireAccountId(req)
    const params = parsePageParams(req.query, CLIENT_SORT_FIELDS)
    sendOk(res, await listClients(accountId, params, readQuery(req, 'search')))
  },

  POST: async (req, res) => {
    const accountId = await requireAccountId(req)
    const input = createClientSchema.parse(readBody(req))
    sendOk(res, await createClient(accountId, input), 'Client created', 201)
  },
})
