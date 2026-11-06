import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import baseline from './screen-baseline.json'

/**
 * No screen had to change how it reads a reply.
 *
 * Two halves, because one of them rots and the other does not:
 *
 *  - The git check proves the thirteen reply-reading files are byte-for-byte what
 *    they were before this work. It is exact, and it is the direct evidence for the
 *    criterion. Once the move has landed and been signed off, move `baselineRef` in
 *    screen-baseline.json forward so later, unrelated screen work is not blocked.
 *  - The idiom check proves the screens still read `res.data.data` and still read
 *    the page keys by name. That stays true for as long as the promise does.
 */

const ROOT = join(__dirname, '..', '..')

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

const ref = process.env.BILLON_SCREEN_BASELINE ?? baseline.baselineRef

// Files with a reviewed edit are held to a narrower rule below: they may differ from
// the baseline, but not on any line that reads a reply. Every other file must be exact.
const reviewed = Object.keys(baseline.reviewedEdits)
const strictFiles = baseline.replyReadingFiles.filter((f) => !reviewed.includes(f))
const READS_A_REPLY =
  /\.data\b|\bres\b|\.then\(|useQuery|useMutation|queryFn|mutationFn|onSuccess|\bapi\./

describe('the screens are untouched by this work', () => {
  it('the recorded baseline commit is still in this repository', () => {
    expect(() => git('rev-parse', '--verify', `${ref}^{commit}`)).not.toThrow()
  })

  it('no reply-reading file differs from the baseline commit', () => {
    const changed = git('diff', '--name-only', ref, '--', ...strictFiles)
      .split('\n')
      .filter(Boolean)
    expect(
      changed,
      'these screens changed, so the promise that no screen had to change is not kept:\n  ' +
        changed.join('\n  ')
    ).toEqual([])
  })

  it('no reply-reading file is sitting modified in the working tree either', () => {
    const dirty = git('status', '--porcelain', '--', ...strictFiles)
      .split('\n')
      .filter(Boolean)
    expect(dirty, `uncommitted screen changes:\n  ${dirty.join('\n  ')}`).toEqual([])
  })

  it('a reviewed edit never touches a line that reads a reply', () => {
    for (const file of reviewed) {
      expect(baseline.replyReadingFiles, `${file} is reviewed but not a reply-reading file`).toContain(file)
      const touched = git('diff', '--unified=0', ref, '--', file)
        .split('\n')
        .filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l))
        .filter((l) => READS_A_REPLY.test(l))
      expect(touched, `${file} changed how it reads a reply:\n  ${touched.join('\n  ')}`).toEqual([])
    }
  })

  it('only the shared HTTP client was deliberately changed', () => {
    expect(baseline.deliberatelyChanged).toEqual(['src/lib/api.ts'])
    const diff = git('diff', '--unified=0', ref, '--', 'src/lib/api.ts')
    const addedLines = diff
      .split('\n')
      .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
      .map((l) => l.slice(1).trim())
      .filter(Boolean)
    // One line changes. A comment or two is fine; a rewrite is not.
    expect(
      addedLines.filter((l) => !l.startsWith('//')),
      `more than the base address changed in src/lib/api.ts:\n  ${addedLines.join('\n  ')}`
    ).toHaveLength(1)
  })
})

describe('the screens still read replies the same way', () => {
  const sources = baseline.replyReadingFiles.map((f) => ({
    file: f,
    source: readFileSync(join(ROOT, f), 'utf8'),
  }))

  it('every screen that reads a reply still unwraps it as res.data.data', () => {
    const replyReaders = sources.filter(({ source }) =>
      /(?:res|r)\.data|\.then\(\(res\)/.test(source)
    )
    expect(replyReaders.length).toBeGreaterThan(0)
    for (const { file, source } of replyReaders) {
      expect(source, `${file} no longer unwraps the reply the same way`).toMatch(
        /res\.data\.data|r\.data\.data|\.then\(\(res\) => res\.data\.data/
      )
    }
  })

  it('the reply wrapper is still described with status, message and data', () => {
    const types = readFileSync(join(ROOT, 'src', 'lib', 'types.ts'), 'utf8')
    expect(types).toMatch(/status:\s*'success'\s*\|\s*'error'/)
    expect(types).toMatch(/message:\s*string/)
    expect(types).toMatch(/data:\s*T\s*\|\s*null/)
  })

  it('the page shape is still described with all seven keys', () => {
    const types = readFileSync(join(ROOT, 'src', 'lib', 'types.ts'), 'utf8')
    for (const key of [
      'content',
      'page',
      'size',
      'totalElements',
      'totalPages',
      'first',
      'last',
    ]) {
      expect(types, `PageResponse lost '${key}'`).toMatch(new RegExp(`\\b${key}:`))
    }
  })

  it('the screens still read the page keys by name', () => {
    const invoices = readFileSync(join(ROOT, 'src', 'pages', 'invoices', 'index.tsx'), 'utf8')
    expect(invoices).toMatch(/totalPages|totalElements/)
    const clients = readFileSync(join(ROOT, 'src', 'pages', 'clients', 'index.tsx'), 'utf8')
    expect(clients).toMatch(/totalPages|totalElements/)
  })

  it('there is still exactly one description of every shape, in src/lib/types.ts', () => {
    // The whole point of collapsing the two projects was to stop two copies drifting.
    const serverTypes = join(ROOT, 'src', 'server', 'types.ts')
    let exists = true
    try {
      readFileSync(serverTypes, 'utf8')
    } catch {
      exists = false
    }
    expect(exists, 'src/server/types.ts is a second copy of the shapes — use src/lib/types.ts').toBe(
      false
    )
  })
})
