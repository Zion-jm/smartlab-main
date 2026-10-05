import { effectiveStatus } from './equipmentLifecycle';
import { BLOCKED_EQUIPMENT_STATUSES, MAX_QUANTITY } from './inventoryCapacityService';
import { Prisma, RequestStatus } from '@prisma/client';
import { RequestActionError } from './requestActionError';
import { borrowRequestInclude } from './borrowRequestService';

export async function moveInventory(tx: Prisma.TransactionClient, items: { equipmentId: string; quantity: number }[], direction: 'borrow' | 'restore') {
  // Consistent lock order avoids cycles for requests containing the same equipment.
  for (const item of [...items].sort((a, b) => a.equipmentId.localeCompare(b.equipmentId))) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > MAX_QUANTITY) throw new RequestActionError(409, 'Invalid loan quantity. Inventory review is required.');
    const changed = await tx.equipment.updateMany({
      where: { id: item.equipmentId, ...(direction === 'borrow' ? { retiredAt: null, availableQuantity: { gte: item.quantity }, status: { notIn: BLOCKED_EQUIPMENT_STATUSES } } : { borrowedQuantity: { gte: item.quantity } }) },
      data: direction === 'borrow'
        ? { availableQuantity: { decrement: item.quantity }, borrowedQuantity: { increment: item.quantity } }
        : { availableQuantity: { increment: item.quantity }, borrowedQuantity: { decrement: item.quantity } },
    });
    if (changed.count !== 1) throw new RequestActionError(409, direction === 'borrow' ? 'Not enough available equipment. Refresh and try again.' : 'Inventory does not match this loan. Inventory review is required.');
    const stock = await tx.equipment.findUniqueOrThrow({ where: { id: item.equipmentId } });
    await tx.equipment.update({ where: { id: stock.id }, data: { status: effectiveStatus(stock) } });
  }
}

export async function changeLoanStatus(tx: Prisma.TransactionClient, id: string, action: 'borrow' | 'return') {
  const request = await tx.borrowRequest.findUnique({ where: { id }, include: { items: true } });
  if (!request) throw new RequestActionError(404, 'Request not found');
  if (request.requestType === 'LABORATORY' && !request.items.length) throw new RequestActionError(400, 'Laboratory-only reservations do not have equipment to release or return.');
  const expected = action === 'borrow' ? RequestStatus.APPROVED : RequestStatus.BORROWED;
  if (request.status !== expected) throw new RequestActionError(409, 'Request status changed or this action was already completed. Refresh the request.');
  const claimed = await tx.borrowRequest.updateMany({
    where: { id, status: expected },
    data: action === 'borrow' ? { status: RequestStatus.BORROWED, borrowedAt: new Date() } : { status: RequestStatus.RETURNED, returnedAt: new Date() },
  });
  if (claimed.count !== 1) throw new RequestActionError(409, 'Request changed. Refresh and try again.');
  await moveInventory(tx, request.items, action === 'borrow' ? 'borrow' : 'restore');
  return tx.borrowRequest.findUniqueOrThrow({ where: { id }, include: borrowRequestInclude });
}
