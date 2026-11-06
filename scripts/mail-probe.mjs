// Throwaway SMTP probe — reads .env and sends one mail to Mailpit directly.
// Run from the billon-web root:  node scripts/mail-probe.mjs
import { readFileSync } from 'node:fs'
import nodemailer from 'nodemailer'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l && !l.trimStart().startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

console.log('Using → host=%s port=%s user=%s from=%s',
  env.SMTP_HOST || '(empty)', env.SMTP_PORT, env.SMTP_USER || '(none)', env.SMTP_FROM || '(none)')

if (!env.SMTP_HOST) {
  console.error('✗ SMTP_HOST is empty in .env — the app would log the reset link to the console instead of sending.')
  process.exit(1)
}

const port = Number(env.SMTP_PORT || 587)
const t = nodemailer.createTransport({
  host: env.SMTP_HOST, port, secure: port === 465,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
})

try {
  await t.verify()
  console.log('✓ Connected to SMTP at %s:%s', env.SMTP_HOST, port)
  const info = await t.sendMail({
    from: env.SMTP_FROM || 'probe@billon.local',
    to: 'probe@billon.local',
    subject: 'Billon SMTP probe',
    text: 'If this shows up in Mailpit, SMTP works. The app just needs a restart + a real account email.',
  })
  console.log('✓ Sent. messageId=%s — check http://localhost:8025', info.messageId)
} catch (e) {
  console.error('✗ SMTP failed:', e.code || '', e.message)
}
