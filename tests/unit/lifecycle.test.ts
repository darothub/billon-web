import { describe, it, expect } from 'vitest'
import { canTransition, assertTransition, canDelete, stampFor } from '../helpers/contract'

/**
 * What an invoice may become next. These rules used to live only inside the Java
 * program; this file is now the readable statement of them, and the table below is
 * exhaustive on purpose — every pair of states is named, so a rule cannot be
 * loosened by accident.
 */

const STATES = ['DRAFT', 'SENT', 'OVERDUE', 'PAID', 'VOID'] as const

const ALLOWED: ReadonlyArray<[string, string]> = [
  ['DRAFT', 'SENT'],
  ['DRAFT', 'VOID'],
  ['SENT', 'PAID'],
  ['SENT', 'VOID'],
  ['SENT', 'OVERDUE'],
  ['OVERDUE', 'PAID'],
  ['OVERDUE', 'VOID'],
]

describe('the moves an invoice is allowed to make', () => {
  it.each(ALLOWED)('a %s invoice may become %s', (from, to) => {
    expect(canTransition(from as never, to as never)).toBe(true)
    expect(() => assertTransition(from as never, to as never)).not.toThrow()
  })

  const disallowed = STATES.flatMap((from) =>
    STATES.filter(
      (to) => from !== to && !ALLOWED.some(([f, t]) => f === from && t === to)
    ).map((to) => [from, to] as [string, string])
  )

  it.each(disallowed)('a %s invoice may not become %s', (from, to) => {
    expect(canTransition(from as never, to as never)).toBe(false)
  })

  it('refuses marking a draft as paid, with a message a screen can show', () => {
    expect(() => assertTransition('DRAFT', 'PAID')).toThrowError(/draft/i)
    let message = ''
    try {
      assertTransition('DRAFT', 'PAID')
    } catch (error) {
      message = (error as Error).message
    }
    expect(message.length).toBeGreaterThan(10)
    expect(message).not.toMatch(/undefined|\[object|Error:/)
  })

  it('will not move an invoice that is already paid or already void', () => {
    expect(canTransition('PAID', 'VOID')).toBe(false)
    expect(canTransition('PAID', 'SENT')).toBe(false)
    expect(canTransition('VOID', 'PAID')).toBe(false)
    expect(canTransition('VOID', 'SENT')).toBe(false)
    expect(() => assertTransition('PAID', 'VOID')).toThrow()
    expect(() => assertTransition('VOID', 'PAID')).toThrow()
  })
})

describe('deleting an invoice', () => {
  it('allows deleting a draft', () => {
    expect(canDelete('DRAFT')).toBe(true)
  })

  it.each(['SENT', 'OVERDUE', 'PAID', 'VOID'])('refuses deleting a %s invoice', (status) => {
    expect(canDelete(status as never)).toBe(false)
  })
})

describe('stamping the moment a move happened', () => {
  const at = new Date('2026-04-01T09:30:00.000Z')

  it('records when an invoice was sent', () => {
    expect(stampFor('SENT', at)).toMatchObject({ sentAt: at })
  })

  it('records when an invoice was paid', () => {
    expect(stampFor('PAID', at)).toMatchObject({ paidAt: at })
  })

  it('records when an invoice was voided', () => {
    expect(stampFor('VOID', at)).toMatchObject({ voidedAt: at })
  })

  it('does not invent a stamp for going overdue', () => {
    const stamp = stampFor('OVERDUE', at) as Record<string, unknown>
    expect(stamp.sentAt).toBeUndefined()
    expect(stamp.paidAt).toBeUndefined()
    expect(stamp.voidedAt).toBeUndefined()
  })
})
