import { effectiveStatus } from './equipmentLifecycle';
import { PrismaClient, UserStatus, EquipmentStatus } from '@prisma/client';
import { inventoryTransaction } from './inventoryTransaction';
import { RequestActionError } from './requestActionError';
import { assertStockSupportsReservations } from './inventoryCapacityService';

// Retirement never deletes users, profiles, requests, loan lines or counters.
export async function retireAccount(prisma: PrismaClient, id: string, actorId: string) {
  if (id === actorId) throw new RequestActionError(409, 'Use another administrator account to retire this account.');
  return inventoryTransaction(prisma, async tx => {
    const user = await tx.user.findUnique({ where: { id }, select: { id: true, email: true, status: true } });
    if (!user) throw new RequestActionError(404, 'Account not found.');
    if (user.status === UserStatus.DEACTIVATED) return user;
    const retired = await tx.user.update({ where: { id }, data: { status: UserStatus.DEACTIVATED, sessionVersion: { increment: 1 } }, select: { id: true, email: true, status: true } });
    await tx.auditLog.create({ data: { actorUserId: actorId, action: 'RETIRE', entityType: 'User', entityId: id, details: { label: user.email, previous: user.status, next: retired.status } } });
    return retired;
  });
}

export async function retireEquipment(prisma: PrismaClient, id: string, actorId: string) {
  return inventoryTransaction(prisma, async tx => {
    const equipment = await tx.equipment.findUnique({ where: { id } });
    if (!equipment) throw new RequestActionError(404, 'Equipment not found.');
    if (equipment.retiredAt) return equipment;
    const retired = { ...equipment, retiredAt: new Date(), status: EquipmentStatus.UNAVAILABLE };
    // Outstanding loans may still be returned. An approved reservation must be
    // resolved before retirement; pending requests remain for review.
    await assertStockSupportsReservations(tx, retired);
    const saved = await tx.equipment.update({ where: { id }, data: { status: EquipmentStatus.UNAVAILABLE, retiredAt: retired.retiredAt } });
    await tx.auditLog.create({ data: { actorUserId: actorId, action: 'RETIRE', entityType: 'Equipment', entityId: id, details: { label: equipment.name, previous: equipment.status, next: saved.status } } });
    return saved;
  });
}

export async function restoreEquipment(prisma: PrismaClient, id: string, actorId: string) {
  return inventoryTransaction(prisma, async tx => {
    const equipment = await tx.equipment.findUnique({ where: { id } });
    if (!equipment) throw new RequestActionError(404, 'Equipment not found.');
    if (!equipment.retiredAt) return equipment;
    const status = effectiveStatus({ ...equipment, retiredAt: null });
    const restored = await tx.equipment.update({ where: { id }, data: { retiredAt: null, status } });
    await tx.auditLog.create({ data: { actorUserId: actorId, action: 'RESTORE', entityType: 'Equipment', entityId: id, details: { label: equipment.name, previous: equipment.status, next: status } } });
    return restored;
  });
}
