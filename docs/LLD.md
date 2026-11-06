# Billon — Low Level Design

How each part actually works. The shape of the whole thing is in `docs/HLD.md`.

## Every address

All under `/api/v1`, all answered by a file under `src/pages/api/v1/`.

| Method | Address | Handler |
|---|---|---|
| POST | `/auth/register` | `auth/register.ts` |
| POST | `/auth/login` | `auth/login.ts` |
| GET, PUT | `/users/me` | `users/me/index.ts` |
| POST | `/users/me/logo` | `users/me/logo.ts` |
| GET | `/users/{id}/logo` | `users/[id]/logo.ts` |
| GET | `/dashboard/summary` | `dashboard/summary.ts` |
| GET, POST | `/clients` | `clients/index.ts` |
| GET, PUT, DELETE | `/clients/{id}` | `clients/[id].ts` |
| GET, POST | `/invoices` | `invoices/index.ts` |
| GET, PUT, DELETE | `/invoices/{id}` | `invoices/[id]/index.ts` |
| POST | `/invoices/{id}/send` | `invoices/[id]/send.ts` |
| POST | `/invoices/{id}/mark-paid` | `invoices/[id]/mark-paid.ts` |
| POST | `/invoices/{id}/void` | `invoices/[id]/void.ts` |
| POST | `/invoices/{id}/line-items` | `invoices/[id]/line-items/index.ts` |
| DELETE | `/invoices/{id}/line-items/{itemId}` | `invoices/[id]/line-items/[itemId].ts` |
| GET | `/invoices/{id}/pdf` | `invoices/[id]/pdf.ts` |
| GET, POST | `/jobs/mark-overdue` | `jobs/mark-overdue.ts` |

## The reply shape

Every JSON answer:

```json
{ "status": "success" | "error", "message": "…", "data": … }
```

`data` is present and `null` on a refusal, never left out — a missing key reads as
`undefined` in the browser and renders a blank page instead of an error.

Every list answer additionally:

```json
{ "content": [], "page": 0, "size": 20, "totalElements": 0,
  "totalPages": 0, "first": true, "last": true }
```

Built by `src/server/http/envelope.ts` and `page.ts`. A sort field is checked against
a known list before it goes anywhere near a query; a page size is capped at 200.

## How a handler is put together

```ts
export default apiRoute({
  GET: async (req, res) => {
    const accountId = await requireAccountId(req)   // who is asking
    const input = someSchema.parse(readBody(req))   // is this acceptable
    sendOk(res, await someStore(accountId, input))  // ask, and answer
  },
})
```

`apiRoute` catches whatever is thrown underneath: an `ApiError` becomes its own code
and message, a checker's complaint becomes a 400 with the words it produced, and
anything else becomes a 500 with an apology — never its own words, because its own
words are a stack trace.

## Working out the money

`src/server/invoices/money.ts`. Given a currency, some lines and any named tax
entries:

- each line total is quantity × rate, rounded to the currency's smallest unit
- each line's tax is its line total × its rate, rounded the same way
- the subtotal is the sum of the line totals
- each named tax entry's amount is the subtotal × its rate
- the tax total is the sum of the named entries if there are any; otherwise the sum of
  the per-line tax. Named entries describe the whole invoice, so counting both would
  charge the same tax twice
- the total is the subtotal plus the tax total

Ties round away from zero: 0.125 is 13p, not 12p. The rounding follows the invoice's
own currency, not the account's default — an invoice in yen has no fractional part.

Totals arriving in a request are ignored. Only what is worked out here is saved.

## Invoice numbers

An account has an `invoicePrefix` and an `invoiceNextNumber`. The number shown is the
prefix followed by the counter padded to four digits: `INV-0048`. A counter past four
digits is not truncated: `INV-12345`.

Raising an invoice runs, inside the same transaction that writes it:

```sql
UPDATE "Account" SET "invoiceNextNumber" = "invoiceNextNumber" + 1
 WHERE "id" = $1 RETURNING "invoicePrefix", "invoiceNextNumber" - 1
```

Reading the counter and writing it back as two steps is what lets two invoices raised
at the same instant get the same number; one returning update makes that impossible.
A unique rule on `(accountId, invoiceNumber)` in the database is the second line of
defence. Everything that can be refused is checked before the transaction opens, so a
refused invoice never burns a number.

Saving the settings page never touches the counter — `updateProfileSchema` does not
have a field for it, so a request that tries is simply dropped.

## What an invoice may become next

`src/server/invoices/lifecycle.ts`.

```
DRAFT ──▶ SENT ──▶ PAID
  │        │  ╲
  │        │   ╲──▶ OVERDUE ──▶ PAID
  ▼        ▼            │
 VOID     VOID ◀────────┘
```

- a draft may be sent or voided, and only a draft may be deleted
- a sent invoice may be marked paid, voided, or turned overdue by the nightly sweep
- an overdue invoice may still be paid or voided
- a paid or voided invoice never moves again

Each move stamps its own moment: `sentAt`, `paidAt`, `voidedAt`. Going overdue stamps
nothing — the due date already says when. A refused move changes nothing and is not
written down as having happened.

## Who is asking

`requireAccountId` reads the `Authorization: Bearer …` header, checks the signature
and hands back the account id. Every store takes that id and filters by it. Nothing
ever reads an account id out of a request body or a web address.

An account belonging to somebody else is refused as **not found**, which both refuses
and declines to confirm the record exists.

## Passwords

Scrambled with bcrypt. Which method scrambled a password is recorded per account,
because accounts carried over from before were scrambled by something this project
could not read. Checking is driven by what the stored value looks like, and a password
that checks out under an older method is quietly re-scrambled to the current one on
the way past — so people sign in with the password they already use and drift onto the
modern method by themselves.

## The nightly sweep

`GET` or `POST /api/v1/jobs/mark-overdue`, carrying `CRON_SECRET` as a bearer token.
Both methods answer, because the schedule may send either and a job that answers only
`POST` silently never runs.

One `UPDATE` marks every sent invoice whose due date has passed. An invoice due today
is not yet overdue. Every run writes a `JobRun` row — when it started, when it
finished, how many invoices it changed, and why if it failed.

## The database

`prisma/schema.prisma`, built by the files in `prisma/migrations/`. Money is
`Decimal`, never a floating point number. Calendar days (`issueDate`, `dueDate`) are
`DATE` with no time of day; moments keep their time.

Every moved record carries the id it had in the old database as `legacyId`, which is
what lets the data mover be run twice without duplicating anything.
