import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
let transport = null;
if (env.SMTP_URL) transport = nodemailer.createTransport(env.SMTP_URL);
/** Sends via SMTP when SMTP_URL is set. In development without SMTP the email is printed to the server console. */
export async function sendMail({ to, subject, text }) {
  if (transport) { await transport.sendMail({ from: env.MAIL_FROM, to, subject, text }); return { delivered: true }; }
  console.log(`\n[DEV MAIL — set SMTP_URL to send real email]\nTo: ${to}\nSubject: ${subject}\n${text}\n`);
  return { delivered: false };
}
