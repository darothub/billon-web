# Billon Web — Agent Operating Manual

## What This Project Is

The Next.js frontend for Billon — a focused invoice management app for freelancers. Consumes the Spring Boot backend API (`billon` repo).

---

## Tech Stack

| Tool | Purpose |
|---|---|
| Next.js 16 (Pages Router) | Framework |
| TypeScript | Type safety — all types in `src/lib/types.ts` |
| Tailwind CSS v4 | Styling — CSS-based `@theme {}` in `globals.css`, **no `tailwind.config.ts`** |
| Zustand | Global auth state |
| TanStack React Query v5 | Server state, caching, loading/error handling |
| React Hook Form + Zod | Forms and validation |
| Axios | HTTP client (`src/lib/api.ts`) |
| js-cookie | JWT cookie storage |

---

## Critical Rules — Read Before Every Task

1. **No demo data on authenticated pages.** Use `[]` / `undefined` as defaults, show skeletons on load. Demo-first pattern is for public pages only (and this app has none).

2. **Tailwind v4 — no `tailwind.config.ts`.** Tokens defined in `src/styles/globals.css` with `@theme {}`.

3. **All types live in `src/lib/types.ts`.** Never define local types that duplicate shared types.

4. **Auth token is in a cookie, not localStorage.** `api.ts` reads `Cookies.get('billon_token')`.

5. **Global 401 interceptor is mandatory in `src/lib/api.ts`.** On any 401: remove cookie → call `useAuthStore.getState().logout()` → `window.location.replace('/auth/login')`.

6. **Run `npx tsc --noEmit` before committing.** No type errors allowed.

---

## Deeper Documentation

See `.workflow/agent/frontend.md` (in the `billon` backend repo) for page structure, component conventions, and React Query patterns.