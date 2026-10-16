import type { Prisma } from '@prisma/client';
import { buildEmailDetails, summarizeRequest, type BorrowRequestWithRelations } from './borrowRequestService';
import { notifyAdminsInTransaction, notifyUserInTransaction } from './notificationService';
import { sendAdminRequestEmail, sendRequestSubmittedEmail, sendRequestApprovedEmail, sendRequestRejectedEmail, sendEquipmentBorrowedEmail, sendEquipmentReturnedEmail, sendRequestCancelledEmail } from './email';

// Only durable database writes happen here. The outbox worker sends after commit.
export async function recordRequestCommunications(tx: Prisma.TransactionClient, request: BorrowRequestWithRelations, event: 'submitted' | 'updated' | 'approved' | 'rejected' | 'borrowed' | 'returned' | 'cancelled', actorRole?: string) {
  const details = buildEmailDetails(summarizeRequest(request));
  if (event === 'submitted' || event === 'updated' || (event === 'cancelled' && actorRole !== 'ADMIN')) {
    await sendAdminRequestEmail(details, event, event === 'updated' ? request.updatedAt.toISOString() : '', tx);
    await notifyAdminsInTransaction(tx, { type: event === 'cancelled' ? 'SYSTEM_ANNOUNCEMENT' : 'REQUEST_PENDING', title: event === 'submitted' ? 'New Borrow Request' : event === 'updated' ? 'Borrow Request Updated' : 'Borrow Request Cancelled', message: `${details.requesterName} ${event} a borrow request.`, borrowRequestId: request.id });
  }
  if (event === 'submitted') { await sendRequestSubmittedEmail(request.requester.email, details, tx); return; }
  if (event === 'updated') return;
  if (event === 'approved') await sendRequestApprovedEmail(request.requester.email, details, tx);
  if (event === 'rejected') await sendRequestRejectedEmail(request.requester.email, details, request.notes ?? '', tx);
  if (event === 'borrowed') await sendEquipmentBorrowedEmail(request.requester.email, details, tx);
  if (event === 'returned' && request.status === 'RETURNED') await sendEquipmentReturnedEmail(request.requester.email, details, tx);
  if (event === 'cancelled') await sendRequestCancelledEmail(request.requester.email, details, tx);
  const notices = {
    approved: { type: 'REQUEST_APPROVED', title: 'Request Approved', message: 'Your request has been approved. Open it to review reservation and collection details.' },
    rejected: { type: 'REQUEST_REJECTED', title: 'Request Declined', message: `Your request was declined. Reason: ${request.notes ?? ''}` },
    borrowed: { type: 'EQUIPMENT_DUE', title: 'Equipment Borrowed', message: 'Your equipment has been marked as borrowed. Please return it in good condition.' },
    returned: { type: 'SYSTEM_ANNOUNCEMENT', title: 'Return Confirmed', message: request.status === 'RETURNED' ? 'All equipment has been returned. View return history for condition and notes.' : 'A partial return was recorded. Some equipment remains outstanding. View return history for details.' },
    cancelled: { type: 'SYSTEM_ANNOUNCEMENT', title: 'Request Cancelled', message: 'Your borrow request has been cancelled.' },
  } as const;
  await notifyUserInTransaction(tx, request.requestedBy, { ...notices[event], borrowRequestId: request.id });
}
