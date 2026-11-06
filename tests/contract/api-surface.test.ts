import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * The move is only finished when every request a screen makes is answered by code
 * inside this project, and nothing anywhere can still reach Fly.io.
 *
 * The checklist below is checked off one by one, and it is also derived afresh from
 * the screens on every run — so a screen that starts calling a new address fails
 * this file rather than quietly reaching an address nobody built.
 *
 * A note on counting. The switchover criterion was '32 requests, 22 distinct
 * addresses'. Since then the screens gained three calls: the app shell checks the
 * session with GET /users/me, and the forgot-password and reset-password pages add
 * two new addresses. That makes 35 call sites and 24 distinct method-and-address
 * pairs; several pages call the same address (four read /users/me, three list
 * /clients, three list /invoices, three fetch a PDF). The tests below assert 35
 * and 24 and list all 24, and fail by name if a screen calls anything else.
 */

const ROOT = join(__dirname, '..', '..')
const SRC = join(ROOT, 'src')

/** The 24 addresses, ticked off one by one, each with the file that must answer it. */
const CHECKLIST: ReadonlyArray<{ method: string; path: string; handler: string }> = [
  { method: 'POST', path: '/auth/login', handler: 'src/pages/api/v1/auth/login.ts' },
  { method: 'POST', path: '/auth/register', handler: 'src/pages/api/v1/auth/register.ts' },
  {
    method: 'POST',
    path: '/auth/forgot-password',
    handler: 'src/pages/api/v1/auth/forgot-password.ts',
  },
  {
    method: 'POST',
    path: '/auth/reset-password',
    handler: 'src/pages/api/v1/auth/reset-password.ts',
  },
  { method: 'GET', path: '/users/me', handler: 'src/pages/api/v1/users/me/index.ts' },
  { method: 'PUT', path: '/users/me', handler: 'src/pages/api/v1/users/me/index.ts' },
  { method: 'POST', path: '/users/me/logo', handler: 'src/pages/api/v1/users/me/logo.ts' },
  { method: 'GET', path: '/dashboard/summary', handler: 'src/pages/api/v1/dashboard/summary.ts' },
  { method: 'GET', path: '/clients', handler: 'src/pages/api/v1/clients/index.ts' },
  { method: 'POST', path: '/clients', handler: 'src/pages/api/v1/clients/index.ts' },
  { method: 'GET', path: '/clients/{id}', handler: 'src/pages/api/v1/clients/[id].ts' },
  { method: 'PUT', path: '/clients/{id}', handler: 'src/pages/api/v1/clients/[id].ts' },
  { method: 'DELETE', path: '/clients/{id}', handler: 'src/pages/api/v1/clients/[id].ts' },
  { method: 'GET', path: '/invoices', handler: 'src/pages/api/v1/invoices/index.ts' },
  { method: 'POST', path: '/invoices', handler: 'src/pages/api/v1/invoices/index.ts' },
  { method: 'GET', path: '/invoices/{id}', handler: 'src/pages/api/v1/invoices/[id]/index.ts' },
  { method: 'PUT', path: '/invoices/{id}', handler: 'src/pages/api/v1/invoices/[id]/index.ts' },
  { method: 'DELETE', path: '/invoices/{id}', handler: 'src/pages/api/v1/invoices/[id]/index.ts' },
  { method: 'POST', path: '/invoices/{id}/send', handler: 'src/pages/api/v1/invoices/[id]/send.ts' },
  {
    method: 'POST',
    path: '/invoices/{id}/mark-paid',
    handler: 'src/pages/api/v1/invoices/[id]/mark-paid.ts',
  },
  { method: 'POST', path: '/invoices/{id}/void', handler: 'src/pages/api/v1/invoices/[id]/void.ts' },
  {
    method: 'POST',
    path: '/invoices/{id}/line-items',
    handler: 'src/pages/api/v1/invoices/[id]/line-items/index.ts',
  },
  {
    method: 'DELETE',
    path: '/invoices/{id}/line-items/{itemId}',
    handler: 'src/pages/api/v1/invoices/[id]/line-items/[itemId].ts',
  },
  { method: 'GET', path: '/invoices/{id}/pdf', handler: 'src/pages/api/v1/invoices/[id]/pdf.ts' },
]

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

/** Every file that draws a screen — that is, everything under src except the server half. */
function screenFiles(): string[] {
  return walk(SRC).filter(
    (f) =>
      /\.tsx?$/.test(f) &&
      !f.includes(join('src', 'server')) &&
      !f.includes(join('src', 'pages', 'api'))
  )
}

interface CallSite {
  file: string
  method: string
  path: string
}

/** Find every `api.get(...)`, `api.post(...)` etc. the screens make. */
function callSites(): CallSite[] {
  const pattern = /\bapi\.(get|post|put|patch|delete)\s*(?:<[^(]*?>)?\s*\(\s*([`'"])([^`'"]*)\2/g
  const found: CallSite[] = []
  for (const file of screenFiles()) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(pattern)) {
      found.push({
        file: relative(ROOT, file),
        method: match[1].toUpperCase(),
        // `/invoices/${id}/pdf` -> /invoices/{id}/pdf
        path: match[3].replace(/\$\{[^}]*\}/g, '{id}'),
      })
    }
  }
  return found
}

/** Turn a call site's path into its checklist form, naming the second id properly. */
function normalise(site: CallSite): string {
  const path = site.path.replace(/\/line-items\/\{id\}$/, '/line-items/{itemId}')
  return `${site.method} ${path}`
}

describe('every request the screens make is answered inside this project', () => {
  it('finds the 35 requests the screens make today', () => {
    const sites = callSites()
    expect(
      sites.length,
      `expected 35 call sites, found ${sites.length}:\n` +
        sites.map((s) => `  ${s.method} ${s.path}  (${s.file})`).join('\n')
    ).toBe(35)
  })

  it('those 35 requests are the 24 distinct addresses on the checklist, and no others', () => {
    const derived = [...new Set(callSites().map(normalise))].sort()
    const checklist = [...new Set(CHECKLIST.map((c) => `${c.method} ${c.path}`))].sort()

    const unbuilt = derived.filter((d) => !checklist.includes(d))
    const unused = checklist.filter((c) => !derived.includes(c))
    expect(
      unbuilt,
      `a screen calls an address that is not on the checklist: ${unbuilt.join(', ')}`
    ).toEqual([])
    expect(unused, `the checklist names an address no screen calls: ${unused.join(', ')}`).toEqual(
      []
    )
    expect(derived).toHaveLength(24)
  })

  it.each(CHECKLIST)('$method $path is answered by $handler', ({ handler }) => {
    const full = join(ROOT, handler)
    expect(existsSync(full), `${handler} does not exist`).toBe(true)
    const source = readFileSync(full, 'utf8')
    expect(source, `${handler} exports no default request handler`).toMatch(/export\s+default/)
  })

  it('every handler file the screens need is under src/pages/api/v1', () => {
    for (const { handler } of CHECKLIST) {
      expect(handler.startsWith('src/pages/api/v1/')).toBe(true)
    }
  })

  it('the nightly overdue address exists too, though no screen calls it', () => {
    expect(existsSync(join(ROOT, 'src/pages/api/v1/jobs/mark-overdue.ts'))).toBe(true)
  })

  it('the address that hands back a logo picture exists, because the profile points at it', () => {
    expect(existsSync(join(ROOT, 'src/pages/api/v1/users/[id]/logo.ts'))).toBe(true)
  })
})

describe('nothing can still reach the old Java service', () => {
  const IGNORED = [
    'node_modules', '.git', '.next', '.vercel', '.orgkit',
    'dist', 'coverage', 'tsconfig.tsbuildinfo',
  ]
  const OLD_HOST = ['billon-api', 'fly', 'dev'].join('.')
  const OLD_PUBLIC_SETTING = ['NEXT', 'PUBLIC', 'API', 'URL'].join('_')

  function projectFiles(): string[] {
    const out: string[] = []
    const stack = [ROOT]
    while (stack.length) {
      const dir = stack.pop()!
      for (const entry of readdirSync(dir)) {
        if (IGNORED.includes(entry)) continue
        const full = join(dir, entry)
        const stat = statSync(full)
        if (stat.isDirectory()) stack.push(full)
        else if (stat.isFile() && !/\.(png|jpe?g|gif|ico|pdf|woff2?|lock)$/i.test(entry)) out.push(full)
      }
    }
    return out
  }

  function search(needle: string): string[] {
    return projectFiles()
      .filter((file) => relative(ROOT, file) !== relative(ROOT, __filename))
      .filter((file) => {
        try {
          return readFileSync(file, 'utf8').includes(needle)
        } catch {
          return false
        }
      })
      .map((file) => relative(ROOT, file))
  }

  it('the removed Java host is absent from project files', () => {
    const hits = search(OLD_HOST)
    expect(hits, `still mentions the old service in: ${hits.join(', ')}`).toEqual([])
  })

  it('the removed browser-visible server setting is absent from project files', () => {
    const hits = search(OLD_PUBLIC_SETTING)
    expect(hits, `still mentions the deleted setting in: ${hits.join(', ')}`).toEqual([])
  })

  it('the shared HTTP client points at the app itself', () => {
    const source = readFileSync(join(SRC, 'lib', 'api.ts'), 'utf8')
    expect(source).toMatch(/baseURL:\s*['"`]\/api\/v1['"`]/)
    expect(source).not.toMatch(/process\.env\./)
  })

  it('the shared HTTP client still signs a person out on a refusal, exactly as before', () => {
    const source = readFileSync(join(SRC, 'lib', 'api.ts'), 'utf8')
    expect(source).toContain('billon_token')
    expect(source).toMatch(/status\s*===\s*401/)
    // Forget the token, empty the signed-in state, and leave the page — in that
    // order. Skipping the middle step is what leaves stale figures on screen for a
    // moment before the redirect lands.
    expect(source).toMatch(/Cookies\.remove\(\s*['"]billon_token['"]\s*\)/)
    expect(source).toMatch(/useAuthStore\.getState\(\)\.logout\(\)/)
    expect(source).toContain("window.location.replace('/login')")
  })
})
