import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { NotificationType, UserRole, UserStatus } from '@prisma/client';

type Notice = { type: NotificationType; title: string; message: string; borrowRequestId?: string };
const pending = new Set<Promise<void>>();
function track(work: () => Promise<unknown>): Promise<void> {
  const task = Promise.resolve().then(work).then(() => {}, () => {
    console.error('Notification delivery failed.');
  });
  pending.add(task);
  void task.then(() => pending.delete(task));
  return task;
}

// Called after the domain transaction commits. Best effort; never holds a tx open.
export const notifyUser = (userId: string, data: Notice): void => {
  void track(() => prisma.notification.create({ data: { userId, ...data } }));
};
export const notifyAdmins = (data: Notice): Promise<void> => track(async () => {
  const admins = await prisma.user.findMany({
    where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE }, select: { id: true },
  });
  if (admins.length) await prisma.notification.createMany({ data: admins.map(({ id }) => ({ userId: id, ...data })) });
});

// Stop accepting HTTP requests and await active handlers before draining.
export async function drainNotifications(): Promise<void> {
  while (pending.size) await Promise.all([...pending]);
}

// Required writes: failures propagate so the domain transaction rolls back.
export async function notifyUserInTransaction(tx: Prisma.TransactionClient, userId: string, data: Notice) {
  await tx.notification.create({ data: { userId, ...data } });
}
export async function notifyAdminsInTransaction(tx: Prisma.TransactionClient, data: Notice) {
  const admins = await tx.user.findMany({ where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE }, select: { id: true } });
  if (admins.length) await tx.notification.createMany({ data: admins.map(({ id }) => ({ userId: id, ...data })) });
}
