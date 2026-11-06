import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Four groups, because they need different things to be true before they can run.
//
//   unit      — pure functions and repository facts. No database, no network. Runs on
//               every change; this is the group the build gate must not be able to skip.
//   db        — drives the real request handlers against a real PostgreSQL. Needs
//               DATABASE_URL pointing at a scratch database (never the live one).
//   rehearsal — the data move, run against a restored copy of the old database. Needs
//               LEGACY_DATABASE_URL as well, so it is a deliberate step before the
//               switchover (`npm run test:rehearsal`), not part of `test:db`.
//   release   — the changeover evidence gate. Reads the written record in docs/ and
//               tests/manual/. Expected to be red until a human has actually done and
//               signed off each step, so it is NOT part of the per-change build gate.
//
// Run them with:
//   npx vitest run --project unit
//   npx vitest run --project db
//   npx vitest run --project rehearsal
//   npx vitest run --project release
const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    root,
    // The database projects share one scratch schema. Keeping all project files
    // sequential avoids inter-file cleanup racing another test's request.
    fileParallelism: false,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts', 'tests/contract/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'db',
          environment: 'node',
          include: [
            'tests/db/**/*.test.ts',
            'tests/e2e/**/*.test.ts',
            'tests/perf/**/*.test.ts',
          ],
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'rehearsal',
          environment: 'node',
          include: ['tests/migration/**/*.test.ts'],
          testTimeout: 600_000,
          hookTimeout: 600_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'release',
          environment: 'node',
          include: ['tests/release/**/*.test.ts'],
        },
      },
    ],
  },
})
