import { register } from '@/server/auth/accounts'
import { sendOk } from '@/server/http/envelope'
import { readBody } from '@/server/http/params'
import { apiRoute } from '@/server/http/route'
import { registerSchema } from '@/server/validation/profile'

/** POST /api/v1/auth/register — create an account and sign the person straight in. */
export default apiRoute({
  POST: async (req, res) => {
    const input = registerSchema.parse(readBody(req))
    const result = await register(input)
    sendOk(res, result, 'Welcome to Billon', 201)
  },
})
