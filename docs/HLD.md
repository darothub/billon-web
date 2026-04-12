# Billon Web — High-Level Design (HLD)

**Version:** 1.0
**Date:** 2026-04-09
**Scope:** Frontend web application (`billon-web`)

---

## 1. System Overview

Billon is a focused invoice management SaaS for freelancers. The web frontend is a Next.js single-page application that communicates exclusively with the `billon-api` Spring Boot backend via a JSON REST API.

```
Browser
  └── Next.js 16 (Pages Router)
        ├── TanStack React Query   — server-state cache, loading/error handling
        ├── Zustand                — auth token (in-memory + cookie)
        ├── Axios                  — HTTP client with request/response interceptors
        └── Tailwind CSS v4        — utility-first styles, @theme {} tokens
              ↕  HTTPS REST API
        billon-api  (Fly.io, Spring Boot 4.0 / PostgreSQL)
```

---

## 2. Architectural Principles

| Principle | Decision |
|---|---|
| No server-side rendering of authenticated data | All authenticated pages are purely client-side. AppShell guards every route. |
| No demo/fixture data | Real API or proper empty state — zero tolerance for fixtures in production pages |
| Cookie-based auth | `billon_token` cookie (7-day, `SameSite=Lax`). Axios reads it directly on every request. |
| Single source of truth for types | `src/lib/types.ts` — all interfaces live here |
| Single source of truth for status colours | `StatusBadge` component — never hardcode status colours elsewhere |
| Fail fast | `retry: false` on all React Query calls |
| Monetary formatting | `${currency} ${amount.toFixed(2)}` — never `Intl.NumberFormat` |

---

## 3. Application Layers

```
┌─────────────────────────────────────────────────────────┐
│  Pages  (src/pages/)                                    │
│  Route entry points — orchestrate queries + mutations   │
├─────────────────────────────────────────────────────────┤
│  Layout  (src/components/layout/)                       │
│  AppShell — auth guard + sidebar + topbar               │
├─────────────────────────────────────────────────────────┤
│  Feature Components  (src/components/{domain}/)         │
│  Tables, cards, editors — render only, no API calls     │
├─────────────────────────────────────────────────────────┤
│  UI Primitives  (src/components/ui/)                    │
│  StatusBadge, Pagination, ConfirmDialog, EmptyState...  │
├─────────────────────────────────────────────────────────┤
│  Data Layer  (src/lib/)                                 │
│  api.ts · auth.ts · types.ts · utils.ts                │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Route Map

| URL | Page | Auth |
|---|---|---|
| `/login` | Login form | Public (redirect to `/` if logged in) |
| `/register` | Register form | Public (redirect to `/` if logged in) |
| `/` | Dashboard — stat cards + recent invoices | Protected |
| `/clients` | Client list with search + pagination | Protected |
| `/clients/new` | Create client form | Protected |
| `/clients/[id]` | Client detail + inline edit + invoice mini-table | Protected |
| `/invoices` | Invoice list with filters | Protected |
| `/invoices/new` | Create invoice with line items | Protected |
| `/invoices/[id]` | Invoice detail + status actions | Protected |
| `/invoices/[id]/edit` | Edit DRAFT invoice | Protected |
| `/settings` | User profile settings | Protected |

---

## 5. Auth Flow

```
User visits protected page
      │
      ▼
AppShell reads token from useAuthStore
      │
  token null? ──yes──► router.replace('/login') → return null
      │
      no
      │
      ▼
Render page normally

On any API call → 401 response:
  Cookies.remove('billon_token')
  useAuthStore.getState().logout()
  window.location.replace('/login')    ← hard redirect, clears React state
```

---

## 6. Data Flow (React Query)

```
Page mounts
  └── useQuery({ queryKey, queryFn, retry: false })
        ├── Cache HIT  → return cached data immediately
        └── Cache MISS → call API → store in cache → render

User action (create/update/delete)
  └── useMutation({ mutationFn, onSuccess, onError })
        └── onSuccess: invalidateQueries([affected keys])
                          └── React Query refetches stale queries
```

---

## 7. Invoice Status State Machine

```
DRAFT ──[Send]──► SENT ──[Mark Paid]──► PAID
  │                  │
  │             [Void]──► VOID
  │
[Void]──► VOID
  │
[Delete] ──► (deleted)    ← DRAFT only

OVERDUE is set by the backend scheduler (not a client action)
```

---

## 8. Line Item Strategy

| Page | Strategy |
|---|---|
| `/invoices/new` | Local state (`LineItemDraft[]`). All line items sent in one `POST /invoices` body. |
| `/invoices/[id]/edit` | Each add/delete fires its own API call immediately. QueryClient invalidated after each. |

---

## 9. Deployment Target

- **Host:** Vercel (or Railway)
- **Env var:** `NEXT_PUBLIC_API_URL=https://billon-api.fly.dev/api/v1`
- **Build:** `next build` (static output + SSR shell pages)
- **Backend:** `billon-api` on Fly.io (`shared-cpu-1x`, 1 GB RAM)

---

## 10. File Count Summary

| Category | Files |
|---|---|
| Pages | 10 |
| Layout components | 3 |
| Feature components | 6 |
| UI primitives | 6 |
| Lib (api, auth, types, utils) | 4 |
| Styles | 1 |
| **Total** | **30** |
