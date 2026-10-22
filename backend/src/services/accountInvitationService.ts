import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma';
import { DomainError } from './domainError';
import { queueAccountMail } from './accountReactivationService';
import { recordRequiredAuditLog } from './auditLogService';
import { emailDeliveryConfigured } from './email/transporter';
import { validNewPassword } from '../utils/passwordPolicy';
import { inventoryTransaction } from './inventoryTransaction';

export const usableActivation = { in: ['LEGACY', 'COMPLETE'] as ('LEGACY' | 'COMPLETE')[] };
export const isPendingActivation = (state: string) => state === 'PENDING' || state === 'CANCELLED';
const invalid = () => new DomainError(400, 'This invitation is invalid or expired. Ask your laboratory administrator for a new invitation.');
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
export function invitationOrigin() {
  if (process.env.EMAIL_DELIVERY_ENABLED !== 'true' || !emailDeliveryConfigured()) throw new DomainError(503, 'Email delivery must be configured and enabled before sending invitations.');
  const origin = process.env.FRONTEND_URL;
  if (!origin) throw new DomainError(503, 'The invitation website address is not configured.');
  let url: URL;
  try { url = new URL(origin); } catch { throw new DomainError(503, 'The invitation website address is invalid.'); }
  if ((process.env.NODE_ENV === 'production' && url.protocol !== 'https:') || !['http:', 'https:'].includes(url.protocol)) throw new DomainError(503, 'The invitation website address is invalid.');
  return url.origin;
}
export function normalizeInvitationEmail(value: unknown) {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.trim())) throw new DomainError(400, 'Enter a valid email address.');
  return value.trim().toLowerCase();
}
async function lockUser(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${id} FOR UPDATE`;
  const user = await tx.user.findUnique({ where: { id } });
  if (!user) throw new DomainError(404, 'Account not found.');
  return user;
}
export async function revokeInvitations(tx: Prisma.TransactionClient, userId: string) {
  await tx.accountInvitation.updateMany({ where: { userId, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  await tx.$executeRaw`UPDATE "EmailOutbox" SET "status"=CASE WHEN "status" IN ('PENDING','SENDING') THEN 'FAILED' ELSE "status" END,
    "html"='', "text"='', "lastError"='Invitation no longer valid.' WHERE "eventKey" IN (SELECT 'invitation:' || "id" FROM "AccountInvitation" WHERE "userId"=${userId})`;
}
// Caller holds the user's row lock (or has just inserted the user).
export async function issueInvitation(tx: Prisma.TransactionClient, user: { id: string; email: string }, actorId: string, origin: string) {
  const now = new Date();
  const recent = await tx.accountInvitation.findMany({ where: { userId: user.id, createdAt: { gt: new Date(now.getTime() - 3600000) } }, orderBy: { createdAt: 'desc' }, take: 5 });
  if (recent.length >= 5 || recent[0] && now.getTime() - recent[0].createdAt.getTime() < 60000) throw new DomainError(429, 'Wait at least one minute between invitations. Limit: five invitations per hour.', 'RATE_LIMITED');
  await revokeInvitations(tx, user.id);
  const token = randomBytes(32).toString('hex');
  const invitation = await tx.accountInvitation.create({ data: { userId: user.id, invitedEmail: user.email, tokenHash: hash(token), expiresAt: new Date(now.getTime() + 86400000), createdById: actorId } });
  const link = new URL('/activate-account', origin); link.hash = 'token=' + token;
  await queueAccountMail(tx, user.email, 'invitation:' + invitation.id, 'Set up your Smartlab account', 'Your laboratory administrator invited you to Smartlab. Choose your own password using the link below. This invitation expires in 24 hours and can be used once. If you were not expecting it, ignore this message or contact your laboratory administrator.', link.toString(), 'Set up your account');
  await recordRequiredAuditLog(tx, { actorUserId: actorId, action: 'ACCOUNT_INVITATION_QUEUED', entityType: 'User', entityId: user.id });
}
export async function manageInvitation(userId: string, actorId: string, action: 'resend' | 'email' | 'cancel' | 'reinvite', input?: unknown) {
  const origin = action === 'cancel' ? '' : invitationOrigin();
  return inventoryTransaction(prisma, async tx => {
    const user = await lockUser(tx, userId);
    if (action === 'reinvite' ? user.activationState !== 'CANCELLED' : user.activationState !== 'PENDING') throw new DomainError(409, 'This invitation action is not available for the account.');
    if (action === 'reinvite') await tx.user.update({ where: { id: userId }, data: { activationState: 'PENDING', status: 'DEACTIVATED', sessionVersion: { increment: 1 } } });
    if (action === 'cancel') {
      await revokeInvitations(tx, userId);
      await tx.user.update({ where: { id: userId }, data: { activationState: 'CANCELLED', sessionVersion: { increment: 1 } } });
      await recordRequiredAuditLog(tx, { actorUserId: actorId, action: 'ACCOUNT_INVITATION_CANCELLED', entityType: 'User', entityId: userId });
      return;
    }
    let email = user.email;
    if (action === 'email') {
      email = normalizeInvitationEmail(input);
      if (await tx.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, id: { not: userId } } })) throw new DomainError(409, 'Email is already registered.');
      await tx.user.update({ where: { id: userId }, data: { email, emailVerifiedAt: null, sessionVersion: { increment: 1 } } });
      await tx.passwordReset.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
      await recordRequiredAuditLog(tx, { actorUserId: actorId, action: 'INVITATION_EMAIL_CORRECTED', entityType: 'User', entityId: userId });
    }
    await issueInvitation(tx, { id: userId, email }, actorId, origin);
  });
}
function validToken(token: unknown): asserts token is string { if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw invalid(); }
export async function inspectInvitation(token: unknown) {
  validToken(token);
  const invitation = await prisma.accountInvitation.findUnique({ where: { tokenHash: hash(token) }, include: { user: true } });
  if (!invitation || invitation.usedAt || invitation.revokedAt || invitation.expiresAt <= new Date() || invitation.user.activationState !== 'PENDING' || invitation.user.status !== 'DEACTIVATED' || invitation.user.email !== invitation.invitedEmail) throw invalid();
  const [name, domain] = invitation.invitedEmail.split('@');
  return { email: `${name.slice(0, 1)}***@${domain}` };
}
export async function acceptInvitation(token: unknown, password: unknown, confirm: unknown) {
  validToken(token);
  if (!validNewPassword(password)) throw new DomainError(400, 'Use at least 8 characters. Shorten your password if it is too long.');
  if (password !== confirm) throw new DomainError(400, 'The passwords do not match.');
  await inspectInvitation(token);
  const passwordHash = await bcrypt.hash(password, 12);
  await inventoryTransaction(prisma, async tx => {
    const invitation = await tx.accountInvitation.findUnique({ where: { tokenHash: hash(token) } });
    if (!invitation) throw invalid();
    const user = await lockUser(tx, invitation.userId);
    if (user.activationState !== 'PENDING' || user.status !== 'DEACTIVATED' || user.email !== invitation.invitedEmail) throw invalid();
    const claimed = await tx.$executeRaw`UPDATE "AccountInvitation" SET "usedAt"=CURRENT_TIMESTAMP WHERE "id"=${invitation.id} AND "usedAt" IS NULL AND "revokedAt" IS NULL AND "expiresAt">CURRENT_TIMESTAMP`;
    if (claimed !== 1) throw invalid();
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, activationState: 'COMPLETE', status: 'ACTIVE', emailVerifiedAt: new Date(), activatedAt: new Date(), sessionVersion: { increment: 1 } } });
    await revokeInvitations(tx, user.id);
    await tx.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await recordRequiredAuditLog(tx, { actorUserId: user.id, action: 'ACCOUNT_INVITATION_ACCEPTED', entityType: 'User', entityId: user.id });
  });
}
