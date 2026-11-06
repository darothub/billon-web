import { sendOk } from '@/server/http/envelope'
import { apiRoute, type MethodHandler } from '@/server/http/route'
import { requireJobSecret } from '@/server/http/session'
import { markOverdue } from '@/server/jobs/markOverdue'

/**
 * POST or GET /api/v1/jobs/mark-overdue — the nightly sweep.
 *
 * Not a person, so it carries a shared secret rather than a sign-in token. Both
 * methods answer, because the hosting platform's schedule may send either and a job
 * that answers only POST would silently never run.
 *
 * The answer says what the run did, so a schedule's own log shows it without anybody
 * having to open the database. A run that fails says so with a 500, and the record of
 * the run in the database says why.
 */
const run: MethodHandler = async (req, res) => {
  requireJobSecret(req)
  const result = await markOverdue()
  sendOk(res, result, `${result.invoicesChanged} invoices marked overdue`)
}

export default apiRoute({ GET: run, POST: run })
