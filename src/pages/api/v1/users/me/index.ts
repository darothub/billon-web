import { sendOk } from '@/server/http/envelope'
import { readBody } from '@/server/http/params'
import { apiRoute } from '@/server/http/route'
import { requireAccountId } from '@/server/http/session'
import { readProfile, updateProfile } from '@/server/profile/store'
import { updateProfileSchema } from '@/server/validation/profile'

/**
 * GET /api/v1/users/me — the profile the top bar, the settings page and the
 * new-invoice page all read.
 * PUT /api/v1/users/me — saving the settings page.
 */
export default apiRoute({
  GET: async (req, res) => {
    const accountId = await requireAccountId(req)
    sendOk(res, await readProfile(accountId))
  },

  PUT: async (req, res) => {
    const accountId = await requireAccountId(req)
    const input = updateProfileSchema.parse(readBody(req))
    sendOk(res, await updateProfile(accountId, input), 'Settings saved')
  },
})
