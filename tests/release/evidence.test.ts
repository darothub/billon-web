import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The release gate for the switchover.
 *
 * Everything here is something a person does and then records. The test does not do
 * the thing; it refuses to let the switchover be called finished while the record is
 * missing. Expected to be red until each step has actually happened — which is why it
 * is its own project and not part of the per-change build gate.
 *
 *   npx vitest run --project release
 */

const ROOT = join(__dirname, '..', '..')
const CHECKLIST = join(ROOT, 'tests', 'manual', 'changeover-checklist.md')

interface Item {
  id: string
  title: string
  ticked: boolean
  notApplicable: boolean
  fields: Record<string, string>
  body: string
}

function readChecklist(): Map<string, Item> {
  const source = readFileSync(CHECKLIST, 'utf8')
  const items = new Map<string, Item>()
  // Sections start '## <id> — <title>'; skip the '## Format' preamble.
  const sections = source.split(/^## /m).slice(1)
  for (const section of sections) {
    const [heading, ...rest] = section.split('\n')
    const match = heading.match(/^([a-z0-9-]+)\s+[—-]\s+(.*)$/)
    if (!match) continue
    const body = rest.join('\n')
    const fields: Record<string, string> = {}
    for (const line of rest) {
      const field = line.match(/^-\s+([^:[\]]+):\s*(.*)$/)
      if (field) fields[field[1].trim().toLowerCase()] = field[2].trim()
    }
    items.set(match[1], {
      id: match[1],
      title: match[2].trim(),
      ticked: /^-\s+\[x\]\s+Done/im.test(body),
      notApplicable: /^-\s+\[x\]\s+Not applicable/im.test(body),
      fields,
      body,
    })
  }
  return items
}

const items = existsSync(CHECKLIST) ? readChecklist() : new Map<string, Item>()

function expectSignedOff(id: string, extraFields: string[] = []) {
  const item = items.get(id)
  expect(item, `the checklist has no '${id}' item`).toBeDefined()
  if (item!.notApplicable) return
  expect(item!.ticked, `'${item!.title}' has not been done`).toBe(true)
  const date = item!.fields.date ?? item!.fields['date the copy was taken'] ?? ''
  expect(date, `'${item!.title}' is ticked but carries no date`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(
    item!.fields['signed off by'],
    `'${item!.title}' is ticked but nobody put their name to it`
  ).toBeTruthy()
  for (const field of extraFields) {
    expect(
      item!.fields[field],
      `'${item!.title}' is ticked but '${field}' is empty — a ticked box with no evidence stops anybody looking`
    ).toBeTruthy()
  }
}

describe('the checklist itself', () => {
  it('exists and is readable', () => {
    expect(existsSync(CHECKLIST), 'tests/manual/changeover-checklist.md is missing').toBe(true)
    expect(items.size).toBeGreaterThan(15)
  })
})

describe('what somebody had to do by hand', () => {
  it('a full working day ran with the Java service switched off, with no errors', () => {
    expectSignedOff('soak-with-java-off', ['evidence'])
  })

  it('somebody new reached a working sign-in page on a clean machine', () => {
    const item = items.get('stranger-setup')
    expectSignedOff('stranger-setup', ['evidence'])
    if (item?.ticked) {
      const unanswered = item.fields['questions they had to ask'] ?? ''
      expect(
        /^(none|n\/?a|-)?$/i.test(unanswered.trim()),
        `the instructions left questions unanswered: ${unanswered}`
      ).toBe(true)
    }
  })

  it('five real invoices were compared side by side and signed off by the owner', () => {
    expectSignedOff('pdf-side-by-side', ['evidence'])
  })

  it('every account that had a logo before still shows it', () => {
    expectSignedOff('logos-carried-over', ['evidence'])
  })

  it('a logo uploaded before a deployment still displays after it', () => {
    expectSignedOff('logo-survives-deploy', ['evidence'])
  })

  it('breaking the money arithmetic was shown to break the tests', () => {
    expectSignedOff('mutation-check-demonstrated', ['what you changed, and which tests failed'])
  })

  it('somebody new answered both questions from billon-web alone', () => {
    expectSignedOff('one-codebase-answers-questions', ['who you asked, and their answers'])
  })

  it('one change was made and shipped as a single edit and a single deployment', () => {
    expectSignedOff('single-edit-change-shipped', ['which change, and the deployment'])
  })

  it('response times were measured on the live system before and after', () => {
    const item = items.get('live-response-times')
    expectSignedOff('live-response-times')
    if (item?.ticked) {
      expect(item.fields.before, 'no before-figures were recorded').toBeTruthy()
      expect(item.fields.after, 'no after-figures were recorded').toBeTruthy()
    }
  })

  it('a known test password appears nowhere in the logs', () => {
    expectSignedOff('no-password-in-logs', ['evidence'])
  })

  it("a developer's secrets are different from the live ones", () => {
    expectSignedOff('secrets-differ-by-environment', ['evidence'])
  })
})

describe('the four things only the Java project could answer', () => {
  const findings = join(ROOT, 'docs', 'JAVA-SERVICE-FINDINGS.md')
  const source = existsSync(findings) ? readFileSync(findings, 'utf8') : ''

  it('somebody opened the Java project and wrote down what they found', () => {
    expect(
      existsSync(findings),
      'docs/JAVA-SERVICE-FINDINGS.md does not exist. Four things could not be read from ' +
        'this project and were guessed at: how passwords were scrambled, what send does, ' +
        'where logos are kept, and what is really in the live database.'
    ).toBe(true)
    expect(source).toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('records how stored passwords were scrambled, and where that was found', () => {
    expect(source).toMatch(/password/i)
    expect(source, 'no file or setting is named as the source of the answer').toMatch(
      /\.(java|properties|ya?ml|xml|kt)\b/
    )
    expectSignedOff('password-scrambling-confirmed', ['evidence'])
  })

  it('if the old scrambling could not be reproduced, the reset was decided and announced first', () => {
    const confirmed = items.get('password-scrambling-confirmed')
    const fallback = items.get('password-reset-fallback')
    expect(fallback, "the checklist has no 'password-reset-fallback' item").toBeDefined()
    // Exactly one of the two outcomes must be recorded.
    const reproduced = fallback!.notApplicable
    expect(
      reproduced || fallback!.ticked,
      'neither outcome is recorded: either the old scrambling was reproduced, or the ' +
        'decision to reset everyone was written down and announced before the switch'
    ).toBe(true)
    if (!reproduced) {
      expect(
        fallback!.fields['evidence (where the decision is written, and the announcement that went out)'],
        'the reset was decided but there is no record it was announced to users beforehand'
      ).toBeTruthy()
      const announced = fallback!.fields.date ?? ''
      const switched = items.get('changeover-approach-agreed')?.fields.date ?? ''
      if (announced && switched) {
        expect(
          announced <= switched,
          'users were told about the password reset after the switch, not before'
        ).toBe(true)
      }
    }
    expect(confirmed).toBeDefined()
  })

  it("records which of exactly two things the 'send' button does", () => {
    const item = items.get('send-behaviour-confirmed')
    expectSignedOff('send-behaviour-confirmed', ['which of the two it is'])
    // The project's own documentation must state it, not just the checklist.
    const stated =
      /only changes the status|status to sent/i.test(source) ||
      /emails the invoice to the client/i.test(source)
    expect(
      stated,
      "docs/JAVA-SERVICE-FINDINGS.md must say plainly which of the two things 'send' does: " +
        'it emails the invoice to the client, or it only changes the status to sent'
    ).toBe(true)

    if (item?.ticked && /email/i.test(item.fields['which of the two it is'] ?? '')) {
      expect(
        item.fields.evidence,
        'send emails the client, so a test invoice must have arrived in a real inbox with ' +
          'the PDF attached — name the inbox'
      ).toBeTruthy()
    }
  })

  it('records where uploaded logos were actually kept', () => {
    expect(source).toMatch(/logo/i)
  })
})

describe('the switchover itself', () => {
  const runbook = join(ROOT, 'docs', 'MIGRATION.md')
  const source = existsSync(runbook) ? readFileSync(runbook, 'utf8') : ''

  it('the runbook exists', () => {
    expect(existsSync(runbook), 'docs/MIGRATION.md does not exist').toBe(true)
  })

  it('a dated full copy of the old database was taken and restored at least once', () => {
    expectSignedOff('backup-taken-and-restored', ['evidence'])
    const item = items.get('backup-taken-and-restored')!
    if (item.ticked) {
      expect(item.fields['date the copy was taken']).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(
        item.fields['date it was restored'],
        'a backup nobody has restored is not yet a backup'
      ).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('the move was rehearsed against a copy of the live data before the real run', () => {
    expectSignedOff('move-rehearsed', ['evidence'])
    const rehearsed = items.get('move-rehearsed')?.fields.date ?? ''
    const switched = items.get('changeover-window-reconciled')?.fields.date ?? ''
    if (rehearsed && switched) {
      expect(rehearsed <= switched, 'the rehearsal happened after the real run').toBe(true)
    }
  })

  it('the way back is written down and has been walked through', () => {
    expect(source, 'docs/MIGRATION.md says nothing about going back').toMatch(
      /roll ?back|going back|revert/i
    )
    expectSignedOff('rollback-walked-through', ['evidence'])
  })

  it('which changeover approach was used is written down, before the day', () => {
    const item = items.get('changeover-approach-agreed')
    expectSignedOff('changeover-approach-agreed', ['which approach', 'evidence'])
    if (item?.ticked) {
      expect(item.fields['which approach']).toMatch(/pause|live/i)
    }
    expect(source).toMatch(/announced pause|while.*live|downtime/i)
  })

  it('nothing created during the changeover window went missing', () => {
    expectSignedOff('changeover-window-reconciled', ['evidence'])
  })

  it('how long the old service stays up but unused was agreed with the owner', () => {
    expectSignedOff('settling-period-agreed', ['agreed period'])
  })

  it('the Fly.io service and its database are gone, and there is one bill', () => {
    expectSignedOff('old-service-retired', ['evidence'])
    const retired = items.get('old-service-retired')?.fields.date ?? ''
    const settled = items.get('settling-period-agreed')?.fields.date ?? ''
    if (retired && settled) {
      expect(
        retired >= settled,
        'the old service was deleted before the settling period was even agreed'
      ).toBe(true)
    }
  })
})

describe('the project explains itself without a second codebase', () => {
  const docs = ['docs/HLD.md', 'docs/LLD.md']
    .filter((f) => existsSync(join(ROOT, f)))
    .map((f) => readFileSync(join(ROOT, f), 'utf8'))
    .join('\n')

  it('the design notes say how the next invoice number is chosen', () => {
    expect(docs).toMatch(/invoice number/i)
    expect(
      docs,
      'nothing in docs/ explains how the next invoice number is allocated'
    ).toMatch(/next number|counter|invoiceNextNumber/i)
  })

  it('the design notes say what a sent invoice may become', () => {
    expect(docs).toMatch(/sent/i)
    expect(docs, 'nothing in docs/ explains the invoice states').toMatch(/paid/i)
    expect(docs).toMatch(/void/i)
  })

  it('the design notes no longer describe a separate Java service as part of the system', () => {
    expect(docs).not.toMatch(/fly\.dev|Spring Boot service|Java service (?:hosts|holds|answers)/i)
  })
})
