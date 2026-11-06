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
