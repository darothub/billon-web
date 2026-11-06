import type { NextApiResponse } from 'next'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { sendFail } from './envelope'

/**
 * A refusal with a code and a message a person can be shown.
 *
 * Everything the server refuses on purpose is thrown as one of these; anything else
 * is a fault, and a fault is answered with an apology rather than its own words,
 * because its own words are a stack trace.
 */
export class ApiError extends Error {
  readonly statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
  }
}

export const notFound = (what: string) => new ApiError(404, `${what} could not be found.`)
export const badRequest = (message: string) => new ApiError(400, message)
export const conflict = (message: string) => new ApiError(409, message)
export const unauthorised = () =>
  new ApiError(401, 'Your session has ended. Please sign in again.')

/** Turn anything thrown by a handler into a reply. */
export function respondToError(res: NextApiResponse, error: unknown): void {
  if (error instanceof ApiError) {
    sendFail(res, error.statusCode, error.message)
    return
  }

  if (error instanceof ZodError) {
    sendFail(res, 400, describeZodError(error))
    return
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    sendFail(res, 409, describeUniqueClash(error))
    return
  }

  const known = describeInfrastructureFault(error)
  if (known) {
    console.error(`[billon] ${known.log}`, error)
    sendFail(res, known.status, known.message)
    return
  }

  // Nothing we meant to happen. Say so plainly and keep the detail in the logs.
  console.error('[billon] unhandled error answering a request', error)
  sendFail(res, 500, 'Something went wrong at our end. Please try again.')
}

/** Every message the checker produced, joined into one sentence a screen can show. */
export function describeZodError(error: ZodError): string {
  const messages = error.issues.map((issue) => issue.message).filter(Boolean)
  return messages.length > 0
    ? Array.from(new Set(messages)).join(' ')
    : 'Some of those details could not be accepted. Please check them and try again.'
}

function describeUniqueClash(error: Prisma.PrismaClientKnownRequestError): string {
  const target = error.meta?.target
  const fields = Array.isArray(target) ? target.map(String) : [String(target ?? '')]
  if (fields.includes('invoiceNumber')) {
    return 'That invoice number is already used by another invoice on your account.'
  }
  if (fields.includes('email')) {
    return 'That email address is already in use.'
  }
  return 'Those details are already in use. Please choose something else.'
}

interface Fault {
  status: number
  message: string
  log: string
}

/**
 * Faults that are about how the app is set up rather than what the person did.
 * The words are safe to show (no connection strings or stack traces); the full
 * error still goes to the server logs.
 */
function describeInfrastructureFault(error: unknown): Fault | null {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: 503,
      message: 'Billon cannot reach its database right now. Please try again in a few minutes.',
      log: `database connection failed (${error.errorCode ?? 'no code'}) — check DATABASE_URL`,
    }
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2021' || error.code === 'P2022') {
      return {
        status: 503,
        message: 'Billon\'s database has not been set up yet. Please contact support.',
        log: `database tables are missing or out of date (${error.code}) — run prisma migrate deploy`,
      }
    }
    if (['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(error.code)) {
      return {
        status: 503,
        message: 'Billon cannot reach its database right now. Please try again in a few minutes.',
        log: `database unavailable (${error.code})`,
      }
    }
  }
  if (error instanceof Error && /JWT_SECRET is not set/.test(error.message)) {
    return {
      status: 500,
      message: 'Billon is not fully configured, so signing in is unavailable. Please contact support.',
      log: 'JWT_SECRET is not set',
    }
  }
  return null
}
