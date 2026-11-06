# Billon — High Level Design

## What Billon is

A focused invoice management app for freelancers: keep a list of clients, raise an
invoice against one, send it, chase it, mark it paid, and hand the client a PDF.

## The shape of it

One web app talking to one database. The screens and the server live in the same
project and deploy together.

```
  Browser
     │
     ▼
  Next.js app  ──────────────────────────────┐
     ├─ screens          src/pages/**        │  one deployment
     ├─ request handlers src/pages/api/v1/** │  one hosting bill
     └─ the parts below  src/server/**       │
     │                                        ┘
     ▼
  PostgreSQL   prisma/schema.prisma
```

Why one thing rather than two: Billon is a single-team, low-traffic app, and almost
every piece of work — currency, tax entries, PDFs, invoice numbering — touches both
halves. When those halves were separate codebases, each of those was two edits, two
deployments and a chance for the two to disagree about a shape. In one project it is
one edit, one deployment, and a shape that cannot disagree with itself because there
is one description of it, in `src/lib/types.ts`, used by both sides.

Nothing in the requirements asks for one half to scale independently of the other, so
there is no reason to pay for the seam.

## The parts

| Part | Where | What it does |
|---|---|---|
| Screens | `src/pages`, `src/components` | Draws every page and holds the cached copies of what the server said |
| Browser API client | `src/lib/api.ts` | The one place the browser makes requests; attaches the token, signs out on a refusal |
| Request handlers | `src/pages/api/v1/**` | One small file per address; reads, checks, asks, answers. No rules of its own |
| Reply envelope | `src/server/http/envelope.ts`, `page.ts` | Puts every answer in the shape the screens read |
| Input checker | `src/server/validation/**` | Refuses bad input in words a person can be shown |
| Sign-in tokens | `src/server/auth/token.ts` | Makes and checks the signed token that says who is asking |
| Password verifier | `src/server/auth/password.ts` | Scrambles and checks passwords, including inherited ones |
| Client store | `src/server/clients/**` | Reads and writes one account's clients |
| Invoice store | `src/server/invoices/**` | Reads and writes invoices, their lines and their tax entries |
| Money calculator | `src/server/invoices/money.ts` | Works out every figure on an invoice, exactly |
| Invoice numbering | `src/server/invoices/numbering.ts` | Hands out the next number for an account |
| Invoice lifecycle | `src/server/invoices/lifecycle.ts` | Knows what an invoice may become next |
| Dashboard figures | `src/server/dashboard/summary.ts` | The nine figures on the front page |
| Profile store | `src/server/profile/store.ts` | The signed-in person's own details |
| Logo store | `src/server/profile/logo.ts` | Keeps and serves the account's logo |
| PDF maker | `src/server/pdf/**` | Turns one invoice into a document |
| Invoice sender | `src/server/invoices/sender.ts` | Carries out the send action |
| Email sender | `src/server/email/sender.ts` | Puts one email with an attachment on its way |
| Overdue sweeper | `src/server/jobs/markOverdue.ts` | Marks unpaid invoices overdue each night |
| Activity log | `src/server/activity/log.ts` | Writes down every change that matters |
| Database access | `src/server/db/client.ts`, `prisma/**` | The single door to the database |
| Data mover | `scripts/migrate/**` | Carries the old data across, repeatably |

## The decisions worth knowing

**The addresses did not change.** Every screen already called `/api/v1/...` and read
`{ status, message, data }` back. Those addresses are now answered by this app, and
the reply shape is built in one shared place so no handler can quietly get it wrong.
The only edit on the browser side was the base address in `src/lib/api.ts`.

**Money is exact from end to end.** Amounts are held as exact decimals in the
database, worked out as exact decimals, and turned into ordinary numbers only when the
reply is written. Ordinary computer numbers cannot represent 0.10, and adding a few
hundred of them drifts by pennies.

**Invoice numbers come from a counter that moves in one step.** Each account has a
prefix and a next number. Raising an invoice moves that counter on and reads it back
in a single statement inside the transaction that saves the invoice, so two invoices
raised at the same instant cannot be given the same number. The database also refuses
two invoices in one account sharing a number, so a future bug fails honestly.

**The account always comes from the token.** Every store is given the account id read
out of the sign-in token, never one from the request, and every read and write is
filtered by it. A forgotten check finds nothing rather than showing somebody else's
records.

**Logos live in the database.** The web server's own disk is emptied on every
deployment, so anything kept there disappears with it. Logos are small and there is at
most one per account, so the database meets the promise without a second paid service.

**Overdue is a nightly job, not a guess at read time.** A web app hosted this way is
not always running and has no timer of its own, so the hosting platform calls a
protected address once a night. Every run is written down — a sweep that quietly
stopped running is worse than one that visibly failed.

**Nothing else runs.** No queue, no worker, no cache, no second service. Nothing in
the requirements asks for work to happen out of band except the nightly sweep, and
every extra part is one more thing to build, test, run and pay for.

## What is written down elsewhere

- `docs/LLD.md` — each address and each part, in detail
- `docs/MIGRATION.md` — the switchover runbook and the way back
- `docs/JAVA-SERVICE-FINDINGS.md` — the four things only the old project could answer
- `tests/manual/changeover-checklist.md` — what a person has to do and sign off
