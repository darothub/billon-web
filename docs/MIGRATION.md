# The switchover runbook

Moving Billon from two things — a web app and a separate service with its own database
— to one. This is the order to do it in, what to check at each step, and how to go
back.

Every step here has a matching item in `tests/manual/changeover-checklist.md`. Tick it
there when you have done it, with the date and your name; `npm run test:release`
refuses to call the switchover finished while any of them is missing.

## Before anything

1. **Answer the four unknowns.** Open the old project and fill in
   `docs/JAVA-SERVICE-FINDINGS.md`: how passwords were scrambled, what the send button
   really does, where logos were kept, and what is actually in the live database.
   Everything below assumes those answers.
2. **Take a full copy of the old database, and restore it once.** A backup nobody has
   restored is not yet a backup. Write down both dates.
3. **Capture what things look like now**, while the old service is still answering.
   Once it is off it is too late:
   - `tests/fixtures/invoice-sample-before-the-move.json` — one invoice in each of the
     five states, with its client, dates, figures, lines and tax entries
   - `tests/fixtures/dashboard-before-the-move.json` — one account's nine dashboard
     figures
   - `tests/fixtures/response-times-before-the-move.json` — how long the dashboard,
     the client list, the invoice list and one invoice take
   - five real invoice PDFs, to compare side by side afterwards
   - three real accounts' password scrambles, for `tests/db/auth.test.ts`

## Rehearse the move

Against the **restored copy**, never the live database:

```bash
docker compose up -d
DATABASE_URL=postgresql://billon:billon@localhost:5432/billon_test npx prisma migrate deploy
LEGACY_DATABASE_URL=postgresql://…restored-copy… \
DATABASE_URL=postgresql://billon:billon@localhost:5432/billon_test \
  npm run test:rehearsal
```

The rehearsal has its own script, separate from `npm run test:db`, because it cannot
run without the restored copy. Leaving it out of `test:db` keeps the per-change gate
green without hiding the rehearsal: run on its own without `LEGACY_DATABASE_URL`, it
fails loudly.

`tests/migration/migrate.test.ts` runs the move twice on purpose. Running it a second
time is what proves a second run is harmless — the mover matches records by the id
they had before and updates rather than inserts.

What the rehearsal has to show:

- the counts match on both sides, entity by entity
- every account's client and invoice counts match
- every account's invoice prefix and next-number counter came across as they were
- every account that had a logo still has one
- no invoice arrived without its lines
- the hand-checked sample of five invoices looks exactly as it did
- one account's nine dashboard figures match what they were

If a count does not match, the table and column names in
`scripts/migrate/legacy-schema.ts` are the first place to look — they are the expected
shape rather than something read off the real database.

## The switchover itself

The agreed approach is a **short announced pause**. Billon is used by individual
freelancers rather than continuously, so a brief pause costs almost nothing, and it
makes the check afterwards exact: the counts on both sides simply match, with no
window of records created mid-move to chase.

1. Announce the pause. If passwords have to be reset (see the findings), announce that
   **before** the day, not after.
2. Put the old service into read-only or take it down.
3. Take a final copy of its database.
4. Run the move against the live target:
   ```bash
   LEGACY_DATABASE_URL=… DATABASE_URL=… npm run migrate:legacy
   ```
   It prints the counts on both sides and stops with an error if any disagree.
5. Deploy this app with `DATABASE_URL`, `JWT_SECRET` and `CRON_SECRET` set.
6. Check the nightly sweep is scheduled: `vercel.json` asks for it, and a `JobRun` row
   appears after the first night.
7. Reconcile: nothing created during the window went missing.
8. Sign in as a real account and walk a whole working day through — dashboard,
   clients, raise, send, mark paid, download a PDF.
9. Compare the five captured PDFs side by side with the new ones and get the owner's
   sign-off.
10. Measure the same four screens again and record the figures.

## Going back

Rolling back is pointing at the old service again, and it is cheap for as long as that
service is still up. **Walk through these steps on a test setup before the day** — a
rollback plan nobody has tried is a guess.

1. Put this app back to the commit before the switchover, where `src/lib/api.ts` read
   its base address from a setting, and redeploy.
2. Point that setting back at the old service.
3. Bring the old service back up out of read-only.
4. Anything created in the new database since the switch has to be re-entered by hand.
   That is the cost of going back, and it is why the settling period below matters
   more than the speed of the switch.

The old service stays up but unused for an agreed settling period — a week is the
suggestion — before it and its database are deleted. Agree the length with the owner
and write it in the checklist. Only after that period is the second hosting bill gone.

## Afterwards

- Move `baselineRef` in `tests/contract/screen-baseline.json` forward to the commit
  that landed the switchover, so later screen work is not blocked by the check that
  no screen had to change. Do not delete the check.
- Delete the old service and its database, and confirm there is one bill.
