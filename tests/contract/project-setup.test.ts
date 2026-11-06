import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Facts about the project itself: that it names a database library where it named
 * none, that its structure is built from files rather than by hand, that a stranger
 * can follow the README to a sign-in page, that no secret is committed, and that the
 * type check and the tests are actually gates rather than good intentions.
 */

const ROOT = join(__dirname, '..', '..')
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}
const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }

describe('the project names a database library and builds its own structure', () => {
  it('the dependency list names a database library', () => {
    const dbLibraries = ['prisma', '@prisma/client', 'drizzle-orm', 'kysely', 'pg', 'postgres']
    const found = dbLibraries.filter((name) => name in allDeps)
    expect(found, 'package.json names no database library at all').not.toEqual([])
  })

  it('the database structure is described in a file kept in the project', () => {
    expect(existsSync(join(ROOT, 'prisma', 'schema.prisma'))).toBe(true)
  })

  it('the structure is created by running files, not by typing into a database', () => {
    const dir = join(ROOT, 'prisma', 'migrations')
    expect(existsSync(dir), 'prisma/migrations does not exist').toBe(true)
    const migrations = readdirSync(dir).filter((entry) =>
      statSync(join(dir, entry)).isDirectory()
    )
    expect(migrations.length, 'there are no migration files').toBeGreaterThan(0)
    for (const migration of migrations) {
      expect(
        existsSync(join(dir, migration, 'migration.sql')),
        `${migration} has no migration.sql`
      ).toBe(true)
    }
  })

  it('the database itself forbids two invoices in one account sharing a number', () => {
    const schema = readFileSync(join(ROOT, 'prisma', 'schema.prisma'), 'utf8')
    expect(
      schema.replace(/\s+/g, ' '),
      'schema.prisma has no unique rule on (accountId, invoiceNumber)'
    ).toMatch(/@@unique\(\s*\[\s*accountId\s*,\s*invoiceNumber\s*\]/)
  })

  it('each record keeps the id it had in the old database, so the move can be re-run', () => {
    const schema = readFileSync(join(ROOT, 'prisma', 'schema.prisma'), 'utf8')
    for (const model of ['Account', 'Client', 'Invoice']) {
      const block = schema.slice(schema.indexOf(`model ${model} `))
      expect(block.slice(0, block.indexOf('\n}')), `${model} has no legacyId`).toMatch(
        /legacyId\s+Int\?/
      )
    }
  })

  it('money is held as an exact decimal, never as an approximate number', () => {
    const schema = readFileSync(join(ROOT, 'prisma', 'schema.prisma'), 'utf8')
    for (const field of ['subtotal', 'taxTotal', 'total', 'lineTotal', 'taxAmount', 'unitRate']) {
      const line = schema
        .split('\n')
        .find((l) => new RegExp(`^\\s*${field}\\s`).test(l))
      expect(line, `schema.prisma has no ${field} field`).toBeDefined()
      expect(line, `${field} is not stored as an exact decimal`).toMatch(/Decimal/)
      expect(line, `${field} is stored as a floating point number`).not.toMatch(/Float|Double/)
    }
  })
})

describe('a stranger can get to a working sign-in page', () => {
  const readme = existsSync(join(ROOT, 'README.md'))
    ? readFileSync(join(ROOT, 'README.md'), 'utf8')
    : ''

  it('the README is real instructions, not one line', () => {
    expect(readme.split('\n').filter((l) => l.trim()).length).toBeGreaterThan(15)
  })

  it.each([
    ['starting a local database', /docker\s+compose\s+up|docker-compose\s+up/],
    ['building the database structure', /prisma\s+migrate|db:(migrate|push)/],
    ['copying the settings file', /\.env\.example/],
    ['starting the app', /npm\s+run\s+dev|next\s+dev/],
    ['where the sign-in page is', /localhost:3000/],
  ])('the README says how to do %s', (_what, pattern) => {
    expect(readme).toMatch(pattern)
  })

  it('a local database comes with the project', () => {
    expect(
      existsSync(join(ROOT, 'docker-compose.yml')) || existsSync(join(ROOT, 'compose.yml'))
    ).toBe(true)
  })

  it('nothing else has to be running anywhere else', () => {
    expect(readme).not.toMatch(/fly\.io|fly deploy|spring|mvn |gradle/i)
  })

  it('the named commands the README leans on actually exist', () => {
    const scripts = pkg.scripts ?? {}
    for (const name of Object.keys(scripts)) {
      expect(typeof scripts[name]).toBe('string')
    }
    expect(scripts.dev, 'npm run dev is gone').toBeDefined()
    expect(scripts.build).toBeDefined()
    expect(scripts['type-check']).toBeDefined()
  })
})

describe('secrets are not in the project', () => {
  const IGNORED = ['node_modules', '.git', '.next', '.vercel', 'coverage']

  function committedFiles(): string[] {
    return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
      .filter((f) => !IGNORED.some((i) => f.startsWith(i)))
  }

  it('no .env file holding real values is committed', () => {
    const committed = committedFiles().filter(
      (f) => /(^|\/)\.env($|\.)/.test(f) && !f.endsWith('.example')
    )
    expect(committed, `these hold real settings and are committed: ${committed.join(', ')}`).toEqual(
      []
    )
  })

  it('.gitignore covers a plain .env, which the database tools write', () => {
    const ignore = readFileSync(join(ROOT, '.gitignore'), 'utf8')
      .split('\n')
      .map((l) => l.trim())
    expect(ignore).toContain('.env')
  })

  it('no committed file carries a database password, a token secret or mail credentials', () => {
    const patterns = [
      /postgres(ql)?:\/\/[^\s"'`]*:[^\s"'`@]+@(?!localhost|127\.0\.0\.1)/i,
      /JWT_SECRET\s*=\s*["']?(?!.*(change-?me|placeholder|your-|example|<))\S{16,}/i,
      /SMTP_PASS(WORD)?\s*=\s*["']?(?!.*(change-?me|placeholder|your-|example|<))\S{8,}/i,
    ]
    const offenders: string[] = []
    for (const file of committedFiles()) {
      if (/\.(png|jpe?g|gif|ico|pdf|woff2?)$/i.test(file)) continue
      if (file === 'tests/contract/project-setup.test.ts') continue
      let source: string
      try {
        source = readFileSync(join(ROOT, file), 'utf8')
      } catch {
        continue
      }
      if (patterns.some((p) => p.test(source))) offenders.push(file)
    }
    expect(offenders, `these look like they carry a real secret: ${offenders.join(', ')}`).toEqual(
      []
    )
  })

  it('no server-side setting is exposed to the browser by a NEXT_PUBLIC_ prefix', () => {
    const example = readFileSync(join(ROOT, '.env.example'), 'utf8')
    const publicNames = [...example.matchAll(/^\s*(NEXT_PUBLIC_\w+)/gm)].map((m) => m[1])
    expect(
      publicNames,
      `these settings would be handed to every visitor's browser: ${publicNames.join(', ')}`
    ).toEqual([])
  })

  it('the settings file names what the app now actually needs', () => {
    const example = readFileSync(join(ROOT, '.env.example'), 'utf8')
    expect(example).toMatch(/DATABASE_URL/)
    expect(example).toMatch(/JWT_SECRET|AUTH_SECRET|TOKEN_SECRET/)
    expect(example).toMatch(/CRON_SECRET|JOB_SECRET/)
  })
})

describe('the checks are gates rather than good intentions', () => {
  it('the type check reports no errors', () => {
    expect(() =>
      execFileSync('npx', ['tsc', '--noEmit'], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' })
    ).not.toThrow()
  }, 180_000)

  it('there is a command that runs the tests', () => {
    const scripts = pkg.scripts ?? {}
    const test = scripts.test ?? ''
    expect(test, 'package.json has no test script').toMatch(/vitest|jest/)
  })

  it('the tests run on every change and can fail the build', () => {
    const workflows = join(ROOT, '.github', 'workflows')
    const hasCi =
      existsSync(workflows) &&
      readdirSync(workflows).some((f) => {
        const source = readFileSync(join(workflows, f), 'utf8')
        return /npm (run )?test|vitest/.test(source) && /tsc --noEmit|type-check/.test(source)
      })
    const buildRunsTests = /vitest|npm run test/.test((pkg.scripts ?? {}).build ?? '')
    expect(
      hasCi || buildRunsTests,
      'nothing runs the tests automatically — a failing test would not stop a change landing'
    ).toBe(true)
  })
})
