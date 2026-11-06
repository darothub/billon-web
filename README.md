# Billon

Invoice management for freelancers. One Next.js app: it draws the screens **and**
answers its own requests, backed by one PostgreSQL database. There is nothing else to
run and nothing else to deploy.

- Screens: `src/pages/**` (Pages Router), `src/components/**`
- Server: `src/pages/api/v1/**` (one small file per address) and `src/server/**`
- Database: `prisma/schema.prisma` and `prisma/migrations/**`

## Getting a working sign-in page

You need Node 20+ and Docker. From a clean checkout:

```bash
npm install                       # also generates the database client
cp .env.example .env              # then open .env; the defaults work locally
docker compose up -d              # starts PostgreSQL on localhost:5432
npx prisma migrate deploy         # builds the database structure from prisma/migrations
npm run dev
```

Open <http://localhost:3000>. You will land on the sign-in page; use **Create an
account** to make one, and you are in with an empty Billon.

The one value in `.env` worth changing straight away is `JWT_SECRET` — any long random
string (`openssl rand -base64 48`). Use a different one from the live app's, so a
token made on your laptop is refused in production.

## The checks

```bash
npm run type-check    # tsc --noEmit — must be clean before committing
npm test              # the unit and contract tests; no database needed
```

The database-backed tests drive the real request handlers against a real PostgreSQL.
They empty every table, so they take their own database:

```bash
DATABASE_URL=postgresql://billon:billon@localhost:5432/billon_test npx prisma migrate deploy
DATABASE_URL=postgresql://billon:billon@localhost:5432/billon_test npm run test:db
```

`npm run test:release` is the changeover evidence gate. It is expected to fail until a
person has done and signed off each step in `tests/manual/changeover-checklist.md`, so
it is deliberately not part of the per-change build gate.

## Changing the database structure

```bash
npx prisma migrate dev --name what-you-changed
```

That writes a new file under `prisma/migrations/`. Commit it — the structure is built
from those files, never by hand, which is what lets a stranger reach a working sign-in
page from this repository alone.

## The nightly overdue sweep

`POST /api/v1/jobs/mark-overdue` marks sent invoices whose due date has passed. It is
not a person, so it carries `CRON_SECRET` rather than a sign-in token, and the hosting
platform calls it once a night (see `vercel.json`). Every run is written down in the
`JobRun` table with what it changed — a sweep that quietly stopped running is the
failure worth noticing.

To run it by hand:

```bash
curl -X POST localhost:3000/api/v1/jobs/mark-overdue -H "Authorization: Bearer $CRON_SECRET"
```

## Moving the old data across

One-off, and safe to run as many times as you like:

```bash
LEGACY_DATABASE_URL=postgresql://... npm run migrate:legacy
```

The runbook for the switchover, including the way back, is in `docs/MIGRATION.md`.

## Documentation

- `docs/HLD.md` — the shape of the app and why
- `docs/LLD.md` — how each part works, address by address
- `docs/MIGRATION.md` — the switchover runbook and the rollback
- `CLAUDE.md` — conventions to follow when changing this project
