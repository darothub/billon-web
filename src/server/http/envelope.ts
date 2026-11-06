import type { NextApiResponse } from 'next'
import type { ApiResponse } from '@/lib/types'

/**
 * The wrapper every reply arrives in.
 *
 * The screens read `res.data.data` and nothing else, so these three keys — and only
 * these three — go out of every address. `data` is present and null on a refusal
 * rather than left out, because a missing key reads as `undefined` in the browser and
 * renders a blank page instead of an error.
 */

export function ok<T>(data: T, message = 'OK'): ApiResponse<T> {
  return { status: 'success', message, data }
}

export function fail(message: string): ApiResponse<never> {
  return { status: 'error', message, data: null }
}

/** Answer with a success wrapper, defaulting to 200. */
export function sendOk<T>(
  res: NextApiResponse,
  data: T,
  message = 'OK',
  statusCode = 200
): void {
  res.status(statusCode).json(ok(data, message))
}

/** Answer with an error wrapper and a code the browser understands. */
export function sendFail(res: NextApiResponse, statusCode: number, message: string): void {
  res.status(statusCode).json(fail(message))
}
