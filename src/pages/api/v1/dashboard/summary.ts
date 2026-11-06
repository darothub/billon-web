import { readDashboardSummary } from '@/server/dashboard/summary'
import { sendOk } from '@/server/http/envelope'
import { apiRoute } from '@/server/http/route'
import { requireAccountId } from '@/server/http/session'

/** GET /api/v1/dashboard/summary — the nine figures on the front page. */
export default apiRoute({
  GET: async (req, res) => {
    const accountId = await requireAccountId(req)
    sendOk(res, await readDashboardSummary(accountId))
  },
})
