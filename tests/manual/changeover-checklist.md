# Changeover checklist

Some of what this move promised cannot be proved by a program: that a stranger could
follow the README, that five PDFs look right to the person whose name is on them,
that a backup really restored, that the old Fly.io service is gone. Those are done by
a person and recorded here.

`tests/release/evidence.test.ts` reads this file. It fails while anything below is
still unticked, which is the point — it is the release gate for the switchover, not
part of the per-change build. Run it with:

    npx vitest run --project release

**Do not tick anything you have not actually done.** A ticked box with no evidence is
worse than an unticked one, because it stops anybody looking.

## Format

Every item has exactly these four lines. Fill in all of them.

    - [x] Done
    - Date: 2026-09-14
    - Signed off by: <a person's name>
    - Evidence: <where to find the proof — a file, a link, a screenshot, a paste>

---

## soak-with-java-off — A full working day with the Java service switched off

Switch the Fly.io service off (or block it) for a full working day. Over that day,
sign in, look at the dashboard, list and open clients, raise an invoice, send it, mark
it paid and download its PDF. None of those steps may show an error.

- [ ] Done
- Date:
- Signed off by:
- Evidence:

## stranger-setup — Somebody new reached a sign-in page on a clean machine

Hand the README to somebody who has never seen the project, on a machine with nothing
set up. They check it out, follow the instructions, run the setup and reach a working
sign-in page — with nothing else running anywhere else. Record every question they had
to ask that the instructions did not answer; if there were any, fix the README and
have somebody else try again.

- [ ] Done
- Date:
- Signed off by:
- Evidence:
- Questions they had to ask:

## password-scrambling-confirmed — How the Java service scrambled passwords

Someone opened the Java project and established how stored passwords were scrambled.
Written into docs/JAVA-SERVICE-FINDINGS.md with the file it was found in. The three
real hashes are in tests/db/auth.test.ts and that test passes.

- [ ] Done
- Date:
- Signed off by:
- Evidence:

## password-reset-fallback — If the old scrambling cannot be reproduced

Only applicable if `password-scrambling-confirmed` came back as 'cannot be reproduced'.
The decision to make everyone reset their password once is written down, and announced
to users **before** the switch. Users finding out by being locked out fails this.

- [ ] Not applicable — the old scrambling was reproduced
- [ ] Done
- Date:
- Signed off by:
- Evidence (where the decision is written, and the announcement that went out):

## send-behaviour-confirmed — What the send button actually does

Established by reading the Java project, and written into
docs/JAVA-SERVICE-FINDINGS.md as exactly one of: it emails the invoice to the client,
or it only changes the status to sent. If it emails, a test invoice sent after the
move arrived in a real inbox with the PDF attached — record which inbox.

- [ ] Done
- Date:
- Signed off by:
- Which of the two it is:
- Evidence:

## pdf-side-by-side — Five real invoices, before and after

Five real invoices produced by the Java service, and the same five produced after the
move, placed side by side and signed off by the owner as ones a client would not
notice a difference between: same layout, same logo, same figures, same payment
details. Byte-for-byte sameness is not required.

- [ ] Done
- Date:
- Signed off by:
- Evidence (where the ten PDFs are kept):

## logos-carried-over — Every existing logo still shows

Every account that had uploaded a logo before the move still shows it afterwards.
Checked account by account, not sampled.

- [ ] Done
- Date:
- Signed off by:
- Evidence (how many accounts had a logo, and how many still do):

## logo-survives-deploy — A logo uploaded before a deployment still displays after it

Upload a logo, deploy, then reload the settings page and produce a PDF.

- [ ] Done
- Date:
- Signed off by:
- Evidence:

## mutation-check-demonstrated — Breaking the arithmetic breaks the tests

Deliberately change the money arithmetic — swap a rounding rule, drop a tax entry from
the total — run `npx vitest run --project unit`, and confirm the multi-rate, rounding
and non-default-currency tests fail. Then put it back. Record what you changed and
which tests went red.

- [ ] Done
- Date:
- Signed off by:
- What you changed, and which tests failed:

## backup-taken-and-restored — A dated full copy of the old database, restored once

A full copy of the old database taken and dated, and restored successfully into a
scratch database at least once — all **before** anything is switched over. A backup
nobody has restored is not yet a backup.

- [ ] Done
- Date the copy was taken:
- Date it was restored:
- Signed off by:
- Evidence (where the copy is, and the scratch database it went into):

## move-rehearsed — The data move rehearsed against a copy of the live data

`npx vitest run --project db tests/migration` run against the restored copy, and
passing, before the real run.

- [ ] Done
- Date:
- Signed off by:
- Evidence (the run output):

## rollback-walked-through — Going back has been tried, not just written down

The steps to return to the Java service are written down in docs/MIGRATION.md and have
been walked through at least once on a test setup. A rollback plan that has never been
tried is a guess.

- [ ] Done
- Date:
- Signed off by:
- Evidence:

## changeover-approach-agreed — Which approach, decided before the day

Written down before the switchover: a short announced pause when nobody is raising
invoices, or switching while the app is live. The design proposes the announced pause.

- [ ] Done
- Date:
- Signed off by:
- Which approach:
- Evidence (where it is written down):

## changeover-window-reconciled — Nothing created during the changeover went missing

After the switch, a comparison showing that no record created during the changeover
window is missing from the new database. With an announced pause this is a count
comparison on both sides.

- [ ] Done
- Date:
- Signed off by:
- Evidence (the counts on both sides):

## settling-period-agreed — How long the old service stays up but unused

The Java service is left running but unused for an agreed period after the switch. A
week is the suggestion; the length is the owner's decision.

- [ ] Done
- Date:
- Signed off by:
- Agreed period:

## old-service-retired — Fly.io service and its database no longer exist

Once the settling period ended: the Fly.io service and its separate database deleted,
the following month's hosting bill showing a single service, and one set of settings
rather than two that could disagree.

- [ ] Done
- Date:
- Signed off by:
- Evidence (the bill, and confirmation the service is gone):

## one-codebase-answers-questions — Somebody new answered both questions

Ask somebody who has not worked on this to answer, from billon-web alone with no
second codebase open: 'how is the next invoice number chosen?' and 'what may a sent
invoice become?' Record who, and what they said.

- [ ] Done
- Date:
- Signed off by:
- Who you asked, and their answers:

## single-edit-change-shipped — One change made and shipped as one edit

One change of the kind that used to mean editing the Java project, redeploying it and
then adjusting the screens — currency, tax entries, PDFs, invoice numbering — actually
made and shipped after the move as a single edit and a single deployment.

- [ ] Done
- Date:
- Signed off by:
- Which change, and the deployment:

## live-response-times — Measured on the live system, before and after

The dashboard, the client list, the invoice list and a single invoice measured on the
live system before and after the move. These normally answer in under about a second,
with a PDF in under about three seconds.

- [ ] Done
- Date:
- Signed off by:
- Before (dashboard / clients / invoices / one invoice / PDF):
- After (dashboard / clients / invoices / one invoice / PDF):

## no-password-in-logs — A known test password appears nowhere in the logs

Sign in with a known test password, wrongly and then rightly, then search the
application logs for it.

- [ ] Done
- Date:
- Signed off by:
- Evidence:

## secrets-differ-by-environment — Developer values are not the live values

The token-signing secret, the database connection details and any email credentials
appear nowhere in the code or in any committed file, and the values on a developer's
machine are different from the live ones.

- [ ] Done
- Date:
- Signed off by:
- Evidence:
