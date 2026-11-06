import type { InvoiceStatus } from '@/lib/types'
import { badRequest } from '@/server/http/errors'

/**
 * What an invoice is allowed to become next.
 *
 * A draft may be sent or voided, and only a draft may be deleted. A sent invoice may
 * be marked paid, voided, or turned overdue by the nightly sweep. An overdue one may
 * still be paid or voided. A paid or voided invoice never moves again.
 *
 * The table below is the whole rule. Anything not in it is refused, so loosening a
 * rule takes an edit here rather than happening by accident somewhere else.
 */

const ALLOWED: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  DRAFT: ['SENT', 'VOID'],
  SENT: ['PAID', 'VOID', 'OVERDUE'],
  OVERDUE: ['PAID', 'VOID'],
  PAID: [],
  VOID: [],
}

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return (ALLOWED[from] ?? []).includes(to)
}

export function assertTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  if (canTransition(from, to)) return
  throw badRequest(refusal(from, to))
}

function refusal(from: InvoiceStatus, to: InvoiceStatus): string {
  if (from === 'DRAFT' && to === 'PAID') {
    return 'A draft invoice has to be sent before it can be marked paid.'
  }
  if (from === 'PAID') {
    return 'This invoice has already been paid, so it cannot be changed again.'
  }
  if (from === 'VOID') {
    return 'This invoice has been voided, so it cannot be changed again.'
  }
  if (from === 'SENT' && to === 'SENT') {
    return 'This invoice has already been sent.'
  }
  return `An invoice that is ${describe(from)} cannot be ${became(to)}.`
}

function describe(status: InvoiceStatus): string {
  return { DRAFT: 'a draft', SENT: 'sent', OVERDUE: 'overdue', PAID: 'paid', VOID: 'void' }[status]
}

function became(status: InvoiceStatus): string {
  return {
    DRAFT: 'put back to a draft',
    SENT: 'sent',
    OVERDUE: 'marked overdue',
    PAID: 'marked paid',
    VOID: 'voided',
  }[status]
}

/** Only a draft may be deleted; everything else is part of the record. */
export function canDelete(status: InvoiceStatus): boolean {
  return status === 'DRAFT'
}

export function assertDeletable(status: InvoiceStatus): void {
  if (canDelete(status)) return
  throw badRequest(
    'Only a draft invoice can be deleted. Void this one instead, so the record of it stays.'
  )
}

export interface Stamp {
  sentAt?: Date
  paidAt?: Date
  voidedAt?: Date
}

/** The moment a move happened, on whichever field records that move. */
export function stampFor(status: InvoiceStatus, at: Date = new Date()): Stamp {
  if (status === 'SENT') return { sentAt: at }
  if (status === 'PAID') return { paidAt: at }
  if (status === 'VOID') return { voidedAt: at }
  // Going overdue is something that happens to an invoice rather than something
  // somebody did, and the due date already says when. No stamp is invented for it.
  return {}
}

/** The word the activity log uses for a move. */
export function actionFor(status: InvoiceStatus): string {
  return {
    DRAFT: 'drafted',
    SENT: 'sent',
    OVERDUE: 'marked overdue',
    PAID: 'paid',
    VOID: 'voided',
  }[status]
}
