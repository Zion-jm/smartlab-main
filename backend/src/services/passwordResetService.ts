import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma';
import { DomainError } from './domainError';
import { queueAccountMail, accountLink } from './accountReactivationService';
import { recordRequiredAuditLog } from './auditLogService';
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
export async function requestPasswordReset(email: string, actorId?: string) {
  await prisma.$transaction(async tx => {
    const users = await tx.$queryRaw<{ id: string; email: string; sessionVersion: number }[]>`SELECT "id", "email", "sessionVersion" FROM "users" WHERE "email"=${email} FOR UPDATE`;
    const user = users[0]; if (!user) return;
    const recent = await tx.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) AS count FROM "PasswordReset" WHERE "userId"=${user.id} AND "createdAt">NOW()-INTERVAL '30 minutes'`;
    if (Number(recent[0].count) >= 3) return;
    const cooldown = await tx.$queryRaw<{ tokenHash: string }[]>`SELECT "tokenHash" FROM "PasswordReset" WHERE "userId"=${user.id} AND "createdAt">NOW()-INTERVAL '1 minute' LIMIT 1`;
    if (cooldown.length) return;
    const token = randomBytes(32).toString('hex'), tokenHash = digest(token);
    const origin = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');
    const url = new URL('/reset-password', origin); url.hash = 'token=' + token;
    await tx.$executeRaw`INSERT INTO "PasswordReset" ("tokenHash","userId","sessionVersion","expiresAt") VALUES (${tokenHash},${user.id},${user.sessionVersion},${new Date(Date.now()+30*60*1000)})`;
    await queueAccountMail(tx,user.email,'reset:'+tokenHash,'Reset your password','A password reset was requested for your SmartLab account. This link expires in 30 minutes and can be used once. If you did not request this, you can ignore this email. Your password has not changed.',url.toString(),'Reset password');
    await recordRequiredAuditLog(tx,{actorUserId:actorId || user.id,action:'PASSWORD_RESET_REQUESTED',entityType:'User',entityId:user.id});
  });
}
export async function resetPassword(token: string, password: string) {
  const tokenHash = digest(token), passwordHash = await bcrypt.hash(password,10);
  await prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<{userId:string;sessionVersion:number}[]>`SELECT "userId","sessionVersion" FROM "PasswordReset" WHERE "tokenHash"=${tokenHash} AND "usedAt" IS NULL AND "expiresAt">NOW()`;
    const reset = rows[0]; if (!reset) throw new DomainError(400,'This reset link is invalid or expired. Please request a new link.');
    const users = await tx.$queryRaw<{email:string;sessionVersion:number}[]>`SELECT "email","sessionVersion" FROM "users" WHERE "id"=${reset.userId} FOR UPDATE`;
    if (!users[0] || users[0].sessionVersion !== reset.sessionVersion) throw new DomainError(400,'This reset link is no longer valid. Please request a new link.');
    const claimed = await tx.$executeRaw`UPDATE "PasswordReset" SET "usedAt"=NOW() WHERE "tokenHash"=${tokenHash} AND "usedAt" IS NULL AND "expiresAt">NOW()`;
    if (!claimed) throw new DomainError(400,'This reset link is invalid or expired. Please request a new link.');
    await tx.user.update({where:{id:reset.userId},data:{passwordHash,sessionVersion:{increment:1}}});
    await tx.$executeRaw`UPDATE "PasswordReset" SET "usedAt"=NOW() WHERE "userId"=${reset.userId} AND "usedAt" IS NULL`;
    await queueAccountMail(tx,users[0].email,'reset-complete:'+tokenHash,'Password changed','Your SmartLab password has been reset. All existing sessions have ended. If you did not make this change, contact your laboratory administrator immediately. Your account activation status has not changed.',accountLink(),'Sign in');
    await recordRequiredAuditLog(tx,{actorUserId:reset.userId,action:'PASSWORD_RESET_COMPLETED',entityType:'User',entityId:reset.userId});
  });
}
