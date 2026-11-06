import { deleteClient, readClient, updateClient } from '@/server/clients/store'
import { sendOk } from '@/server/http/envelope'
import { readBody, readId } from '@/server/http/params'
import { apiRoute } from '@/server/http/route'
import { requireAccountId } from '@/server/http/session'
import { updateClientSchema } from '@/server/validation/clients'

/**
 * GET, PUT and DELETE /api/v1/clients/{id} — the client page.
 *
 * A client belonging to somebody else is refused as not found, which both refuses and
 * declines to confirm that the record exists.
 */
export default apiRoute({
  GET: async (req, res) => {
    const accountId = await requireAccountId(req)
    sendOk(res, await readClient(accountId, readId(req)))
  },

  PUT: async (req, res) => {
    const accountId = await requireAccountId(req)
    const input = updateClientSchema.parse(readBody(req))
    sendOk(res, await updateClient(accountId, readId(req), input), 'Client saved')
  },

  DELETE: async (req, res) => {
    const accountId = await requireAccountId(req)
    await deleteClient(accountId, readId(req))
    sendOk(res, null, 'Client deleted')
  },
})
