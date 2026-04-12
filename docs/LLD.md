# Billon Web — Low-Level Design (LLD)

**Version:** 1.0
**Date:** 2026-04-09

---

## 1. `src/lib/api.ts` — Axios Instance

```
Axios instance
  baseURL = NEXT_PUBLIC_API_URL
  Content-Type: application/json

Request interceptor:
  → reads Cookies.get('billon_token')
  → sets Authorization: Bearer <token>
  Note: reads cookie directly (not from Zustand store) to avoid SSR hydration issues

Response interceptor:
  success (2xx) → pass through
  error 401     → Cookies.remove('billon_token')
                → useAuthStore.getState().logout()
                → window.location.replace('/login')
  other errors  → Promise.reject(error) — caller handles
```

---

## 2. `src/lib/auth.ts` — Zustand Auth Store

```
State shape:
  token: string | null     ← initialised from Cookies.get('billon_token') on mount (browser only)

Actions:
  setToken(token)          → Cookies.set('billon_token', token, { expires: 7, sameSite: 'lax' })
                           → set({ token })
  logout()                 → Cookies.remove('billon_token')
                           → set({ token: null })
```

---

## 3. `src/lib/types.ts` — Type Catalogue

### API envelope
```ts
ApiResponse<T>    { status, message, data: T | null }
PageResponse<T>   { content: T[], page, size, totalElements, totalPages, first, last }
```

### Auth
```ts
AuthResponse      { token, user: UserProfile }
UserProfile       { id, email, firstName, lastName, defaultCurrency, invoicePrefix, taxLabel, logoUrl }
```

### Clients
```ts
ClientSummary     { id, name, email, companyName, invoiceCount, createdAt }
ClientDetail      extends ClientSummary + { addressLine1-2, city, postcode, country, updatedAt }
```

### Invoices
```ts
InvoiceStatus     = 'DRAFT' | 'SENT' | 'OVERDUE' | 'PAID' | 'VOID'
InvoiceSummary    { id, invoiceNumber, clientName, status, issueDate, dueDate, currency, total, createdAt }
InvoiceLineItemResponse  { id, description, quantity, unitRate, taxRate, lineTotal, taxAmount, position }
InvoiceDetail     { id, invoiceNumber, client: ClientDetail, status, issueDate, dueDate, currency, taxLabel,
                    note, lineItems, subtotal, taxTotal, total, sentAt, paidAt, voidedAt, createdAt, updatedAt }
```

### Dashboard
```ts
CurrencyTotal     { currency, amount }
DashboardSummary  {
  draft:          { count }
  outstanding:    { count, totals: CurrencyTotal[] }
  overdue:        { count, totals: CurrencyTotal[] }
  paidThisMonth:  { count, totals: CurrencyTotal[] }
}
```

### Form request types
```ts
CreateClientRequest    { name*, email*, companyName?, addressLine1?, addressLine2?, city?, postcode?, country? }
UpdateClientRequest    same as CreateClientRequest
CreateInvoiceRequest   { clientId, currency, issueDate, dueDate, taxLabel?, note?, lineItems: AddLineItemRequest[] }
AddLineItemRequest     { description, quantity, unitRate, taxRate? }
UpdateInvoiceRequest   { issueDate?, dueDate?, taxLabel?, note? }
UpdateProfileRequest   { firstName, lastName, invoicePrefix, taxLabel, defaultCurrency }
LineItemDraft          { localId, description, quantity, unitRate, taxRate }   ← all strings for input binding
```

---

## 4. `src/lib/utils.ts`

```ts
formatMoney(amount, currency)   → `${currency} ${amount.toFixed(2)}`
formatDate(isoDate)             → "31 Mar 2026"   (en-GB, 2-digit day, short month, year)
formatDateShort(isoDate)        → "31 Mar"         (en-GB, 2-digit day, short month)
```

---

## 5. Layout Components

### `AppShell`

```
Props: { children: ReactNode }

Internal state: mobileOpen (boolean)

Mount effect:
  reads token from useAuthStore
  if null → router.replace('/login') + return null

Render:
  <div flex h-screen overflow-hidden>
    <Sidebar mobileOpen={mobileOpen} />
    <div flex-col flex-1>
      <Topbar onMenuClick={() => toggle mobileOpen} />
      <main overflow-y-auto p-6>
        {children}
      </main>
    </div>
  </div>
```

### `Sidebar`

```
Props: { mobileOpen: boolean }

Nav items:
  Dashboard  /           HomeIcon
  Clients    /clients    UserGroupIcon
  Invoices   /invoices   DocumentTextIcon

Bottom items:
  Settings   /settings   Cog6ToothIcon

Active detection:
  href === '/'  → exact match on router.pathname
  else          → router.pathname.startsWith(href)

Active styles:   bg-indigo-50 text-indigo-700 font-medium
Inactive styles: text-slate-600 hover:bg-slate-100

Desktop: w-[180px] sticky sidebar, always visible (lg+)
Mobile:  hidden by default, fixed overlay when mobileOpen=true
```

### `Topbar`

```
Props: { onMenuClick: () => void }

Queries: ['me'] → GET /users/me  (for display name)

Left: hamburger (mobile) + "Billon" wordmark (mobile only)
Right: user full name + ChevronDown → dropdown:
  Profile → /settings
  Sign out → logout() + router.replace('/login')
```

---

## 6. UI Primitives

### `StatusBadge`
```ts
Props: { status: InvoiceStatus }
Styles:
  DRAFT   → bg-slate-100 text-slate-600
  SENT    → bg-blue-100 text-blue-700
  OVERDUE → bg-red-100 text-red-700
  PAID    → bg-green-100 text-green-700
  VOID    → bg-slate-100 text-slate-400
```

### `Pagination`
```ts
Props: { page: number, totalPages: number, onPageChange: (page: number) => void }
Renders nothing if totalPages <= 1
Shows: ← Previous | Page N of M | Next →
Disables buttons at boundaries (page === 0, page >= totalPages - 1)
```

### `PageHeader`
```ts
Props: { title, backHref?, backLabel?, action?: ReactNode }
Layout: back link (optional) above h1 | CTA slot (right, optional)
```

### `ConfirmDialog`
```ts
Props: { open, title, message, confirmLabel, onConfirm, onCancel, danger? }
When open=false: renders null
Modal overlay: fixed inset-0, semi-transparent backdrop
Buttons: Cancel (slate) | Confirm (indigo or red if danger=true)
Backdrop click → onCancel
```

### `EmptyState`
```ts
Props: { message, action?: { label, href } }
Centered icon + message + optional Link
```

### `LoadingSkeleton`
```ts
Props: { rows?: number = 3 }
N animated gray bars (animate-pulse h-10 bg-slate-100 rounded)
```

---

## 7. Feature Components

### `StatCard`
```ts
Props: { title, count, totals?: CurrencyTotal[], colorClass? }
count rendered in large font (colorClass controls colour)
totals: each CurrencyTotal on its own line via formatMoney
zero totals: shows "—"
```

### `RecentInvoicesTable`
```ts
Props: { invoices: InvoiceSummary[] | undefined, isLoading: boolean }
isLoading=true  → LoadingSkeleton rows={5}
empty           → EmptyState + link to /invoices/new
Columns: Number | Client | Status (StatusBadge) | Due | Total
Row click → router.push(/invoices/[id])
Footer: "View all →" link to /invoices
```

### `ClientTable`
```ts
Props: { clients: ClientSummary[] | undefined, isLoading: boolean }
Columns: Name | Email | Invoices | Added (formatDate)
Row click → router.push(/clients/[id])
```

### `ClientInfoCard`
```ts
Props: { client, editing, onEdit, onSave, onCancel, saving? }
View mode: <dl> grid showing all fields, [Edit] button
Edit mode: grid of inputs, [Save changes] + [Cancel]
Form state is local (initialised from client prop)
```

### `InvoiceTable`
```ts
Props: { invoices: InvoiceSummary[] | undefined, isLoading: boolean }
Columns: Number | Client | Status (StatusBadge) | Due | Total
Row click → router.push(/invoices/[id])
```

### `LineItemsEditor`

Two modes controlled by `mode` prop:

**Create mode:**
```ts
Props: { mode: 'create', items: LineItemDraft[], onChange, currency }
Renders: grid of input rows
  - description (col-span-5)
  - quantity (col-span-2)
  - unitRate (col-span-2)
  - taxRate (col-span-2)
  - delete button (col-span-1)
Live totals: subtotal / tax / total computed from draft state
[Add line item] button appends newDraft() to array
```

**Edit mode:**
```ts
Props: { mode: 'edit', items: InvoiceLineItemResponse[], invoiceId, currency }
Renders: read-only rows + delete button per row
Mutations:
  deleteLineItemMutation → DELETE /invoices/:id/line-items/:itemId
  addLineItemMutation    → POST /invoices/:id/line-items
Both invalidate ['invoices', invoiceId] on success
AddLineItemForm: local state form at bottom, clears on successful add
```

---

## 8. Page Specifications

### `/ (Dashboard)`

Queries:
```
['dashboard']                        → GET /dashboard/summary           → DashboardSummary
['invoices', { page:0, size:5, sort:'createdAt,desc' }]  → GET /invoices  → PageResponse<InvoiceSummary>
```

Layout: h1 + 2×2 StatCard grid + RecentInvoicesTable card

---

### `/clients`

State: `page=0`, `search=''`, `debouncedSearch=''`
Debounce: 300ms timeout on search input (resets page to 0)

Query:
```
['clients', { page, size:20, search }]  → GET /clients?page&size=20&search&sort=name,asc
```
`placeholderData: (prev) => prev` — keeps previous data during filter changes

---

### `/clients/new`

Mutation: `POST /clients` → on success: invalidate `['clients']` + router.push(`/clients/${id}`)
Error handling: 400 → field-level errors from `data.errors`; other → banner

---

### `/clients/[id]`

Queries:
```
['clients', id]                    → GET /clients/:id    → ClientDetail
['invoices', { clientId: id }]     → GET /invoices?clientId&size=20&sort=createdAt,desc
```

Modes: view (ClientInfoCard read) / edit (ClientInfoCard edit form, inline toggle)

Mutations:
```
updateMutation  → PUT /clients/:id  → invalidate ['clients', id] + ['clients'] → setEditing(false)
deleteMutation  → DELETE /clients/:id
  409 → "This client has existing invoices and cannot be deleted."
  success → invalidate ['clients'] + router.push('/clients')
```

Invoice mini-table: Number | Status | Due | Total, with "+ New Invoice" link to `/invoices/new?clientId=id`

---

### `/invoices`

Filters state: `status=''`, `clientId=''`, `sort='createdAt,desc'`, `page=0`

Queries:
```
['invoices', { page, status, clientId, sort }]     → GET /invoices
['clients', { size: 100 }]                          → GET /clients (populates client select)
```
`placeholderData: (prev) => prev`

---

### `/invoices/new`

Queries:
```
['clients', { size: 100 }]   → client select
['me']                        → default currency, staleTime: Infinity
```

Local state: `lineItems: LineItemDraft[]`
Currency: `form.currency || profile.defaultCurrency || 'GBP'`
Pre-select client: reads `router.query.clientId`

Submit: parse all drafts → `POST /invoices` with full lineItems array → invalidate `['invoices']` + `['dashboard']`

---

### `/invoices/[id]`

Query: `['invoices', id]` → `GET /invoices/:id`

Action matrix:
```
DRAFT:        Edit (link) | Send (confirm) | Void (confirm) | Delete (confirm+danger)
SENT/OVERDUE: Download PDF | Mark as Paid (confirm) | Void (confirm)
PAID/VOID:    Download PDF
```

Mutations:
```
send       → POST /invoices/:id/send
paidMutation → POST /invoices/:id/mark-paid
void       → POST /invoices/:id/void
delete     → DELETE /invoices/:id → router.push('/invoices')
```
All invalidate `['invoices', id]` and `['dashboard']`.
422 errors → `bannerError = response.data.message`

PDF download:
```
GET /invoices/:id/pdf  responseType: 'blob'
→ createObjectURL → <a download> → click → cleanup
```

---

### `/invoices/[id]/edit`

Guard: if `invoice.status !== 'DRAFT'` → router.replace(`/invoices/${id}`)

Form fields: issueDate, dueDate, taxLabel, note (pre-populated from invoice)
LineItemsEditor in edit mode — mutations fire immediately on each change

Save: `PUT /invoices/:id` → invalidate `['invoices', id]` → router.push(`/invoices/${id}`)

---

### `/settings`

Query: `['me']` → `GET /users/me`
Form fields: firstName, lastName (editable) | email (read-only) | invoicePrefix | taxLabel | defaultCurrency (select)
Mutation: `PUT /users/me` → invalidate `['me']` → show 3s success banner

---

## 9. React Query Key Registry

| Key | API Call | Invalidated by |
|---|---|---|
| `['dashboard']` | GET /dashboard/summary | Create/send/pay/void invoice |
| `['clients', { page, size, search }]` | GET /clients | Create, update, delete client |
| `['clients', id]` | GET /clients/:id | Update client |
| `['clients', { size: 100 }]` | GET /clients?size=100 | Create client |
| `['invoices', { page, status, clientId, sort }]` | GET /invoices | Create, delete invoice |
| `['invoices', id]` | GET /invoices/:id | Send, pay, void, edit, line item mutations |
| `['invoices', { clientId }]` | GET /invoices?clientId | (not explicitly invalidated — stale-while-revalidate) |
| `['me']` | GET /users/me | PUT /users/me |

---

## 10. Error Handling Summary

| HTTP Status | Handler |
|---|---|
| 400 | Field-level errors from `data.data.errors`; fallback to `data.message` banner |
| 401 | Axios interceptor: clear cookie + logout + hard redirect `/login` |
| 404 | Show "not found" message in place; no redirect |
| 409 | Inline error: "This client has existing invoices and cannot be deleted." |
| 422 | Banner: display `data.message` directly |
| 5xx | Banner: `data.message ?? 'Something went wrong'` |

---

## 11. CSS Design Tokens (`globals.css` `@theme {}`)

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#4f46e5` | Buttons, links, active nav |
| `--color-primary-hover` | `#4338ca` | Button hover state |
| `--color-surface` | `#ffffff` | Cards, modals |
| `--color-surface-alt` | `#f8fafc` | Sidebar bg, page bg |
| `--color-border` | `#e2e8f0` | Dividers, input borders, card borders |
| `--color-text` | `#0f172a` | Body text |
| `--color-muted` | `#64748b` | Secondary text, labels |
| `--radius-card` | `8px` | Card border radius |
| `--shadow-card` | `0 1px 3px 0 rgb(0 0 0 / 0.08)` | Card shadow |
