import bcrypt from 'bcryptjs'

/**
 * Scrambling a password one way, and checking a typed one against a stored scramble.
 *
 * Which method scrambled a password is recorded per account, because some accounts
 * carry scrambles inherited from the old Java service and how it made them was not
 * knowable from this project. Checking is therefore driven by what the stored value
 * actually looks like, with the recorded method as the hint — and once somebody has
 * signed in successfully, their password is quietly re-scrambled to the current
 * method, so accounts drift onto it by themselves and nobody is asked to reset
 * anything.
 */

export const CURRENT_ALGORITHM = 'bcrypt'

const BCRYPT_ROUNDS = 10
const BCRYPT_SHAPE = /^\$2[aby]?\$\d{2}\$/

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

export async function verifyPassword(
  plain: string,
  storedHash: string,
  algorithm: string = CURRENT_ALGORITHM
): Promise<boolean> {
  if (!plain || !storedHash) return false

  // Spring Security's default is bcrypt, and a bcrypt scramble says so in its own
  // first few characters. Trust the shape over the label, so an account labelled
  // 'legacy-java' whose scramble turns out to be ordinary bcrypt still signs in.
  if (BCRYPT_SHAPE.test(storedHash)) {
    try {
      return await bcrypt.compare(plain, storedHash)
    } catch {
      return false
    }
  }

  // Anything else is a scrambling method Billon does not know how to reproduce.
  // Refusing is the only honest answer; docs/JAVA-SERVICE-FINDINGS.md is where the
  // real method gets written down, and a checker for it would be added here.
  console.warn(`[billon] cannot check a password scrambled with '${algorithm}'`)
  return false
}

/** Does this account's password need re-scrambling to the current method? */
export function needsRehash(algorithm: string, storedHash: string): boolean {
  if (algorithm !== CURRENT_ALGORITHM) return true
  return !BCRYPT_SHAPE.test(storedHash)
}
