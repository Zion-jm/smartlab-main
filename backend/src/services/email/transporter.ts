import nodemailer from 'nodemailer';

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
