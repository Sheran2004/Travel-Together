import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { parseFrom } from '../utils/helpers.js';

const transport = env.SMTP_URL ? nodemailer.createTransport(env.SMTP_URL) : null;
/** brevo-api: HTTPS (works on hosts that block SMTP, like Render free) | smtp | console (development) */
export const mailMode = env.BREVO_API_KEY ? 'brevo-api' : transport ? 'smtp' : 'console';

export async function sendMail({ to, subject, text }) {
  if (mailMode === 'brevo-api') {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: parseFrom(env.MAIL_FROM), to: [{ email: to }], subject, textContent: text }), signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) throw new Error(`Brevo API ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return { delivered: true };
  }
  if (mailMode === 'smtp') { await transport.sendMail({ from: env.MAIL_FROM, to, subject, text }); return { delivered: true }; }
  console.log(`\n[DEV MAIL: set BREVO_API_KEY or SMTP_URL to send real email]\nTo: ${to}\nSubject: ${subject}\n${text}\n`);
  return { delivered: false };
}
