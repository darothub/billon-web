import { Readable } from 'node:stream'
import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next'

/**
 * Calls a Next.js request handler the way the framework would, and hands back
 * everything the handler said: the status, the headers, the JSON body, and the raw
 * bytes for the addresses that answer with a file rather than JSON.
 *
 * The screens go through axios, which reads `res.data`; here we read `body`. The
 * shape in between is the same object, which is the point.
 */

export interface CallOptions {
  method?: string
  query?: Record<string, string | string[]>
  body?: unknown
  headers?: Record<string, string>
  cookies?: Record<string, string>
  /** Sign-in token to send as `Authorization: Bearer …`. */
  token?: string
  /**
   * Send raw bytes rather than JSON — the logo upload address turns Next's own
   * body reading off and unpacks the form itself, so it needs a real stream.
   */
  raw?: { body: Buffer; contentType: string }
}

export interface CallResult<T = any> {
  status: number
  headers: Record<string, string | number | string[]>
  body: T
  buffer: Buffer
  durationMs: number
}

export async function call<T = any>(
  handler: NextApiHandler,
  options: CallOptions = {}
): Promise<CallResult<T>> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...lowercaseKeys(options.headers ?? {}),
  }
  if (options.token) headers.authorization = `Bearer ${options.token}`
  if (options.raw) {
    headers['content-type'] = options.raw.contentType
    headers['content-length'] = String(options.raw.body.length)
  }

  const base = options.raw
    ? Readable.from([options.raw.body])
    : ({} as Record<string, unknown>)
  const req = Object.assign(base, {
    method: options.method ?? 'GET',
    url: '/api/v1/test',
    query: options.query ?? {},
    cookies: options.cookies ?? {},
    headers,
    body: options.raw ? undefined : options.body,
  }) as unknown as NextApiRequest

  const chunks: Buffer[] = []
  let status = 200
  let jsonBody: unknown
  const outHeaders: Record<string, string | number | string[]> = {}
  let settle: () => void = () => {}
  const finished = new Promise<void>((resolve) => {
    settle = resolve
  })

  const res = {
    statusCode: 200,
    status(code: number) {
      status = code
      res.statusCode = code
      return res
    },
    setHeader(name: string, value: string | number | string[]) {
      outHeaders[name.toLowerCase()] = value
      return res
    },
    getHeader(name: string) {
      return outHeaders[name.toLowerCase()]
    },
    removeHeader(name: string) {
      delete outHeaders[name.toLowerCase()]
    },
    json(payload: unknown) {
      jsonBody = payload
      chunks.push(Buffer.from(JSON.stringify(payload)))
      settle()
      return res
    },
    send(payload: unknown) {
      if (Buffer.isBuffer(payload)) chunks.push(payload)
      else if (typeof payload === 'string') chunks.push(Buffer.from(payload))
      else if (payload !== undefined) {
        jsonBody = payload
        chunks.push(Buffer.from(JSON.stringify(payload)))
      }
      settle()
      return res
    },
    write(chunk: Buffer | string) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      return true
    },
    end(chunk?: Buffer | string) {
      if (chunk) res.write(chunk)
      settle()
      return res
    },
    writeHead(code: number, given?: Record<string, string>) {
      status = code
      res.statusCode = code
      for (const [k, v] of Object.entries(given ?? {})) outHeaders[k.toLowerCase()] = v
      return res
    },
  } as unknown as NextApiResponse

  const startedAt = performance.now()
  await handler(req, res)
  // A handler may hand back before its last write lands; wait for the response to close.
  await Promise.race([finished, new Promise((r) => setTimeout(r, 0))])
  const durationMs = performance.now() - startedAt

  const buffer = Buffer.concat(chunks)
  if (jsonBody === undefined && buffer.length && isProbablyJson(outHeaders)) {
    try {
      jsonBody = JSON.parse(buffer.toString('utf8'))
    } catch {
      /* not JSON; leave the raw bytes to the caller */
    }
  }

  return { status, headers: outHeaders, body: jsonBody as T, buffer, durationMs }
}

function isProbablyJson(headers: Record<string, unknown>): boolean {
  const type = String(headers['content-type'] ?? 'application/json')
  return type.includes('json')
}

function lowercaseKeys(input: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(input).map(([k, v]) => [k.toLowerCase(), v]))
}

/** Load a handler by its path under src/pages/api, e.g. 'v1/invoices/index'. */
export async function handlerAt(routeFile: string): Promise<NextApiHandler> {
  const mod = await import(/* @vite-ignore */ `@/pages/api/${routeFile}`)
  if (typeof mod.default !== 'function') {
    throw new Error(`src/pages/api/${routeFile} has no default request handler`)
  }
  return mod.default as NextApiHandler
}
