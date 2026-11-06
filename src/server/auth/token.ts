import { SignJWT, jwtVerify } from 'jose'

/**
 * Sign-in tokens.
 *
 * A signed token says which account is asking, so nothing has to be kept on the
 * server between requests. A missing, altered or expired one is refused — which is
 * what the browser turns into signing the person out.
 */

const ISSUER = 'billon'
const LIFETIME = '30d'

export interface TokenClaims {
  accountId: number
}

const DEVELOPMENT_SECRET = 'billon-development-only-not-for-anything-real'

function secret(): Uint8Array {
  const configured = process.env.JWT_SECRET
  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is not set. Billon cannot sign anybody in without it.')
    }
    return new TextEncoder().encode(DEVELOPMENT_SECRET)
  }
  return new TextEncoder().encode(configured)
}

export async function signToken(claims: TokenClaims): Promise<string> {
  return new SignJWT({ accountId: claims.accountId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setSubject(String(claims.accountId))
    .setIssuedAt()
    .setExpirationTime(LIFETIME)
    .sign(secret())
}

/** The claims in a token, or null if it is missing, altered, expired or nonsense. */
export async function readToken(token: string | undefined): Promise<TokenClaims | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER })
    const accountId = Number(payload.accountId)
    return Number.isInteger(accountId) && accountId > 0 ? { accountId } : null
  } catch {
    return null
  }
}
