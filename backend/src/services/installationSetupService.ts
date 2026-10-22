import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { DomainError } from './domainError';
import { validNewPassword } from '../utils/passwordPolicy';
import { queueAccountMail } from './accountReactivationService';
import { emailDeliveryConfigured } from './email/transporter';
import { assertAcademicYearAtOrAfterBaseline } from './academicYearPolicy';
import { recordRequiredAuditLog } from './auditLogService';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
type State = {
  completedAt: Date | null; sessionHash: string | null; sessionExpiresAt: Date | null;
  email: string | null; name: string | null; passwordHash: string | null;
  verificationHash: string | null; verificationExpiresAt: Date | null; verifiedAt: Date | null;
  lastSentAt: Date | null; windowStartedAt: Date | null; sendCount: number;
};
function requireSetupToken(token: unknown) {
  const configured = process.env.INITIAL_SETUP_TOKEN || '';
  if (configured.length < 32) throw new DomainError(403, 'First-time setup is not enabled. Contact the deployer.');
  if (typeof token !== 'string' || token.length > 512 || !timingSafeEqual(Buffer.from(digest(token)), Buffer.from(digest(configured))))
    throw new DomainError(403, 'The setup token is invalid.');
}
async function locked<T>(action: (tx: Prisma.TransactionClient, state: State) => Promise<T>): Promise<T> {
  return prisma.$transaction(async tx => {
    // Matches the CLI bootstrap lock and prevents concurrent account creation.
    await tx.$executeRawUnsafe('LOCK TABLE "users" IN EXCLUSIVE MODE');
    const rows = await tx.$queryRaw<State[]>`SELECT * FROM "InstallationSetup" WHERE "id"='installation' FOR UPDATE`;
    const state = rows[0];
    if (!state || state.completedAt || await tx.user.count() || await tx.academicYear.count({where:{NOT:{id:'system-baseline-2026-2027',year:'2026-2027',isActive:false}}}) || await tx.term.count()
      || await tx.equipment.count() || await tx.building.count() || await tx.room.count()
      || await tx.program.count() || await tx.subject.count() || await tx.department.count())
      throw new DomainError(409, 'Setup is closed for this installation. Use the normal sign-in page.');
    return action(tx, state);
  }, { timeout: 10000 });
}
function requireSession(state: State, session: unknown) {
  if (typeof session !== 'string' || session.length !== 64 || digest(session) !== state.sessionHash
    || !state.sessionExpiresAt || state.sessionExpiresAt.getTime() <= Date.now())
    throw new DomainError(403, 'Your setup session has expired or changed. Start setup again.');
}
function mailOrigin() {
  let url: URL;
  try { url = new URL(process.env.FRONTEND_URL || ''); } catch { throw new DomainError(503, 'The deployer must configure the application URL.'); }
  if (url.username || url.password || (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))))
    throw new DomainError(503, 'The application URL must use HTTPS.');
  if (process.env.EMAIL_DELIVERY_ENABLED !== 'true' || !emailDeliveryConfigured())
    throw new DomainError(503, 'Email delivery is not configured. Contact the deployer.');
  return url.origin;
}
async function queueVerification(tx: Prisma.TransactionClient, state: State, email: string, origin: string) {
  const now = Date.now();
  const inWindow = state.windowStartedAt && now - state.windowStartedAt.getTime() < 3600000;
  if ((state.lastSentAt && now - state.lastSentAt.getTime() < 60000) || (inWindow && state.sendCount >= 5))
    throw new DomainError(429, 'Please wait before sending another link. Limit: five emails per hour.', 'RATE_LIMITED');
  const token = randomBytes(32).toString('hex');
  const tokenHash = digest(token);
  const url = new URL('/setup/verify', origin); url.hash = 'token=' + token;
  await tx.$executeRaw`UPDATE "InstallationSetup" SET "verificationHash"=${tokenHash}, "verificationExpiresAt"=(${new Date(now + 30*60000)}::timestamptz AT TIME ZONE 'UTC'),
    "verifiedAt"=NULL, "lastSentAt"=(${new Date(now)}::timestamptz AT TIME ZONE 'UTC'), "windowStartedAt"=(${inWindow ? state.windowStartedAt : new Date(now)}::timestamptz AT TIME ZONE 'UTC'),
    "sendCount"=${inWindow ? state.sendCount + 1 : 1} WHERE "id"='installation'`;
  await queueAccountMail(tx, email, 'setup:'+tokenHash, 'Verify your administrator email',
    'Confirm this email address for your new SmartLab installation. This link expires in 30 minutes and can be used once. Return to the original setup tab afterward. If you did not request setup, ignore this message.', url.toString(), 'Verify email');
}
export async function setupAccess(token: unknown) {
  requireSetupToken(token);
  return locked(async () => ({ available: true }));
}
export async function beginSetup(token: unknown, input: {name?: unknown; email?: unknown; password?: unknown}) {
  requireSetupToken(token);
  const origin = mailOrigin();
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 100
    || typeof input.email !== 'string' || input.email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(input.email.trim())
    || !validNewPassword(input.password)) throw new DomainError(400, 'Enter a name, valid email, and a password of at least 8 characters. Shorten the password if it is too long.');
  const email = input.email.trim().toLowerCase(), name = input.name.trim();
  const passwordHash = await bcrypt.hash(input.password, 12);
  const session = randomBytes(32).toString('hex');
  return locked(async (tx, state) => {
    await queueVerification(tx, state, email, origin);
    await tx.$executeRaw`UPDATE "InstallationSetup" SET "email"=${email}, "name"=${name}, "passwordHash"=${passwordHash},
      "sessionHash"=${digest(session)}, "sessionExpiresAt"=(${new Date(Date.now()+2*3600000)}::timestamptz AT TIME ZONE 'UTC') WHERE "id"='installation'`;
    return { session, email };
  });
}
export async function resendSetup(token: unknown, session: unknown) {
  requireSetupToken(token); const origin = mailOrigin();
  return locked(async (tx, state) => { requireSession(state, session); await queueVerification(tx, state, state.email!, origin); return { queued: true }; });
}
export async function setupProgress(token: unknown, session: unknown) {
  requireSetupToken(token);
  return locked(async (_tx, state) => { requireSession(state, session); return { verified: Boolean(state.verifiedAt), email: state.email }; });
}
export async function verifySetupEmail(token: unknown) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new DomainError(400, 'This verification link is invalid or expired.');
  return locked(async (tx, state) => {
    if (state.verificationHash !== digest(token) || !state.verificationExpiresAt || state.verificationExpiresAt.getTime() <= Date.now()
      || !state.sessionExpiresAt || state.sessionExpiresAt.getTime() <= Date.now()) throw new DomainError(400, 'This verification link is invalid, expired, or already used. Request another link from setup.');
    await tx.$executeRaw`UPDATE "InstallationSetup" SET "verifiedAt"=(NOW() AT TIME ZONE 'UTC'), "verificationHash"=NULL, "verificationExpiresAt"=NULL WHERE "id"='installation'`;
    return { verified: true };
  });
}
export async function finishSetup(token: unknown, session: unknown, input: {year?: unknown; term?: unknown}) {
  requireSetupToken(token);
  if (typeof input.year !== 'number' || !Number.isInteger(input.year) || input.year < 2000 || input.year > 2099
    || typeof input.term !== 'string' || !['1st Semester','2nd Semester','Summer Term'].includes(input.term)) throw new DomainError(400, 'Choose a valid starting year and semester.');
  const year = `${input.year}-${input.year+1}`, term = input.term;
  assertAcademicYearAtOrAfterBaseline(year);
  return locked(async (tx, state) => {
    requireSession(state, session);
    if (!state.verifiedAt || !state.email || !state.name || !state.passwordHash) throw new DomainError(403, 'Verify your email before finishing setup.');
    const [firstName, ...rest] = state.name.split(/\s+/);
    const user = await tx.user.create({data:{activationState:'COMPLETE',emailVerifiedAt:state.verifiedAt,activatedAt:new Date(),email:state.email,passwordHash:state.passwordHash,firstName,lastName:rest.join(' '),role:'ADMIN',adminProfile:{create:{}}}});
    await tx.academicYear.upsert({where:{year},create:{year,isActive:true},update:{isActive:true}});
    await tx.term.create({data:{name:term,isActive:true}});
    await recordRequiredAuditLog(tx,{actorUserId:user.id,action:'INSTALLATION_INITIALIZED',entityType:'Installation',entityId:'installation',details:{year,term}});
    await tx.$executeRaw`UPDATE "InstallationSetup" SET "completedAt"=(NOW() AT TIME ZONE 'UTC'), "sessionHash"=NULL, "sessionExpiresAt"=NULL,
      "email"=NULL, "name"=NULL, "passwordHash"=NULL, "verificationHash"=NULL, "verificationExpiresAt"=NULL, "verifiedAt"=NULL WHERE "id"='installation'`;
    return { complete: true };
  });
}
