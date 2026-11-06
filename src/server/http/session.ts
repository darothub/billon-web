import type { NextApiRequest } from 'next'
import { readToken } from '@/server/auth/token'
import { unauthorised } from './errors'

/**
 * Who is asking.
 *
 * The account always comes from the sign-in token and never from the request, and
 * every store below filters by whatever this returns. That is the one rule keeping
 * one person's invoices away from another's: a forgotten check finds nothing rather
 * than showing somebody else's records.
 */

export async function requireAccountId(req: NextApiRequest): Promise<number> {
  const claims = await readToken(bearerToken(req) ?? req.cookies.billon_token)
  if (!claims) throw unauthorised()
  return claims.accountId
}

function bearerToken(req: NextApiRequest): string | undefined {
  const header = req.headers.authorization
  if (!header) return undefined
  const [scheme, value] = header.split(' ')
  if (!value || scheme.toLowerCase() !== 'bearer') return undefined
  return value.trim()
}

/**
 * The nightly sweep is not a person, so it carries a shared secret rather than a
 * sign-in token. A missing or wrong one is refused.
 */
export function requireJobSecret(req: NextApiRequest): void {
  const expected = process.env.CRON_SECRET
  if (!expected) throw unauthorised()
  const given = bearerToken(req) ?? readHeader(req, 'x-cron-secret')
  if (!given || given !== expected) throw unauthorised()
}

function readHeader(req: NextApiRequest, name: string): string | undefined {
  const raw = req.headers[name]
  return Array.isArray(raw) ? raw[0] : raw
}
