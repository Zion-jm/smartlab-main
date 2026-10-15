import { recordRequiredAuditLog } from './auditLogService';
import { Prisma, RequestStatus, UserRole } from '@prisma/client';
import { borrowRequestInclude, ensureTransition } from './borrowRequestService';

import { RequestActionError } from './requestActionError';
export { RequestActionError } from './requestActionError';

// The caller owns the transaction so related notification changes roll back too.
export const cancelBorrowRequest = async (
  tx: Prisma.TransactionClient,
  input: { id: string; actorId: string; actorRole: UserRole; pendingOnly?: boolean }
) => {
  const request = await tx.borrowRequest.findUnique({
    where: { id: input.id }, include: { items: true },
  });
  if (!request) throw new RequestActionError(404, 'Request not found');
  const isAdmin = input.actorRole === UserRole.ADMIN;
  if (!isAdmin && request.requestedBy !== input.actorId) {
    throw new RequestActionError(403, 'Access denied');
  }
  const wasBorrowed = request.status === RequestStatus.BORROWED;
  if (wasBorrowed) throw new RequestActionError(409, 'Borrowed equipment must be returned, not cancelled.');
  const approvedRequest = request.status === RequestStatus.APPROVED;
  const allowed = request.status === RequestStatus.PENDING || (!input.pendingOnly && approvedRequest);
  if (!allowed) {
    throw new RequestActionError(409, input.pendingOnly ? 'Can only cancel pending requests' : isAdmin
      ? 'Can only cancel pending or approved requests' : 'Can only cancel pending or approved requests');
  }
  if (!approvedRequest) ensureTransition(request.status, RequestStatus.CANCELLED);
  const claimed = await tx.borrowRequest.updateMany({
    where: { id: request.id, requestedBy: request.requestedBy, status: request.status },
    data: { status: RequestStatus.CANCELLED, cancelledAt: new Date() },
  });
  if (claimed.count !== 1) throw new RequestActionError(409, 'Request changed. Refresh and try again.');

  const releasedSchedules = await tx.labSchedule.findMany({ where: { borrowRequestId: request.id } });
  await tx.labSchedule.deleteMany({ where: { borrowRequestId: request.id } });
  const cancelledRequest = await tx.borrowRequest.findUniqueOrThrow({
    where: { id: request.id }, include: borrowRequestInclude,
  });
  await recordRequiredAuditLog(tx, { actorUserId: input.actorId, action: 'CANCEL', entityType: 'BorrowRequest', entityId: request.id, details: { wasBorrowed, releasedSchedules: JSON.parse(JSON.stringify(releasedSchedules)) } });
  return { cancelledRequest, wasBorrowed };
};
