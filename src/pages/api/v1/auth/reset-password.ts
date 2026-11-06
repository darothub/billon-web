import { resetPassword } from '@/server/auth/passwordReset'
import { sendOk } from '@/server/http/envelope'
import { readBody } from '@/server/http/params'
import { apiRoute } from '@/server/http/route'
import { resetPasswordSchema } from '@/server/validation/profile'

/** POST /api/v1/auth/reset-password — set a new password using an emailed token. */
export default apiRoute({
  POST: async (req, res) => {
    await resetPassword(resetPasswordSchema.parse(readBody(req)))
    sendOk(res, null, 'Your password has been updated. You can now sign in.')
  },
})
