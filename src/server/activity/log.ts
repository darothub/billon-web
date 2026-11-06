import type { Prisma } from '@prisma/client'
import { prisma } from '@/server/db/client'

/**
 * Writing down every change that matters, so 'who changed this invoice, and when?'
 * can be answered afterwards — including for an invoice that has since been deleted,
 * which is why nothing here points at the record it describes.
 *
 * Product changes pass their transaction here so the change and its audit entry
 * commit together. External outcomes use the default client because they cannot be
 * part of the database transaction they describe.
 */

export interface ActivityEntry {
  /** Who did it. Empty for the data move and the nightly sweep, which are not people. */
  accountId?: number | null
  subject: 'invoice' | 'client' | 'account' | 'job' | 'migration'
  subjectId?: number | null
  action: string
  detail?: string | null
}

type ActivityDatabase = Pick<Prisma.TransactionClient, 'activityLog'>

export async function recordActivity(
  entry: ActivityEntry,
  database: ActivityDatabase = prisma
): Promise<void> {
  await database.activityLog.create({
    data: {
      accountId: entry.accountId ?? null,
      subject: entry.subject,
      subjectId: entry.subjectId ?? null,
      action: entry.action,
      detail: entry.detail ?? null,
    },
  })
}

/** The usual detail for a status move: what it was, and what it became. */
export function statusChangeDetail(from: string, to: string): string {
  return `status ${from} to ${to}`
}
