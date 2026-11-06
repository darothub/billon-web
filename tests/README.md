# Tests

Written with **Vitest**, which the design already chose and which is the plain,
common choice for a TypeScript project on Node. It runs TypeScript directly, so no
build step stands between a change and a test run.

## The three groups

| Group | What it needs | When it runs |
|---|---|---|
| `unit` | nothing | every change — this is the build gate |
| `db` | a scratch PostgreSQL | every change, in CI, against a throwaway database |
| `release` | a person having done the work | before the switchover is called finished |

```bash
npx vitest run --project unit
DATABASE_URL=postgresql://billon:billon@localhost:5432/billon_test npx vitest run --project db
npx vitest run --project release
```

The `db` group truncates every table between tests. `tests/helpers/db.ts` refuses to
run unless `DATABASE_URL` points somewhere local or ends in `_test`/`_scratch`/`_ci`.
There is deliberately no "skip if there is no database" — a silently skipped test for
invoice numbering or for one account reading another's records is worse than no test.

## Before the Java service is switched off

Four things can only be captured while the old system is still up. Once it is off,
the criteria that depend on them cannot be met at all:

- `tests/fixtures/dashboard-before-the-move.json` — a sample account's nine dashboard figures
- `tests/fixtures/invoice-sample-before-the-move.json` — one invoice in each of the five states
- `tests/fixtures/response-times-before-the-move.json` — the four screens and a PDF, timed
- five real PDFs, kept for the side-by-side comparison

Plus three real password hashes and their plain passwords, into
`tests/db/auth.test.ts`, so it can be proved that existing people sign in on the
first try rather than hoped.

## Where the assumptions live

These tests were written before the server half existed, from the agreed design.
`tests/helpers/contract.ts` is the single place they name the server's internals — if
the build chose different export names, rename them there and every test follows.

Two assumptions worth checking early:

- **Invoice number padding.** `tests/unit/numbering.test.ts` assumes four digits
  (`INV-0001`). Confirm against real invoice numbers in the live database, not
  against preference — an existing account's sequence has to carry on looking the way
  it already looks.
- **The shape of `runMigration`.** `tests/migration/migrate.test.ts` assumes
  `scripts/migrate` exports it and that its report carries per-account counts. That
  report is what proves the counts match account by account, so it is worth having.

## The manual checklist

`tests/manual/changeover-checklist.md` is read by the release gate. Do not tick
anything you have not actually done: a ticked box with no evidence is worse than an
unticked one, because it stops anybody looking.
