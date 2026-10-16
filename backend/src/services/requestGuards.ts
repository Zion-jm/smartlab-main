import { Prisma } from '@prisma/client';
import { RequestActionError } from './requestActionError';
import { ValidationError } from './domainError';
import { studentStanding } from './studentStanding';
export function requireRequestVersion(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new RequestActionError(409, 'Refresh and review the latest request before continuing.', 'REQUEST_STALE');
}
export function assertRequestVersion(value: unknown, updatedAt: Date) {
  requireRequestVersion(value);
  if (new Date(value).getTime() !== updatedAt.getTime()) throw new RequestActionError(409, 'This request changed since you opened it. Refresh and review the latest details.', 'REQUEST_STALE');
}
export function assertNonemptyEquipment(request: {requestType: string; items: {quantity:number}[]}) {
  if (request.requestType === 'EQUIPMENT' && !request.items.some(item => item.quantity > 0)) throw new RequestActionError(409, 'No equipment remains available. Modify this request or cancel it.', 'EMPTY_EQUIPMENT_REQUEST');
}
export async function assertBorrowerEligible(tx: Prisma.TransactionClient, request: {requestedBy: string; academicYearId: string}) {
  const user = await tx.user.findUnique({where:{id:request.requestedBy},select:{status:true,role:true}});
  if (!user || user.status !== 'ACTIVE') throw new RequestActionError(409, 'The borrower account is inactive. Approval and checkout are blocked; existing equipment can still be returned.', 'BORROWER_INELIGIBLE');
  if (user.role === 'STUDENT') {
    try { await studentStanding(tx, request.requestedBy, request.academicYearId); }
    catch (error) { if (!(error instanceof ValidationError)) throw error; throw new RequestActionError(409, 'The student needs eligible enrollment for this request academic year before approval or checkout.', 'BORROWER_INELIGIBLE'); }
  }
}
