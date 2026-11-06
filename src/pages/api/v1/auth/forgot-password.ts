import { requestPasswordReset } from '@/server/auth/passwordReset'
import { sendOk } from '@/server/http/envelope'
import { readBody } from '@/server/http/params'
import { apiRoute } from '@/server/http/route'
import { forgotPasswordSchema } from '@/server/validation/profile'

/** POST /api/v1/auth/forgot-password — email a reset link; the reply never reveals if the account exists. */
export default apiRoute({
  POST: async (req, res) => {
    await requestPasswordReset(forgotPasswordSchema.parse(readBody(req)))
    sendOk(res, null, 'If an account exists for that email, a reset link is on its way.')
  },
})
