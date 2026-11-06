import { prisma } from '@/server/db/client'
import { recordActivity } from '@/server/activity/log'
import { startOfToday } from '@/server/util/format'

/**
 * The nightly sweep that turns unpaid invoices overdue.
 *
 * The failure worth guarding against is not getting an invoice wrong — it is the
 * sweep silently not running at all, which shows up as nothing: no error, no broken
 * screen, invoices just quietly stop turning overdue. So every run is written down,
 * whether it worked or not, and a run that fails says why.
 *
 * An invoice due today is not yet overdue; only one whose due date has passed is.
 */

export const JOB_NAME = 'mark-overdue'

export interface SweepResult {
  startedAt: Date
  finishedAt: Date
  invoicesChanged: number
  outcome: 'SUCCEEDED' | 'FAILED'
}

export async function markOverdue(now: Date = new Date()): Promise<SweepResult> {
  const run = await prisma.jobRun.create({
    data: { jobName: JOB_NAME, startedAt: now, outcome: 'RUNNING' },
  })

  try {
    const changed = await prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.updateMany({
        where: { status: 'SENT', dueDate: { lt: startOfToday(now) } },
        data: { status: 'OVERDUE' },
      })
      await recordActivity({
        subject: 'job',
        subjectId: run.id,
        action: 'marked overdue',
        detail: `${updated.count} invoice${updated.count === 1 ? '' : 's'} marked overdue`,
      }, tx)
      return updated
    })

    const finishedAt = new Date()
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { finishedAt, invoicesChanged: changed.count, outcome: 'SUCCEEDED' },
    })

    return {
      startedAt: run.startedAt,
      finishedAt,
      invoicesChanged: changed.count,
      outcome: 'SUCCEEDED',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), outcome: 'FAILED', errorMessage: message },
    })
    throw error
  }
}
