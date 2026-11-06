import { sendOk } from '@/server/http/envelope'
import { apiRoute } from '@/server/http/route'
import { requireAccountId } from '@/server/http/session'
import { saveLogo } from '@/server/profile/logo'
import { readUploadedFile } from '@/server/profile/upload'

/**
 * POST /api/v1/users/me/logo — replace the account's logo.
 *
 * Next's own body reading is turned off here, because what arrives is a form upload
 * carrying an image rather than JSON, and it has to be unpacked from the stream.
 */
export const config = {
  api: {
    bodyParser: false,
  },
}

export default apiRoute({
  POST: async (req, res) => {
    const accountId = await requireAccountId(req)
    const file = await readUploadedFile(req, 'file')
    sendOk(res, await saveLogo(accountId, file.bytes, file.mimeType), 'Logo uploaded')
  },
})
