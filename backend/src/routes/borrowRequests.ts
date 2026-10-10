import { studentStanding } from '../services/studentStanding';
import { resolveRequestIntent } from '../services/requestTypePolicy';
import { prisma } from '../db/prisma';
import { pagination, pageHeaders } from '../utils/pagination';
import { requestVisibility } from '../services/requestVisibility';
import { sendError } from '../middleware/errors';
import { validateRequestItems } from '../services/inventoryCapacityService';
import { manilaDayBounds, parseManilaDate } from '../utils/manilaTime';
import { approveRequest, assertRoomAvailable } from '../services/approvalService';
import { inventoryTransaction } from '../services/inventoryTransaction';
import { changeLoanStatus } from '../services/inventoryMovementService';
import { Router } from 'express';
import { cancelBorrowRequest, RequestActionError } from '../services/cancelBorrowRequestService';
import { Prisma, RequestStatus, UserRole, NotificationType, ScheduleType } from '@prisma/client';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import {
  sendRequestCancelledEmail,
  sendAdminRequestEmail,
  sendRequestSubmittedEmail,
  sendRequestApprovedEmail,
  sendRequestRejectedEmail,
  sendEquipmentBorrowedEmail,
  sendEquipmentReturnedEmail,
} from '../services/email';
import {
  borrowRequestInclude,
  summarizeRequest,
  buildEmailDetails,
  buildBaseFilters,
  ensureTransition,
  sortMapping,
  type BorrowRequestWithRelations,
} from '../services/borrowRequestService';
import { notifyUser, notifyAdmins } from '../services/notificationService';
import { recordRequiredAuditLog } from '../services/auditLogService';
import {
  academicPeriodWhere,
  getPeriodSelectionFromQuery,
  resolveAcademicPeriodSelection,
} from '../services/academicPeriodService';

const router = Router();


// ─── GET / — List all requests (Admin & Faculty) ─────────────────────────────

router.get(
  '/',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN, UserRole.FACULTY),
  async (req, res) => {
    try {
      const { status, role, search, fromDate, toDate, sort } = req.query as Record<string, string | undefined>;
      const periodSelection = await resolveAcademicPeriodSelection(
        prisma,
        getPeriodSelectionFromQuery(req.query as Record<string, unknown>),
        req.user?.role
      );
      const periodFilter = academicPeriodWhere(periodSelection);

      const baseFilters = [requestVisibility(req.user!), periodFilter, ...buildBaseFilters({ search, role, fromDate, toDate })];
      const statusFilter = status && status !== 'ALL' ? { status: status as RequestStatus } : null;

      const where: Prisma.BorrowRequestWhereInput | undefined = statusFilter
        ? { AND: [...baseFilters, statusFilter] }
        : baseFilters.length
          ? { AND: baseFilters }
          : undefined;

      const orderBy = sortMapping[sort ?? ''] ?? sortMapping.newest;

      const paging = pagination(req.query);
      const requests = await prisma.borrowRequest.findMany({
        skip: paging.skip, take: paging.take,
        where,
        include: borrowRequestInclude,
        orderBy: [...(Array.isArray(orderBy) ? orderBy : [orderBy]), { id: 'asc' }],
      });

      const statusCounts = Object.values(RequestStatus).reduce<Record<RequestStatus, number>>((acc, statusKey) => {
        acc[statusKey] = 0;
        return acc;
      }, {} as Record<RequestStatus, number>);

      const baseWhere = baseFilters.length ? { AND: baseFilters } : undefined;
      const groups = await prisma.borrowRequest.groupBy({ by: ['status'], where: baseWhere, _count: { _all: true } });
      for (const group of groups) statusCounts[group.status] = group._count._all;
      const allTotal = groups.reduce((sum, group) => sum + group._count._all, 0);
      const total = statusFilter ? statusCounts[status as RequestStatus] ?? 0 : allTotal;
      pageHeaders(res, paging, total);
      res.json({ requests: requests.map(summarizeRequest), stats: statusCounts, total, allTotal, page: paging.page, pageSize: paging.pageSize });
    } catch (error) { sendError(error, res); }
  }
);

// ─── GET /my-requests — Student's own requests ────────────────────────────────

router.get('/my-requests', authenticateToken, async (req, res) => {
  try {
    const paging = pagination(req.query);
    const where: Prisma.BorrowRequestWhereInput = {
        requestedBy: req.user!.id,
        ...academicPeriodWhere(
          await resolveAcademicPeriodSelection(
            prisma,
            getPeriodSelectionFromQuery(req.query as Record<string, unknown>),
            req.user!.role
          )
        ),
      };
    const personalFilters = buildBaseFilters({ search: typeof req.query.search === 'string' ? req.query.search : undefined });
    if (req.query.status && req.query.status !== 'ALL') where.status = req.query.status as RequestStatus;
    where.AND = personalFilters;
    const requests = await prisma.borrowRequest.findMany({
      skip: paging.skip, take: paging.take,
      where,
      include: borrowRequestInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });

    const processedRequests = requests.map((request) => ({
      requestType: request.requestType,
      usageRoomId: request.usageRoomId,
      usageRoom: request.usageRoom,
      usageLocation: request.usageLocation,
      id: request.id,
      createdAt: request.createdAt.toISOString(),
      dateNeeded: request.dateNeeded.toISOString(),
      timeStart: request.timeStart?.toISOString() || null,
      timeEnd: request.timeEnd?.toISOString() || null,
      status: request.status,
      yearLevel: request.yearLevel,
      purpose: request.purpose || null,
      notes: request.notes || null,
      contactDetails: request.contactDetails || null,
      room: request.room,
      location: summarizeRequest(request).location,
      program: request.program,
      subject: request.subject,
      faculty: request.faculty
        ? {
          id: request.faculty.id,
          user: request.faculty.user,
        }
        : null,
      academicYearId: request.academicYearId,
      termId: request.termId,
      items: request.items.map((item) => ({
        id: item.id,
        equipmentId: item.equipmentId,
        quantity: item.quantity,
        equipment: item.equipment,
      })),
    }));

    const total = await prisma.borrowRequest.count({ where });
    pageHeaders(res, paging, total);
    res.json({ requests: processedRequests, total, page: paging.page, pageSize: paging.pageSize });
  } catch (error) { sendError(error, res); }
});

// ─── GET /:id — Single request ────────────────────────────────────────────────

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const periodSelection = await resolveAcademicPeriodSelection(
      prisma,
      getPeriodSelectionFromQuery(req.query as Record<string, unknown>),
      req.user?.role
    );

    const request = await prisma.borrowRequest.findFirst({
      where: {
        id,
        AND: [requestVisibility(req.user!)],
        ...academicPeriodWhere(periodSelection),
      },
      include: { ...borrowRequestInclude, reviewer: { select: { firstName: true, lastName: true } } },
    });

    if (!request) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    if (
      request.requestedBy !== req.user!.id &&
      req.user!.role !== UserRole.ADMIN &&
      req.user!.role !== UserRole.FACULTY
    ) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({ request });
  } catch (error) { sendError(error, res); }
});

// ─── POST / — Create borrow request ──────────────────────────────────────────

router.post('/', authenticateToken, authorizeRoles(UserRole.STUDENT, UserRole.FACULTY), async (req, res) => {
  try {
    const {
      facultyId, programId, subjectId, yearLevel,
      dateNeeded, timeStart, timeEnd,
      purpose, contactDetails, notes, academicYearId, termId, items: rawItems,
    } = req.body;
    const items = validateRequestItems(rawItems === undefined ? [] : rawItems);
    const intent = await resolveRequestIntent(prisma, req.body, req.user!.role, items);
    const periodSelection = await resolveAcademicPeriodSelection(
      prisma,
      { academicYearId, termId },
      req.user!.role
    );
    const resolvedAcademicYearId = periodSelection.academicYearId;
    const resolvedTermId = periodSelection.termId;
    if (!resolvedAcademicYearId || !resolvedTermId) {
      res.status(400).json({ error: 'An active academic period must be configured before creating requests.' });
      return;
    }

    // ── Duplicate detection ───────────────────────────────────────────────────
    // Reject if the same requester already has a PENDING request that includes
    // any of the same equipment items on the same calendar date.
    if (items && items.length > 0) {
      const requestedEquipmentIds: string[] = items.map((i: any) => i.equipmentId);
      const { start: dateStart, end: dateEnd } = manilaDayBounds(dateNeeded);

      const existingDuplicate = await prisma.borrowRequest.findFirst({
        where: {
          requestedBy: req.user!.id,
          status: RequestStatus.PENDING,
          dateNeeded: { gte: dateStart, lt: dateEnd },
          items: { some: { equipmentId: { in: requestedEquipmentIds } } },
          ...academicPeriodWhere(periodSelection),
        },
      });

      if (existingDuplicate) {
        res.status(409).json({
          error: 'You already have a pending request for one or more of these equipment items on the same date.',
          existingRequestId: existingDuplicate.id,
        });
        return;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    let requestProgramId = programId;
    let requestYearLevel = yearLevel;
    if (req.user!.role === UserRole.STUDENT) {
      const standing = await studentStanding(prisma, req.user!.id, resolvedAcademicYearId);
      requestProgramId = standing.programId;
      requestYearLevel = standing.yearLevel;
    }

    const requestData: any = {
      requestedBy: req.user!.id,
      facultyId, programId: requestProgramId, subjectId, yearLevel: requestYearLevel,
      dateNeeded: manilaDayBounds(dateNeeded).start,
      ...intent,
      timeStart: timeStart ? parseManilaDate(timeStart) : null,
      timeEnd: timeEnd ? parseManilaDate(timeEnd) : null,
      purpose, contactDetails, notes,
      academicYearId: resolvedAcademicYearId,
      termId: resolvedTermId,
      status: RequestStatus.PENDING,
    };

    if (items && items.length > 0) {
      requestData.items = {
        create: items.map((item: any) => ({
          equipmentId: item.equipmentId,
          quantity: item.quantity,
        })),
      };
    }

    const request = await inventoryTransaction(prisma, async tx => {
    if (req.user!.role === UserRole.STUDENT) Object.assign(requestData, await studentStanding(tx, req.user!.id, resolvedAcademicYearId));
    const saved = await tx.borrowRequest.create({
      data: requestData,
      include: borrowRequestInclude,
    });

    // Validate within the write transaction so a conflict rolls back the request and items.
    if (saved.requestType !== 'EQUIPMENT' && saved.roomId) {
      if (!saved.timeStart || !saved.timeEnd || saved.timeEnd <= saved.timeStart) {
        throw new RequestActionError(400, 'A valid room reservation time range is required.');
      }
      await assertRoomAvailable(tx, {
        roomId: saved.roomId, academicYearId: saved.academicYearId, termId: saved.termId,
        scheduleType: ScheduleType.ONE_TIME, scheduleDate: saved.dateNeeded,
        timeStart: saved.timeStart, timeEnd: saved.timeEnd,
      }, saved.id);
    }

    await recordRequiredAuditLog(tx, { actorUserId: req.user!.id, action: 'CREATE', entityType: 'BorrowRequest', entityId: saved.id, details: { requestType: intent.requestType, roomId: intent.roomId, usageRoomId: intent.usageRoomId, usageLocation: intent.usageLocation } });
    return saved;
    });

    const submittedDetails = buildEmailDetails(summarizeRequest(request as BorrowRequestWithRelations));
    await Promise.all([sendRequestSubmittedEmail(req.user!.email, submittedDetails), sendAdminRequestEmail(submittedDetails, 'submitted')])
      .catch(() => console.error('Email enqueue failed after request submission.'));

    notifyAdmins({
      type: NotificationType.REQUEST_PENDING,
      title: 'New Borrow Request',
      message: `${req.user!.firstName} ${req.user!.lastName} submitted a new borrow request.`,
      borrowRequestId: request.id,
    });

    res.status(201).json({ message: 'Borrow request created successfully', request });
  } catch (error) { sendError(error, res); }
});

// ─── PUT /:id — Owner edits a pending request ────────────────────────────────

router.put('/:id', authenticateToken, authorizeRoles(UserRole.STUDENT, UserRole.FACULTY), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      facultyId, programId, subjectId, yearLevel,
      dateNeeded, timeStart, timeEnd,
      purpose, contactDetails, notes, items: rawItems,
    } = req.body;

    const existingRequest = await prisma.borrowRequest.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingRequest) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    if (existingRequest.requestedBy !== req.user!.id) {
      res.status(403).json({ error: 'You can only edit your own requests' });
      return;
    }

    if (existingRequest.status !== RequestStatus.PENDING) {
      res.status(409).json({ error: 'Only pending requests can be edited' });
      return;
    }

    const items = validateRequestItems(rawItems);
    const intent = await resolveRequestIntent(prisma, req.body, req.user!.role, items);
    const periodSelection = { academicYearId: existingRequest.academicYearId, termId: existingRequest.termId };
    const resolvedAcademicYearId = existingRequest.academicYearId;
    const resolvedTermId = existingRequest.termId;

    if (!dateNeeded || !timeStart || !timeEnd || !purpose || !programId || !subjectId || !resolvedAcademicYearId || !resolvedTermId) {
      res.status(400).json({ error: 'Complete all required request fields before saving' });
      return;
    }

    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'Equipment selections must be an array' });
      return;
    }

    const requestedEquipmentIds: string[] = items.map(item => item.equipmentId);
    if (requestedEquipmentIds.length > 0) {
      const { start: dateStart, end: dateEnd } = manilaDayBounds(dateNeeded);
      const duplicateRequest = await prisma.borrowRequest.findFirst({
        where: {
          requestedBy: req.user!.id,
          id: { not: id },
          status: RequestStatus.PENDING,
          dateNeeded: { gte: dateStart, lt: dateEnd },
          items: { some: { equipmentId: { in: requestedEquipmentIds } } },
          ...academicPeriodWhere(periodSelection),
        },
      });

      if (duplicateRequest) {
        res.status(409).json({
          error: 'You already have another pending request for one or more of these equipment items on the same date.',
          existingRequestId: duplicateRequest.id,
        });
        return;
      }
    }

    // Editing a request must not replace its saved academic standing with today's profile.
    const requestProgramId = req.user!.role === UserRole.STUDENT ? existingRequest.programId : programId;
    const requestYearLevel = req.user!.role === UserRole.STUDENT ? existingRequest.yearLevel : yearLevel;

    const updatedRequest = await inventoryTransaction(prisma, async tx => {
    const saved = await tx.borrowRequest.update({
      where: { id, status: RequestStatus.PENDING },
      data: {
        facultyId: facultyId || null,
        programId: requestProgramId,
        subjectId,
        yearLevel: requestYearLevel == null || requestYearLevel === '' ? null : Number(requestYearLevel),
        dateNeeded: manilaDayBounds(dateNeeded).start,
        ...intent,
        timeStart: timeStart ? parseManilaDate(timeStart) : null,
        timeEnd: timeEnd ? parseManilaDate(timeEnd) : null,
        purpose: purpose.trim(),
        contactDetails: contactDetails || null,
        notes: notes || null,
        academicYearId: resolvedAcademicYearId,
        termId: resolvedTermId,
        items: {
          deleteMany: {},
          create: items,
        },
      },
      include: borrowRequestInclude,
    });
    // Validate within the write transaction so a conflict rolls back the request and items.
    if (saved.requestType !== 'EQUIPMENT' && saved.roomId) {
      if (!saved.timeStart || !saved.timeEnd || saved.timeEnd <= saved.timeStart) {
        throw new RequestActionError(400, 'A valid room reservation time range is required.');
      }
      await assertRoomAvailable(tx, {
        roomId: saved.roomId, academicYearId: saved.academicYearId, termId: saved.termId,
        scheduleType: ScheduleType.ONE_TIME, scheduleDate: saved.dateNeeded,
        timeStart: saved.timeStart, timeEnd: saved.timeEnd,
      }, saved.id);
    }

    await recordRequiredAuditLog(tx, { actorUserId: req.user!.id, action: 'UPDATE', entityType: 'BorrowRequest', entityId: saved.id, details: { requestType: intent.requestType, previousRequestType: existingRequest.requestType, roomId: intent.roomId, usageRoomId: intent.usageRoomId, usageLocation: intent.usageLocation } });
    return saved;
    });

    await sendAdminRequestEmail(buildEmailDetails(summarizeRequest(updatedRequest as BorrowRequestWithRelations)), 'updated', updatedRequest.updatedAt.toISOString()).catch(() => console.error('Email enqueue failed after request edit.'));
    notifyAdmins({
      type: NotificationType.REQUEST_PENDING,
      title: 'Borrow Request Updated',
      message: `${req.user!.firstName} ${req.user!.lastName} updated a pending borrow request.`,
      borrowRequestId: updatedRequest.id,
    });

    res.json({
      message: 'Borrow request updated successfully',
      request: summarizeRequest(updatedRequest as BorrowRequestWithRelations),
    });
  } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') { res.status(409).json({ error: 'Request changed. Refresh and try again.' }); return; } sendError(error, res); }
});

// ─── PATCH /:id/approve — Approve (Admin only) ────────────────────────────────

router.patch(
  '/:id/approve',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user!.id;

      const { request: updatedRequest, schedule } = await approveRequest(prisma, { id, actorId: adminId, actorRole: req.user!.role });
      if (schedule) {
        const approvedSummary = summarizeRequest(updatedRequest);
        await sendRequestApprovedEmail(updatedRequest.requester.email, buildEmailDetails(approvedSummary))
          .catch((err) => console.error('Email (approved) failed:', err));

        notifyUser(updatedRequest.requestedBy, {
          type: NotificationType.REQUEST_APPROVED,
          title: 'Request Approved ✓',
          message: 'Your request has been approved. Open it to review the reservation and any equipment collection details.',
          borrowRequestId: updatedRequest.id,
        });
        res.json({
          message: 'Request approved and lab schedule created successfully',
          request: approvedSummary,
          schedule: {
            id: schedule.id,
            scheduleType: schedule.scheduleType,
            room: {
              id: schedule.room?.id,
              roomNumber: schedule.room?.roomNumber,
              name: schedule.room?.name,
              isComputerLab: schedule.room?.isComputerLab,
            },
            faculty: {
              name: `${schedule.faculty.user.firstName} ${schedule.faculty.user.lastName}`,
              email: schedule.faculty.user.email,
            },
            program: schedule.program?.name,
            subject: schedule.subject?.name,
            dayOfWeek: schedule.dayOfWeek,
            scheduleDate: schedule.scheduleDate?.toISOString(),
            timeStart: schedule.timeStart.toISOString(),
            timeEnd: schedule.timeEnd.toISOString(),
            academicYear: schedule.academicYear.year,
            term: schedule.term.name,
            yearLevel: schedule.yearLevel,
            createdAt: schedule.createdAt.toISOString(),
          },
        });
      } else {
        const request = updatedRequest;

        const regularApprovedSummary = summarizeRequest(request);
        await sendRequestApprovedEmail(request.requester.email, buildEmailDetails(regularApprovedSummary))
          .catch((err) => console.error('Email (approved) failed:', err));

        notifyUser(request.requestedBy, {
          type: NotificationType.REQUEST_APPROVED,
          title: 'Request Approved ✓',
          message: 'Your borrow request has been approved. Please proceed to collect the equipment.',
          borrowRequestId: request.id,
        });
        res.json({ message: 'Request approved successfully', request: regularApprovedSummary });
      }
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') { res.status(409).json({ error: 'Request changed. Refresh and try again.' }); return; } sendError(error, res); }
  }
);

// ─── PATCH /:id/reject — Decline (Admin only) ─────────────────────────────────

router.patch(
  '/:id/reject',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    try {
      const { id } = req.params;
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

      if (!reason) {
        res.status(400).json({ error: 'Rejection reason is required' });
        return;
      }

      const request = await inventoryTransaction(prisma, async tx => {
        const existing = await tx.borrowRequest.findUnique({
          where: { id },
          select: { status: true, requestType: true },
        });

        if (!existing) {
          throw new RequestActionError(404, 'Request not found');
        }

        ensureTransition(existing.status, RequestStatus.REJECTED);

        const request = await tx.borrowRequest.update({
          where: { id, status: existing.status },
          data: {
            status: RequestStatus.REJECTED,
            reviewedBy: req.user!.id,
            reviewedAt: new Date(),
            declinedAt: new Date(),
            notes: reason,
          },
          include: borrowRequestInclude,
        });

        const releasedSchedules = await tx.labSchedule.findMany({ where: { borrowRequestId: id } });
        await tx.labSchedule.deleteMany({ where: { borrowRequestId: id } });
        await recordRequiredAuditLog(tx, { actorUserId: req.user!.id, action: 'REJECT', entityType: 'BorrowRequest', entityId: id, details: { reason, releasedSchedules: JSON.parse(JSON.stringify(releasedSchedules)) } });
        return request;
      });

      const rejectedSummary = summarizeRequest(request);
      await sendRequestRejectedEmail(request.requester.email, buildEmailDetails(rejectedSummary), reason)
        .catch((err) => console.error('Email (rejected) failed:', err));

      notifyUser(request.requestedBy, {
        type: NotificationType.REQUEST_REJECTED,
        title: 'Request Declined',
        message: `Your borrow request was declined. Reason: ${reason}`,
        borrowRequestId: request.id,
      });
      res.json({ message: 'Request declined successfully', request: rejectedSummary });
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') { res.status(409).json({ error: 'Request changed. Refresh and try again.' }); return; } sendError(error, res); }
  }
);

// ─── PATCH /:id/borrow — Mark as borrowed (Admin only) ───────────────────────

router.patch(
  '/:id/borrow',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    try {
      const { id } = req.params;

      const request = await inventoryTransaction(prisma, async tx => {
        const request = await changeLoanStatus(tx, id, 'borrow');
        await recordRequiredAuditLog(tx, { actorUserId: req.user!.id, action: 'BORROW', entityType: 'BorrowRequest', entityId: id });
        return request;
      });

      const borrowedSummary = summarizeRequest(request as BorrowRequestWithRelations);
      await sendEquipmentBorrowedEmail(request.requester.email, buildEmailDetails(borrowedSummary))
        .catch((err) => console.error('Email (borrowed) failed:', err));

      notifyUser(request.requestedBy, {
        type: NotificationType.EQUIPMENT_DUE,
        title: 'Equipment Borrowed',
        message: 'Your equipment has been marked as borrowed. Please return it in good condition.',
        borrowRequestId: request.id,
      });
      res.json({ message: 'Request marked as borrowed', request: borrowedSummary });
    } catch (error) { sendError(error, res); }
  }
);

// ─── PATCH /:id/return — Mark as returned (Admin only) ───────────────────────

router.patch(
  '/:id/return',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    try {
      const { id } = req.params;

      const request = await inventoryTransaction(prisma, async tx => {
        const request = await changeLoanStatus(tx, id, 'return');
        await recordRequiredAuditLog(tx, { actorUserId: req.user!.id, action: 'RETURN', entityType: 'BorrowRequest', entityId: id });
        return request;
      });

      const returnedSummary = summarizeRequest(request as BorrowRequestWithRelations);
      await sendEquipmentReturnedEmail(request.requester.email, buildEmailDetails(returnedSummary))
        .catch((err) => console.error('Email (returned) failed:', err));

      notifyUser(request.requestedBy, {
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        title: 'Return Confirmed ✓',
        message: 'Your equipment return has been confirmed. Thank you!',
        borrowRequestId: request.id,
      });
      res.json({ message: 'Request marked as returned', request: returnedSummary });
    } catch (error) { sendError(error, res); }
  }
);

// ─── PATCH /:id/cancel — Cancel (Owner for PENDING; Admin for PENDING or BORROWED) ───

router.patch('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { cancelledRequest, wasBorrowed: isBorrowed } = await inventoryTransaction(prisma, (tx) =>
      cancelBorrowRequest(tx, { id, actorId: req.user!.id, actorRole: req.user!.role })
    );

    const cancelledDetails = buildEmailDetails(summarizeRequest(cancelledRequest as BorrowRequestWithRelations));
    await sendRequestCancelledEmail(cancelledRequest.requester.email, cancelledDetails).catch(() => console.error('Cancellation email enqueue failed.'));
    if (req.user!.role !== 'ADMIN') {
      await sendAdminRequestEmail(cancelledDetails, 'cancelled').catch(() => console.error('Admin cancellation email enqueue failed.'));
      void notifyAdmins({ type: NotificationType.SYSTEM_ANNOUNCEMENT, title: 'Borrow Request Cancelled',
        message: 'A requester cancelled their borrow request. No further approval is needed.', borrowRequestId: cancelledRequest.id });
    }
    notifyUser(cancelledRequest.requestedBy, {
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      title: 'Request Cancelled',
      message: isBorrowed
        ? 'Your borrowed request has been cancelled by an admin. Equipment has been returned to inventory.'
        : 'Your borrow request has been cancelled.',
      borrowRequestId: cancelledRequest.id,
    });


    res.json({ message: 'Request cancelled successfully', request: summarizeRequest(cancelledRequest as BorrowRequestWithRelations) });
  } catch (error) { sendError(error, res); }
});

export default router;
