import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { RequestActionError } from './requestActionError';

// Must run inside a serializable transaction with retry, alongside the status write.
export async function assertAccountDeactivationAllowed(tx: Prisma.TransactionClient, targetId: string, actorId: string, nextStatus: UserStatus) {
  if (nextStatus !== UserStatus.DEACTIVATED) return;
  if (targetId === actorId) throw new RequestActionError(409, 'Ask another administrator to deactivate your account.');
  const actor = await tx.user.findUnique({ where: { id: actorId } });
  if (!actor || actor.role !== UserRole.ADMIN || actor.status !== UserStatus.ACTIVE) {
    throw new RequestActionError(403, 'An active administrator is required to deactivate accounts.');
  }
  const target = await tx.user.findUnique({ where: { id: targetId } });
  if (!target) throw new RequestActionError(404, 'Account not found.');
  if (target.role === UserRole.ADMIN && target.status === UserStatus.ACTIVE) {
    const remaining = await tx.user.count({ where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE, id: { not: targetId } } });
    if (remaining === 0) throw new RequestActionError(409, 'At least one active administrator must remain.');
  }
}
