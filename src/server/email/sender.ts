/**
 * Putting a single email with an attachment on its way, and saying plainly whether
 * that worked.
 *
 * Production refuses to claim an invoice was sent unless the provider accepts the
 * message. Tests use Nodemailer's in-memory transport so they exercise the same
 * attachment construction without leaving the process.
 */

export interface Attachment {
  filename: string
  content: Buffer
  contentType: string
}

export interface Email {
  to: string
  subject: string
  text: string
  attachments?: Attachment[]
}

export interface SendResult {
  sent: boolean
}

export class MailDeliveryError extends Error {
  constructor(message = 'The mail provider did not accept the invoice email.') {
    super(message)
    this.name = 'MailDeliveryError'
  }
}

export async function sendEmail(email: Email): Promise<SendResult> {
  try {
    const nodemailer = await import('nodemailer')
    const transport = process.env.NODE_ENV === 'test' && !process.env.SMTP_HOST
      ? nodemailer.createTransport({ jsonTransport: true })
      : nodemailer.createTransport(mailSettings())

    await transport.sendMail({
      from: senderAddress(),
      to: email.to,
      subject: email.subject,
      text: email.text,
      attachments: email.attachments,
      messageId: `<invoice-${safeMessageId(email.subject)}@billon.local>`,
    })

    return { sent: true }
  } catch (cause) {
    if (cause instanceof MailDeliveryError) throw cause
    console.error('[billon] mail provider rejected the message:', (cause as { response?: string }).response ?? (cause as Error).message)
    throw new MailDeliveryError()
  }
}

function mailSettings() {
  if (!process.env.SMTP_HOST) throw new MailDeliveryError('Invoice email is not configured.')
  const port = Number(process.env.SMTP_PORT ?? 587)
  return {
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  }
}

function senderAddress(): string {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER
  if (!from && process.env.NODE_ENV !== 'test') {
    throw new MailDeliveryError('Invoice email has no sender address configured.')
  }
  return from ?? 'tests@billon.local'
}

function safeMessageId(subject: string): string {
  return subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
