# Billon Web — Agent Operating Manual

## What This Project Is

Billon: a focused invoice management app for freelancers. **One Next.js project that
both draws the screens and answers its own requests**, backed by one PostgreSQL
database. There is no separate backend service any more.

- Screens: `src/pages/**`, `src/components/**`
- Server: `src/pages/api/v1/**` (one file per address) and `src/server/**`
- Database: `prisma/schema.prisma`, `prisma/migrations/**`

---

## Tech Stack

| Tool | Purpose |
|---|---|
| Next.js 16 (Pages Router) | Framework — screens and API routes together |
| TypeScript | Type safety — all shared types in `src/lib/types.ts` |
| Tailwind CSS v4 | Styling — CSS-based `@theme {}` in `globals.css`, **no `tailwind.config.ts`** |
| Zustand | Global auth state |
| TanStack React Query v5 | Server state, caching, loading/error handling |
| React Hook Form + Zod | Forms and validation — Zod also checks every request |
| Axios | HTTP client (`src/lib/api.ts`), pointed at `/api/v1` |
| js-cookie | JWT cookie storage |
| Prisma + PostgreSQL | The database, described by files in the repo |
| jose, bcryptjs | Sign-in tokens and password scrambling |
| @react-pdf/renderer | Invoice PDFs, rendered in Node |
| Vitest | The tests — `npm test`, `npm run test:db` |

---

## Critical Rules — Read Before Every Task

1. **No demo data on authenticated pages.** Use `[]` / `undefined` as defaults, show
   skeletons on load.

2. **Tailwind v4 — no `tailwind.config.ts`.** Tokens live in `src/styles/globals.css`
   under `@theme {}`.

3. **All shared types live in `src/lib/types.ts`.** The server uses the same ones. Do
   not create `src/server/types.ts` — one description, or the two halves drift again.

4. **Auth token is in a cookie, not localStorage.** `api.ts` reads
   `Cookies.get('billon_token')`.

5. **Global 401 interceptor is mandatory in `src/lib/api.ts`.** On any 401: remove the
   cookie → `useAuthStore.getState().logout()` → `window.location.replace('/login')`.
   The sign-in page is `/login`.

6. **The account always comes from the sign-in token**, never from a request body or a
   web address, and every store filters every read and write by it.

7. **Never accept a total from a screen.** Every figure on an invoice is worked out by
   `src/server/invoices/money.ts`, as an exact decimal, and only becomes an ordinary
   number when the reply is written.

8. **Every reply goes through `src/server/http/envelope.ts`**, and every list through
   `buildPage`. The screens read `res.data.data` and the seven page keys by name.

9. **Change the database by writing a migration**, never by hand:
   `npx prisma migrate dev --name what-you-changed`, and commit the file.

10. **Run `npx tsc --noEmit` and `npm test` before committing.** No type errors, no
    failing tests.

---

## Deeper Documentation

- `docs/HLD.md` — the shape of the app and the decisions behind it
- `docs/LLD.md` — every address and every part, in detail
- `docs/MIGRATION.md` — the switchover runbook and the way back
- `README.md` — how to get a working sign-in page from a clean checkout
