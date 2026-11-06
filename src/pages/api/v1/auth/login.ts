import { login } from '@/server/auth/accounts'
import { sendOk } from '@/server/http/envelope'
import { readBody } from '@/server/http/params'
import { apiRoute } from '@/server/http/route'
import { loginSchema } from '@/server/validation/profile'

/** POST /api/v1/auth/login — let an existing person in. */
export default apiRoute({
  POST: async (req, res) => {
    const input = loginSchema.parse(readBody(req))
    const result = await login(input)
    sendOk(res, result, 'Signed in')
  },
})
