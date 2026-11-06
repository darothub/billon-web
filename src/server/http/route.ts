import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next'
import { respondToError } from './errors'
import { sendFail } from './envelope'

/**
 * What every address under /api/v1 is built from.
 *
 * A handler reads the request, asks the right part below to do the work, and hands
 * back the answer. It holds no rules of its own, and it never has to remember to
 * catch anything: a refusal thrown anywhere underneath arrives here and becomes the
 * right code with a message a person can be shown.
 */

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type MethodHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void>

export function apiRoute(handlers: Partial<Record<Method, MethodHandler>>): NextApiHandler {
  return async function handle(req, res) {
    const method = (req.method ?? 'GET').toUpperCase() as Method
    const handler = handlers[method]

    if (!handler) {
      res.setHeader('Allow', Object.keys(handlers).join(', '))
      sendFail(res, 405, `This address does not answer ${method} requests.`)
      return
    }

    try {
      await handler(req, res)
    } catch (error) {
      respondToError(res, error)
    }
  }
}
