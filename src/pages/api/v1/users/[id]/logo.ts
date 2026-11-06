import { readId } from '@/server/http/params'
import { apiRoute } from '@/server/http/route'
import { requireAccountId } from '@/server/http/session'
import { notFound } from '@/server/http/errors'
import { readLogo } from '@/server/profile/logo'

/**
 * GET /api/v1/users/{id}/logo — the picture itself.
 *
 * This is the address a profile's `logoUrl` points at, so the settings page and the
 * PDF can show the logo. Only the owning account can read these private bytes.
 */
export default apiRoute({
  GET: async (req, res) => {
    const accountId = await requireAccountId(req)
    if (readId(req) !== accountId) throw notFound('That logo')
    const logo = await readLogo(accountId)

    res.setHeader('Content-Type', logo.mimeType)
    res.setHeader('Content-Length', String(logo.image.length))
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('ETag', `"logo-${accountId}-${logo.updatedAt.getTime()}"`)
    res.status(200).send(logo.image)
  },
})
