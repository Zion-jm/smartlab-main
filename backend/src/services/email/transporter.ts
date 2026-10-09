import nodemailer from 'nodemailer';
import { EMAIL_LOGO_CID, emailAttachments } from './assets';

// A credential-free local setup must not attempt external email delivery.
export const transporter = process.env.SMTP_PASS ? nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
}) : nodemailer.createTransport({ jsonTransport: true });

export const FROM = process.env.SMTP_FROM || 'SmartLab <no-reply@example.invalid>';

export const verifyEmailTransport = async (): Promise<void> => {
  if (process.env.EMAIL_PROVIDER === 'brevo') {
    console.log(emailDeliveryConfigured() ? 'Brevo API configured; delivery still requires EMAIL_DELIVERY_ENABLED=true.' : 'Brevo API is missing its key, sender email, or HTTPS FRONTEND_URL.');
    return;
  }
  if (!process.env.SMTP_PASS) {
    console.warn('⚠️  SMTP_PASS not set — email notifications are disabled.');
    return;
  }
  try {
    await transporter.verify();
    console.log('✉️  Email transport ready.');
  } catch (err) {
    console.warn('⚠️  Email transport unavailable:', (err as Error).message);
  }
};

export function emailDeliveryConfigured(): boolean {
  const provider = process.env.EMAIL_PROVIDER || 'smtp';
  if (provider === 'smtp') return Boolean(process.env.SMTP_PASS);
  if (provider !== 'brevo') return false;
  try {
    return Boolean(process.env.BREVO_API_KEY?.trim() && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(process.env.EMAIL_FROM_ADDRESS || '') && new URL(process.env.FRONTEND_URL || '').protocol === 'https:');
  } catch { return false; }
}

export class EmailDeliveryError extends Error {}

export async function sendQueuedEmail(job: { id: string; recipient: string; subject: string; html: string; text: string }): Promise<void> {
  if (process.env.EMAIL_DELIVERY_ENABLED !== 'true' || !emailDeliveryConfigured()) throw new EmailDeliveryError('Email delivery is disabled or incomplete.');
  if (process.env.EMAIL_PROVIDER === 'brevo') {
    const logoUrl = new URL('/PUPLogo.png', process.env.FRONTEND_URL!).href;
    const html = job.html.split('cid:' + EMAIL_LOGO_CID).join(logoUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;'));
    let response: Response;
    try {
      response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', signal: AbortSignal.timeout(20000),
        headers: { 'api-key': process.env.BREVO_API_KEY!.trim(), 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: { email: process.env.EMAIL_FROM_ADDRESS, name: process.env.EMAIL_FROM_NAME || 'SmartLab – PUP Lopez Campus' },
          to: [{ email: job.recipient }], subject: job.subject, htmlContent: html, textContent: job.text }),
      });
    } catch { throw new EmailDeliveryError('Brevo connection failed or timed out.'); }
    if (!response.ok) throw new EmailDeliveryError('Brevo HTTP ' + response.status + '; check API key, sender verification, activation and quota.');
    const result = await response.json().catch(() => null) as { messageId?: string } | null;
    if (!result?.messageId) throw new EmailDeliveryError('Brevo returned no message acceptance ID.');
    return;
  }
  const info = await transporter.sendMail({ from: FROM, to: job.recipient, subject: job.subject, html: job.html, text: job.text,
    messageId: '<' + job.id + '@smartlab.local>', attachments: emailAttachments(job.html) });
  if (info.rejected?.length || !info.accepted?.length) throw new EmailDeliveryError('SMTP did not accept the recipient.');
}
