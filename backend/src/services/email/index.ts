import { prisma } from '../../db/prisma';
import { enqueueEmail } from './outbox';
import { reference, renderRequestEmail, type RequestDetails } from './templates';
export type { RequestDetails };
export { verifyEmailTransport } from './transporter';
const send = async (to: string, req: RequestDetails, event: string, title: string, message: string, reason?: string, includeRequesterIdentity = false) => {
  const content = renderRequestEmail(title, message, req, 'View request', reason, includeRequesterIdentity);
  await enqueueEmail({ to, eventKey: `${req.id}:${event}:${to.toLowerCase()}`, subject: `[SmartLab] ${title} – ${reference(req.id)}`, ...content });
};
export const sendRequestSubmittedEmail = (to: string, req: RequestDetails) => send(to,req,'submitted','Request received','Your request is pending administrator review.');
export const sendRequestApprovedEmail = (to: string, req: RequestDetails) => send(to,req,'approved','Request approved',req.items.length ? 'Your request is approved. Coordinate equipment collection with the laboratory administrator for your scheduled session.' : 'Your room request is approved. Use the room during your approved time slot.');
export const sendRequestRejectedEmail = (to: string, req: RequestDetails, reason: string) => send(to,req,'declined','Request declined','Your request could not be approved. Review the reason below.',reason);
export const sendEquipmentBorrowedEmail = (to: string, req: RequestDetails) => send(to,req,'borrowed','Equipment borrowed','Your equipment has been marked as borrowed. Coordinate its return with the laboratory administrator.');
export const sendEquipmentReturnedEmail = (to: string, req: RequestDetails) => send(to,req,'returned','Return confirmed','Your equipment return has been recorded.');
export const sendRequestCancelledEmail = (to: string, req: RequestDetails) => send(to,req,'cancelled','Request cancelled','This request is cancelled. Check the website for the latest details.');
export async function sendAdminRequestEmail(req: RequestDetails, event: 'submitted' | 'updated' | 'cancelled', revision = '') {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { email: true } });
  const title = event === 'submitted' ? 'New request awaiting review' : event === 'updated' ? 'Pending request updated' : 'Request cancelled';
  await Promise.all(admins.map(admin => send(admin.email, req, 'admin-'+event+revision, title, `${req.requesterName} ${event} a borrow request. ${event === 'cancelled' ? 'No further approval is needed.' : 'Open the request to review the current details.'}`, undefined, true)));
}
