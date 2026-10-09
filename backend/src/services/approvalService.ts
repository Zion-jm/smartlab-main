import { recordRequiredAuditLog } from './auditLogService';
import { assertEquipmentCapacity } from './inventoryCapacityService';
export { assertEquipmentCapacity } from './inventoryCapacityService';
import { Prisma, PrismaClient, RequestStatus, ScheduleType, UserRole } from '@prisma/client';
import { RequestActionError } from './requestActionError';
import { inventoryTransaction } from './inventoryTransaction';
import { borrowRequestInclude } from './borrowRequestService';
import { calendarWeekday, checkScheduleConflicts, ConflictCheckInput, hasTimeOverlap, minutesFromDate, sameDay } from './labScheduleService';

export async function assertRoomAvailable(tx: Prisma.TransactionClient, input: ConflictCheckInput, excludeRequestId?: string) {
  if ((await checkScheduleConflicts(input, tx)).length) throw new RequestActionError(409, 'Room schedule conflict. Refresh and choose another time.');
  const reservations = await tx.borrowRequest.findMany({
    where: {
      roomId: input.roomId, requestType: { not: 'EQUIPMENT' }, status: { in: [RequestStatus.APPROVED, RequestStatus.BORROWED] },
      ...(input.academicYearId ? { academicYearId: input.academicYearId } : {}),
      ...(input.termId ? { termId: input.termId } : {}),
      ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
    }
  });
  if (reservations.some(r => (input.scheduleType === ScheduleType.ONE_TIME
    ? !!input.scheduleDate && sameDay(r.dateNeeded, input.scheduleDate)
    : calendarWeekday(r.dateNeeded) === input.dayOfWeek) &&
    (!r.timeStart || !r.timeEnd || hasTimeOverlap(r.timeStart, r.timeEnd, input.timeStart, input.timeEnd)))) {
    throw new RequestActionError(409, 'Room already reserved by an approved request.');
  }
}

export async function approveRequest(prisma: PrismaClient, input: { id: string; actorId: string; actorRole: UserRole; requireSchedule?: boolean }) {
  if (input.actorRole !== UserRole.ADMIN) throw new RequestActionError(403, 'Administrator access required.');
  return inventoryTransaction(prisma, async tx => {
    const request = await tx.borrowRequest.findUnique({ where: { id: input.id }, include: borrowRequestInclude });
    if (!request) throw new RequestActionError(404, 'Request not found');
    if (request.status !== RequestStatus.PENDING) throw new RequestActionError(409, 'Only pending requests can be approved.');
    if (request.requestType === 'LABORATORY' && request.requester.role !== UserRole.FACULTY) throw new RequestActionError(403, 'Only faculty can reserve a computer laboratory.');
    if (request.requestType === 'EQUIPMENT' && input.requireSchedule) throw new RequestActionError(400, 'Equipment-only requests cannot create a laboratory schedule.');
    const createSchedule = request.requestType === 'LABORATORY' || (request.requestType !== 'EQUIPMENT' && (!!request.room?.isComputerLab || !!input.requireSchedule));
    if (createSchedule && request.requester.role !== UserRole.FACULTY) throw new RequestActionError(403, 'Only faculty can reserve a computer laboratory.');
    if (createSchedule && (!request.roomId || !request.facultyId || !request.timeStart || !request.timeEnd)) throw new RequestActionError(400, 'Room, faculty and time range are required for a schedule.');
    if (request.roomId && request.requestType !== 'EQUIPMENT') {
      if (!request.timeStart || !request.timeEnd || minutesFromDate(request.timeEnd) <= minutesFromDate(request.timeStart)) throw new RequestActionError(400, 'A valid same-day time range is required for a room.');
      await assertRoomAvailable(tx, { roomId: request.roomId, academicYearId: request.academicYearId, termId: request.termId, scheduleType: ScheduleType.ONE_TIME, scheduleDate: request.dateNeeded, timeStart: request.timeStart, timeEnd: request.timeEnd }, request.id);
    }
    await assertEquipmentCapacity(tx, request);
    const claimed = await tx.borrowRequest.updateMany({ where: { id: request.id, status: RequestStatus.PENDING }, data: { status: RequestStatus.APPROVED, reviewedBy: input.actorId, reviewedAt: new Date(), approvedAt: new Date() } });
    if (claimed.count !== 1) throw new RequestActionError(409, 'Request changed. Refresh and try again.');
    const schedule = createSchedule ? await tx.labSchedule.create({
      data: {
        scheduleType: ScheduleType.ONE_TIME, roomId: request.roomId!, facultyId: request.facultyId!, programId: request.programId, subjectId: request.subjectId,
        dayOfWeek: calendarWeekday(request.dateNeeded), scheduleDate: request.dateNeeded, timeStart: request.timeStart!, timeEnd: request.timeEnd!,
        academicYearId: request.academicYearId, termId: request.termId, yearLevel: request.yearLevel, borrowRequestId: request.id, createdBy: input.actorId,
      }, include: { room: true, faculty: { include: { user: { select: { firstName: true, lastName: true, email: true } } } }, program: true, subject: true, academicYear: true, term: true }
    }) : null;
    const updatedRequest = await tx.borrowRequest.findUniqueOrThrow({ where: { id: request.id }, include: borrowRequestInclude });
    await recordRequiredAuditLog(tx, { actorUserId: input.actorId, action: 'APPROVE', entityType: 'BorrowRequest', entityId: request.id, details: { status: 'APPROVED', scheduleId: schedule?.id } });
    return { request: updatedRequest, schedule };
  });
}
