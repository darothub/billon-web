import type { NextApiRequest } from 'next'
import { badRequest } from './errors'

/**
 * Reading the pieces of a web address. A record number that is not a number is a bad
 * request, not a crash, and never something that reaches a query.
 */

export function readId(req: NextApiRequest, name = 'id'): number {
  const raw = req.query[name]
  const value = Array.isArray(raw) ? raw[0] : raw
  const parsed = Number(value)
  if (!value || !Number.isInteger(parsed) || parsed <= 0) {
    throw badRequest('That address does not name a record.')
  }
  return parsed
}

/** A single query value, whichever way Next hands it over. */
export function readQuery(req: NextApiRequest, name: string): string | undefined {
  const raw = req.query[name]
  const value = Array.isArray(raw) ? raw[0] : raw
  return value === undefined || value === '' ? undefined : String(value)
}

/** The body, as an object, whatever arrived. */
export function readBody(req: NextApiRequest): unknown {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      throw badRequest('That request could not be read.')
    }
  }
  return req.body ?? {}
}
