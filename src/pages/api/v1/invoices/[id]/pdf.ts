import { readId } from '@/server/http/params'
import { apiRoute } from '@/server/http/route'
import { requireAccountId } from '@/server/http/session'
import { renderInvoicePdf } from '@/server/pdf/render'

/**
 * GET /api/v1/invoices/{id}/pdf — the download and preview buttons, and the preview
 * shown straight after raising an invoice.
 *
 * Answers with the document itself rather than the usual wrapper, because a browser
 * has to be able to save or show it. An invoice belonging to somebody else produces a
 * refusal and no document at all.
 */
export default apiRoute({
  GET: async (req, res) => {
    const accountId = await requireAccountId(req)
    const pdf = await renderInvoicePdf(accountId, readId(req))

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Length', String(pdf.body.length))
    res.setHeader('Content-Disposition', `attachment; filename="${pdf.fileName}"`)
    res.setHeader('Cache-Control', 'private, no-store')
    res.status(200).send(pdf.body)
  },
})
