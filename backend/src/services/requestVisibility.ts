import { Prisma, UserRole } from '@prisma/client';
import { DomainError } from './domainError';
type Actor = { id: string; role: UserRole };
/** Faculty see their own requests and those explicitly assigned to their profile. */
export function requestVisibility(actor: Actor): Prisma.BorrowRequestWhereInput {
  if (actor.role === UserRole.ADMIN) return {};
  return actor.role === UserRole.FACULTY
    ? { OR: [{ requestedBy: actor.id }, { faculty: { userId: actor.id } }] }
    : { requestedBy: actor.id };
}
export async function assertRequestVisible(db: Prisma.TransactionClient, actor: Actor, id?: string) {
  if (!id || actor.role === UserRole.ADMIN) return;
  if (!await db.borrowRequest.findFirst({ where: { AND: [{ id }, requestVisibility(actor)] }, select: { id: true } }))
    throw new DomainError(403, 'Access denied');
}
/** Shared timetables are public to signed-in users, linked request records are private. */
export function scheduleView<T extends { borrowRequest?: unknown; borrowRequestId?: unknown; createdBy?: unknown }>(schedule: T, actor: Actor) {
  if (actor.role === UserRole.ADMIN) return schedule;
  const { borrowRequest, borrowRequestId, createdBy, ...publicSchedule } = schedule;
  return publicSchedule;
}
