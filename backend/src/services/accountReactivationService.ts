import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { escapeHtml } from './email/templates';
import { EMAIL_LOGO_CID } from './email/assets';

export function accountLink(email?: string) {
  const origin = process.env.FRONTEND_URL || 'http://localhost:5000';
  return new URL(email ? '/?returnTo=' + encodeURIComponent('/admin/users?search=' + encodeURIComponent(email)) : '/#login', origin).toString();
}
export async function queueAccountMail(tx: Prisma.TransactionClient, to: string, key: string, title: string, message: string, url: string, action: string) {
  const html = `<!doctype html><html><body style="margin:0;background:#f5f3f1;font-family:Arial,sans-serif;color:#321d1d"><table role="presentation" width="100%"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" style="max-width:600px;background:white;border:1px solid #ead7d3;border-top:4px solid #800000;border-radius:12px"><tr><td style="padding:24px;background:#fffaf6"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td width="64" style="vertical-align:middle"><img src="cid:${EMAIL_LOGO_CID}" alt="PUP seal" width="48" height="48" style="display:block;border:0;background:#ffffff;border-radius:50%"></td><td style="vertical-align:middle"><strong style="font-size:22px;color:#800000">SmartLab</strong><div style="font-size:12px;line-height:20px;color:#786565">PUP Lopez Campus</div></td></tr></table></td></tr><tr><td style="padding:24px"><h1 style="font-size:24px;color:#800000">${escapeHtml(title)}</h1><p style="white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7">${escapeHtml(message)}</p><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 20px;background:#800000;color:white;border-radius:8px;text-decoration:none">${escapeHtml(action)}</a><p style="font-size:12px;color:#786565">Automated SmartLab notification. For assistance, contact your laboratory administrator.</p></td></tr></table></td></tr></table></body></html>`;
  const text = `${title}\n\n${message}\n\n${action}: ${url}`;
  await tx.$executeRaw`INSERT INTO "EmailOutbox" ("id","eventKey","recipient","subject","html","text") VALUES (${randomUUID()},${key},${to},${'[SmartLab] '+title},${html},${text}) ON CONFLICT ("eventKey") DO NOTHING`;
}
export async function accountStatusChanged(tx: Prisma.TransactionClient, user: { id: string; email: string; status: string; updatedAt: Date }, previous: string) {
  if (previous === user.status) return;
  const active = user.status === 'ACTIVE';
  if (active) await tx.$executeRaw`UPDATE "ReactivationRequest" SET "status"='RESOLVED' WHERE "userId"=${user.id} AND "status"='PENDING'`;
  await queueAccountMail(tx,user.email,`account:${user.id}:${user.updatedAt.toISOString()}:${user.status}`,active ? 'Account reactivated' : 'Account deactivated',active ? 'Your SmartLab account has been reactivated. You can now sign in again.' : 'Your SmartLab account has been deactivated. To request reactivation, sign in with your email and password and choose Request reactivation. Your laboratory administrator will review your request.',accountLink(),'Sign in');
}
