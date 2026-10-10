import { resolveRequestIntent } from '../services/requestTypePolicy';
import { validateRequestItems } from '../services/inventoryCapacityService';
import { prisma } from '../db/prisma';
import { pagination, pageHeaders } from '../utils/pagination';
import { scheduleView } from '../services/requestVisibility';
import { sendError } from '../middleware/errors';
import { manilaDayBounds, parseManilaDate } from '../utils/manilaTime';
import { approveRequest, assertRoomAvailable, assertEquipmentCapacity } from '../services/approvalService';
import { inventoryTransaction } from '../services/inventoryTransaction';
import { Router } from 'express';
import { Prisma, UserRole, RequestStatus, ScheduleType } from '@prisma/client';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import {
  calendarWeekday,
  minutesFromDate,
  checkScheduleConflicts,
  normalizeDayOfWeek,
  parseDateTime,
  resolveScheduleType,
} from '../services/labScheduleService';
import { recordRequiredAuditLog } from '../services/auditLogService';
import {
  academicPeriodWhere,
  getPeriodSelectionFromQuery,
  resolveAcademicPeriodSelection,
} from '../services/academicPeriodService';

const router = Router();


// ─── GET / — List all schedules (Admin & Faculty) ─────────────────────────────

router.get(
  '/',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN, UserRole.FACULTY, UserRole.STUDENT),
  async (req, res) => {
    try {
      const { date, dateFrom, dateTo, roomId, facultyId } = req.query;
      const periodSelection = await resolveAcademicPeriodSelection(
        prisma,
        getPeriodSelectionFromQuery(req.query as Record<string, unknown>),
        req.user?.role
      );

      const where: any = { ...academicPeriodWhere(periodSelection) };

      if (roomId) {
        where.roomId = roomId as string;
      }

      if (facultyId) {
        where.facultyId = facultyId as string;
      }

      if (dateFrom || dateTo) {
        const requestedFrom = typeof dateFrom === 'string' ? dateFrom : typeof dateTo === 'string' ? dateTo : null;
        const requestedTo = typeof dateTo === 'string' ? dateTo : typeof dateFrom === 'string' ? dateFrom : null;
        const parsedFrom = requestedFrom ? parseManilaDate(requestedFrom) : null;
        const rangeStart = parsedFrom && !Number.isNaN(parsedFrom.getTime()) ? manilaDayBounds(parsedFrom).start : null;
        const parsedTo = requestedTo ? parseManilaDate(requestedTo) : null;
        const inclusiveEnd = parsedTo && !Number.isNaN(parsedTo.getTime()) ? manilaDayBounds(parsedTo).start : null;

        if (!rangeStart || !inclusiveEnd || Number.isNaN(rangeStart.getTime()) || Number.isNaN(inclusiveEnd.getTime())) {
          res.status(400).json({ error: 'dateFrom and dateTo must be valid dates.' });
          return;
        }

        if (rangeStart > inclusiveEnd) {
          res.status(400).json({ error: 'dateFrom must be on or before dateTo.' });
          return;
        }

        const rangeEnd = new Date(inclusiveEnd);
        rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);
        const weekdays = new Set<number>();
        for (const cursor = new Date(rangeStart);cursor < rangeEnd && weekdays.size < 7;cursor.setUTCDate(cursor.getUTCDate() + 1)) {
          weekdays.add(calendarWeekday(cursor));
        }

        where.OR = [
          { scheduleType: ScheduleType.ONE_TIME, scheduleDate: { gte: rangeStart, lt: rangeEnd } },
          { scheduleType: ScheduleType.WEEKLY, dayOfWeek: { in: Array.from(weekdays) } },
        ];
      } else if (date) {
        const parsedDate = parseManilaDate(date);
        if (Number.isNaN(parsedDate.getTime())) { res.status(400).json({ error: 'Invalid calendar date.' }); return; }
        if (!Number.isNaN(parsedDate.getTime())) {
          where.OR = [
            { scheduleType: ScheduleType.ONE_TIME, scheduleDate: { gte: manilaDayBounds(parsedDate).start, lt: manilaDayBounds(parsedDate).end } },
            { scheduleType: ScheduleType.WEEKLY, dayOfWeek: calendarWeekday(parsedDate) },
          ];
        }
      }

      if (req.query.source === 'request') where.borrowRequestId = { not: null };
      if (req.query.source === 'admin') where.borrowRequestId = null;
      if (req.query.scheduleType && req.query.scheduleType !== 'all') where.scheduleType = req.query.scheduleType;
      if (typeof req.query.room === 'string' && req.query.room) where.room = { OR: [{ name: req.query.room }, { roomNumber: req.query.room }] };
      if (typeof req.query.program === 'string' && req.query.program) where.program = { OR: [{ name: req.query.program }, { code: req.query.program }] };
      if (typeof req.query.faculty === 'string' && req.query.faculty) where.faculty = { user: { AND: req.query.faculty.trim().split(/\s+/).map((word: string) => ({ OR: [{ firstName: { contains: word, mode: 'insensitive' } }, { lastName: { contains: word, mode: 'insensitive' } }] })) } };
      if (typeof req.query.search === 'string' && req.query.search.trim()) where.AND = req.query.search.trim().split(/\s+/).map((word: string) => ({ OR: [
        { room: { name: { contains: word, mode: 'insensitive' } } }, { room: { roomNumber: { contains: word, mode: 'insensitive' } } },
        { faculty: { user: { firstName: { contains: word, mode: 'insensitive' } } } }, { faculty: { user: { lastName: { contains: word, mode: 'insensitive' } } } },
        { program: { name: { contains: word, mode: 'insensitive' } } }, { subject: { name: { contains: word, mode: 'insensitive' } } },
      ] }));
      const paging = pagination(req.query);
      const schedules = await prisma.labSchedule.findMany({
        skip: paging.skip, take: paging.take,
        where,
        include: {
          room: true,
          faculty: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          program: true,
          subject: true,
          academicYear: true,
          term: true,
          borrowRequest: { select: { id: true } },
        },
        orderBy: [{ timeStart: 'asc' }, { id: 'asc' }],
      });

      const schedulesWithMetadata = schedules.map((schedule) => ({
        ...scheduleView(schedule, req.user!),
        _meta: {
          canChangeScheduleType: !schedule.borrowRequestId,
          isRequestDerived: !!schedule.borrowRequestId,
          lockReason: schedule.borrowRequestId
            ? 'Schedule type is locked because this was created from a request'
            : null,
        },
      }));

      const total = await prisma.labSchedule.count({ where });
      pageHeaders(res, paging, total);
      res.json({ schedules: schedulesWithMetadata, total, page: paging.page, pageSize: paging.pageSize });
    } catch (error) { sendError(error, res); }
  }
);

// ─── GET /resources — Admin resources for schedule creation ──────────────────

router.get(
  '/resources',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN, UserRole.FACULTY, UserRole.STUDENT),
  async (_req, res) => {
    try {
      const [rooms, programs, subjects, facultyProfiles, academicYears, terms] = await Promise.all([
        prisma.room.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true, roomNumber: true, buildingId: true, isComputerLab: true },
        }),
        prisma.program.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true, code: true },
        }),
        prisma.subject.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true, code: true },
        }),
        prisma.facultyProfile.findMany({
          orderBy: { user: { lastName: 'asc' } },
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
        prisma.academicYear.findMany({
          orderBy: { createdAt: 'desc' },
          select: { id: true, year: true, isActive: true },
        }),
        prisma.term.findMany({
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, isActive: true },
        }),
      ]);

      res.json({
        rooms,
        programs,
        subjects,
        faculty: facultyProfiles.map((profile) => ({
          profileId: profile.id,
          userId: profile.userId,
          firstName: profile.user?.firstName ?? null,
          lastName: profile.user?.lastName ?? null,
        })),
        academicYears,
        terms,
      });
    } catch (error) { sendError(error, res); }
  }
);

// ─── GET /:id — Single schedule ───────────────────────────────────────────────

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const periodSelection = await resolveAcademicPeriodSelection(
      prisma,
      getPeriodSelectionFromQuery(req.query as Record<string, unknown>),
      req.user?.role
    );

    const schedule = await prisma.labSchedule.findFirst({
      where: {
        id,
        ...academicPeriodWhere(periodSelection),
      },
      include: {
        room: true,
        faculty: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        program: true,
        subject: true,
        academicYear: true,
        term: true,
        borrowRequest: {
          include: {
            requester: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    res.json({
      schedule: {
        ...scheduleView(schedule, req.user!),
        _meta: {
          canChangeScheduleType: !schedule.borrowRequestId,
          isRequestDerived: !!schedule.borrowRequestId,
          lockReason: schedule.borrowRequestId
            ? 'Schedule type is locked because this was created from a request'
            : null,
        },
      },
    });
  } catch (error) { sendError(error, res); }
});

// ─── POST /admin/create — Admin direct schedule creation ─────────────────────

router.post(
  '/admin/create',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    try {
      const {
        roomId, facultyId, programId, subjectId, yearLevel,
        scheduleDate, dayOfWeek: dayOfWeekInput,
        scheduleType: scheduleTypeInput, timeStart, timeEnd,
        academicYearId, termId,
      } = req.body;
      if (!Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 4) {
        res.status(400).json({ error: 'Year level is required and must be between 1 and 4.' });
        return;
      }
      const periodSelection = await resolveAcademicPeriodSelection(
        prisma,
        { academicYearId, termId },
        req.user?.role
      );
      const resolvedAcademicYearId = periodSelection.academicYearId;
      const resolvedTermId = periodSelection.termId;

      const scheduleType = resolveScheduleType(scheduleTypeInput);
      const scheduleDateValue = parseDateTime(scheduleDate);
      const timeStartValue = parseDateTime(timeStart);
      const timeEndValue = parseDateTime(timeEnd);

      if (!roomId || !facultyId || !timeStartValue || !timeEndValue || !resolvedAcademicYearId || !resolvedTermId) {
        res.status(400).json({ error: 'Missing required schedule fields.' });
        return;
      }

      // Resolve facultyId: accept either FacultyProfile.id or User.id
      let resolvedFacultyId = facultyId;
      const facultyProfile = await prisma.facultyProfile.findFirst({
        where: { OR: [{ id: facultyId }, { userId: facultyId }] },
      });
      if (!facultyProfile) {
        res.status(400).json({ error: 'Faculty profile not found for the given facultyId.' });
        return;
      }
      resolvedFacultyId = facultyProfile.id;

      if (timeEndValue <= timeStartValue || minutesFromDate(timeEndValue) <= minutesFromDate(timeStartValue)) {
        res.status(400).json({ error: 'Use a time range within one Manila day, with the end after the start.' });
        return;
      }

      let normalizedDayOfWeek: number | null = null;

      if (scheduleType === ScheduleType.ONE_TIME) {
        if (!scheduleDateValue) {
          res.status(400).json({ error: 'scheduleDate is required for one-time schedules.' });
          return;
        }
        normalizedDayOfWeek = calendarWeekday(scheduleDateValue);
      } else {
        try {
          normalizedDayOfWeek = normalizeDayOfWeek(dayOfWeekInput);
        } catch (err) { sendError(err, res); }
      }

      if (normalizedDayOfWeek == null) {
        res.status(400).json({ error: 'Unable to determine dayOfWeek for schedule.' });
        return;
      }

      const schedule = await inventoryTransaction(prisma, async tx => {
        await assertRoomAvailable(tx, {
          roomId,
          academicYearId: resolvedAcademicYearId,
          termId: resolvedTermId,
          scheduleType,
          scheduleDate: scheduleDateValue,
          dayOfWeek: normalizedDayOfWeek,
          timeStart: timeStartValue,
          timeEnd: timeEndValue,
        });

        const schedule = await tx.labSchedule.create({
          data: {
            roomId, facultyId: resolvedFacultyId, programId, subjectId, yearLevel,
            scheduleType,
            scheduleDate: scheduleType === ScheduleType.ONE_TIME ? scheduleDateValue : null,
            dayOfWeek: normalizedDayOfWeek,
            timeStart: timeStartValue,
            timeEnd: timeEndValue,
            academicYearId: resolvedAcademicYearId,
            termId: resolvedTermId,
            createdBy: req.user!.id,
          },
          include: {
            room: true,
            faculty: {
              include: { user: { select: { firstName: true, lastName: true } } },
            },
            program: true,
            subject: true,
          },
        });


        await recordRequiredAuditLog(tx, {
          actorUserId: req.user!.id,
          action: 'CREATE',
          entityType: 'LabSchedule',
          entityId: schedule.id,
          details: {
            label: schedule.room?.roomNumber || schedule.room?.name || schedule.id,
            scheduleType: schedule.scheduleType,
            scheduleDate: schedule.scheduleDate,
          },
        });
        return schedule;
      });


      res.status(201).json({ message: 'Schedule created successfully', schedule });
    } catch (error) { sendError(error, res); }
  }
);

// ─── POST /request — Faculty schedule request ─────────────────────────────────

router.post(
  '/request',
  authenticateToken,
  authorizeRoles(UserRole.FACULTY),
  async (req, res) => {
    try {
      const {
        roomId, programId, subjectId, yearLevel,
        scheduleDate, timeStart, timeEnd,
        purpose, academicYearId, termId, items,
      } = req.body;
      const periodSelection = await resolveAcademicPeriodSelection(
        prisma,
        { academicYearId, termId },
        req.user?.role
      );
      if (!periodSelection.academicYearId || !periodSelection.termId) {
        res.status(400).json({ error: 'An active academic period must be configured before submitting a schedule request.' });
        return;
      }

      const facultyProfile = await prisma.facultyProfile.findUnique({
        where: { userId: req.user!.id },
      });

      if (!facultyProfile) {
        res.status(400).json({ error: 'Faculty profile not found' });
        return;
      }

      const selectedItems = validateRequestItems(items === undefined ? [] : items);
      const intent = await resolveRequestIntent(prisma, { requestType: 'LABORATORY', facultyId: facultyProfile.id, dateNeeded: scheduleDate, timeStart, timeEnd, purpose, roomId }, req.user!.role, selectedItems);
      const request = await inventoryTransaction(prisma, async tx => {
        await assertRoomAvailable(tx, {roomId, academicYearId: periodSelection.academicYearId!, termId: periodSelection.termId!, scheduleType: ScheduleType.ONE_TIME, scheduleDate: manilaDayBounds(scheduleDate).start, timeStart: parseManilaDate(timeStart), timeEnd: parseManilaDate(timeEnd)});
        const saved = await tx.borrowRequest.create({
        data: {
          ...intent,
          requestedBy: req.user!.id,
          facultyId: facultyProfile.id,
          programId, subjectId, yearLevel,
          dateNeeded: manilaDayBounds(scheduleDate).start,
          roomId,
          timeStart: parseManilaDate(timeStart),
          timeEnd: parseManilaDate(timeEnd),
          purpose,
          academicYearId: periodSelection.academicYearId!,
          termId: periodSelection.termId!,
          status: RequestStatus.PENDING,
          notes: 'Schedule request with lab reservation',
          items: {
            create: selectedItems.map((item) => ({
              equipmentId: item.equipmentId,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          items: { include: { equipment: true } },
          program: true,
          subject: true,
        },
        });
        await recordRequiredAuditLog(tx, {actorUserId: req.user!.id, action: 'CREATE', entityType: 'BorrowRequest', entityId: saved.id, details: {requestType: intent.requestType, roomId}});
        return saved;
      });

      res.status(201).json({ message: 'Schedule request submitted successfully', request });
    } catch (error) { sendError(error, res); }
  }
);

// ─── GET /check-conflicts/:requestId — Conflict pre-check (Admin) ─────────────

router.get(
  '/check-conflicts/:requestId',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    try {
      const { requestId } = req.params;

      const borrowRequest = await prisma.borrowRequest.findUnique({
        where: { id: requestId },
      });

      if (!borrowRequest) {
        res.status(404).json({ error: 'Request not found' });
        return;
      }

      if (!borrowRequest.roomId || !borrowRequest.timeStart || !borrowRequest.timeEnd) {
        res.status(400).json({ error: 'Invalid schedule request - missing time/room info' });
        return;
      }

      const conflicts = await checkScheduleConflicts({
        roomId: borrowRequest.roomId,
        academicYearId: borrowRequest.academicYearId,
        termId: borrowRequest.termId,
        scheduleType: ScheduleType.ONE_TIME,
        scheduleDate: borrowRequest.dateNeeded,
        dayOfWeek: calendarWeekday(borrowRequest.dateNeeded),
        timeStart: borrowRequest.timeStart,
        timeEnd: borrowRequest.timeEnd,
      });

      res.json({ hasConflicts: conflicts.length > 0, conflicts, request: borrowRequest });
    } catch (error) { sendError(error, res); }
  }
);

// ─── PATCH /approve-request/:requestId — Approve schedule request (Admin) ─────

router.patch(
  '/approve-request/:requestId',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    try {
      const { requestId } = req.params;

      const { request: updatedRequest, schedule } = await approveRequest(prisma, { id: requestId, actorId: req.user!.id, actorRole: req.user!.role, requireSchedule: true });

      res.json({
        message: 'Schedule request approved and schedule created',
        request: updatedRequest,
        schedule,
      });
    } catch (error) { sendError(error, res); }
  }
);

// ─── PUT /:id — Update schedule (Admin) ───────────────────────────────────────

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        roomId, facultyId, programId, subjectId, yearLevel,
        scheduleDate, dayOfWeek: dayOfWeekInput,
        scheduleType: scheduleTypeInput, timeStart, timeEnd,
        academicYearId, termId,
      } = req.body;

      if (yearLevel !== undefined && (!Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 4)) {
        res.status(400).json({ error: 'Year level is required and must be between 1 and 4.' });
        return;
      }

      const existing = await prisma.labSchedule.findUnique({
        where: { id },
        include: {
          borrowRequest: { select: { id: true, status: true, notes: true } },
        },
      });

      if (!existing) {
        res.status(404).json({ error: 'Schedule not found' });
        return;
      }

      if (existing.borrowRequestId && scheduleTypeInput && scheduleTypeInput !== existing.scheduleType) {
        res.status(400).json({
          error: 'Cannot change schedule type for schedules created from requests. Request-based schedules are always one-time. Create a new schedule for recurring needs.',
          currentType: existing.scheduleType,
          requestedType: scheduleTypeInput,
          borrowRequestId: existing.borrowRequestId,
        });
        return;
      }

      const nextScheduleType = scheduleTypeInput ? resolveScheduleType(scheduleTypeInput) : existing.scheduleType;
      const scheduleDateValue = scheduleDate !== undefined ? parseDateTime(scheduleDate) : existing.scheduleDate;
      const timeStartValue = timeStart !== undefined ? parseDateTime(timeStart) : existing.timeStart;
      const timeEndValue = timeEnd !== undefined ? parseDateTime(timeEnd) : existing.timeEnd;
      const nextRoomId = roomId ?? existing.roomId;
      const nextAcademicYearId = academicYearId ?? existing.academicYearId;
      const nextTermId = termId ?? existing.termId;

      if (!nextRoomId || !timeStartValue || !timeEndValue || !nextAcademicYearId || !nextTermId) {
        res.status(400).json({ error: 'Missing required schedule fields.' });
        return;
      }

      if (timeEndValue <= timeStartValue || minutesFromDate(timeEndValue) <= minutesFromDate(timeStartValue)) {
        res.status(400).json({ error: 'Use a time range within one Manila day, with the end after the start.' });
        return;
      }

      let normalizedDayOfWeek: number | null = null;

      if (nextScheduleType === ScheduleType.ONE_TIME) {
        if (!scheduleDateValue) {
          res.status(400).json({ error: 'scheduleDate is required for one-time schedules.' });
          return;
        }
        normalizedDayOfWeek = calendarWeekday(scheduleDateValue);
      } else {
        const daySource = dayOfWeekInput ?? existing.dayOfWeek;
        try {
          normalizedDayOfWeek = normalizeDayOfWeek(daySource);
        } catch (err) { sendError(err, res); }
      }

      if (normalizedDayOfWeek == null) {
        res.status(400).json({ error: 'Unable to determine dayOfWeek for schedule.' });
        return;
      }

      const conflictInput = {
        roomId: nextRoomId,
        academicYearId: nextAcademicYearId,
        termId: nextTermId,
        scheduleType: nextScheduleType,
        scheduleDate: scheduleDateValue,
        dayOfWeek: normalizedDayOfWeek,
        timeStart: timeStartValue,
        timeEnd: timeEndValue,
        excludeScheduleId: id,
      };


      if (existing.borrowRequestId && existing.borrowRequest) {
        const changes: string[] = [];
        if (roomId && roomId !== existing.roomId) changes.push(`Room changed to ${roomId}`);
        if (timeStart !== undefined && timeStartValue.getTime() !== existing.timeStart.getTime()) changes.push(`Time changed to ${timeStartValue.toISOString()}`);
        if (timeEnd !== undefined && timeEndValue.getTime() !== existing.timeEnd.getTime()) changes.push(`End time changed to ${timeEndValue.toISOString()}`);
        if (scheduleDate !== undefined && scheduleDateValue?.getTime() !== existing.scheduleDate?.getTime()) changes.push(`Date changed to ${scheduleDateValue?.toISOString()}`);

        const auditNote = changes.length > 0
          ? `Schedule modified on ${new Date().toISOString()}. ${changes.join(', ')}.`
          : `Schedule reviewed on ${new Date().toISOString()}.`;

        const [schedule, updatedRequest] = await inventoryTransaction(prisma, async tx => {
          await assertRoomAvailable(tx, conflictInput, existing.borrowRequestId!);
          const schedule = await tx.labSchedule.update({
            where: { id, updatedAt: existing.updatedAt },
            data: {
              roomId, facultyId, programId, subjectId, yearLevel,
              scheduleType: scheduleTypeInput ? nextScheduleType : undefined,
              scheduleDate: scheduleDate !== undefined ? (nextScheduleType === ScheduleType.ONE_TIME ? scheduleDateValue : null) : undefined,
              dayOfWeek: normalizedDayOfWeek,
              timeStart: timeStart !== undefined ? timeStartValue : undefined,
              timeEnd: timeEnd !== undefined ? timeEndValue : undefined,
              academicYearId: academicYearId ?? undefined,
              termId: termId ?? undefined,
            },
            include: {
              room: true,
              faculty: {
                include: { user: { select: { firstName: true, lastName: true } } },
              },
              program: true,
              subject: true,
            },
          });
          const updatedRequest = await tx.borrowRequest.update({
            where: { id: existing.borrowRequestId! },
            data: {
              roomId: roomId ?? undefined,
              timeStart: timeStart !== undefined ? timeStartValue : undefined,
              timeEnd: timeEnd !== undefined ? timeEndValue : undefined,
              ...(scheduleDate !== undefined && nextScheduleType === ScheduleType.ONE_TIME && scheduleDateValue
                ? { dateNeeded: scheduleDateValue }
                : {}),
              notes: existing.borrowRequest!.notes
                ? `${existing.borrowRequest!.notes}\n\n${auditNote}`
                : auditNote,
              reviewedBy: req.user!.id,
              reviewedAt: new Date(),
            },
          });
          if (updatedRequest.status === RequestStatus.APPROVED) {
            const loan = await tx.borrowRequest.findUniqueOrThrow({ where: { id: updatedRequest.id }, include: { items: true } });
            await assertEquipmentCapacity(tx, loan);
          }
          await recordRequiredAuditLog(tx, {
            actorUserId: req.user!.id,
            action: 'UPDATE',
            entityType: 'LabSchedule',
            entityId: id,
            details: { label: schedule.room?.roomNumber || schedule.room?.name || id, linkedRequest: true },
          });
          return [schedule, updatedRequest] as const;
        });

        res.json({
          message: 'Schedule and linked request updated successfully',
          schedule: {
            ...scheduleView(schedule, req.user!),
            _meta: {
              canChangeScheduleType: false,
              isRequestDerived: true,
              lockReason: 'Schedule type is locked because this was created from a request',
            },
          },
          linkedRequest: { id: updatedRequest.id, changes, auditNote },
        });

      } else {
        const schedule = await inventoryTransaction(prisma, async tx => {
          await assertRoomAvailable(tx, conflictInput);
          const schedule = await tx.labSchedule.update({
            where: { id, updatedAt: existing.updatedAt },
            data: {
              roomId, facultyId, programId, subjectId, yearLevel,
              scheduleType: scheduleTypeInput ? nextScheduleType : undefined,
              scheduleDate: scheduleDate !== undefined ? (nextScheduleType === ScheduleType.ONE_TIME ? scheduleDateValue : null) : undefined,
              dayOfWeek: normalizedDayOfWeek,
              timeStart: timeStart !== undefined ? timeStartValue : undefined,
              timeEnd: timeEnd !== undefined ? timeEndValue : undefined,
              academicYearId: academicYearId ?? undefined,
              termId: termId ?? undefined,
            },
            include: {
              room: true,
              faculty: {
                include: { user: { select: { firstName: true, lastName: true } } },
              },
              program: true,
              subject: true,
            },
          });


          await recordRequiredAuditLog(tx, {
            actorUserId: req.user!.id,
            action: 'UPDATE',
            entityType: 'LabSchedule',
            entityId: id,
            details: { label: schedule.room?.roomNumber || schedule.room?.name || id, linkedRequest: false },
          });
          return schedule;
        });

        res.json({
          message: 'Schedule updated successfully',
          schedule: {
            ...scheduleView(schedule, req.user!),
            _meta: { canChangeScheduleType: true, isRequestDerived: false, lockReason: null },
          },
        });

      }
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') { res.status(409).json({ error: 'Schedule changed. Refresh and try again.' }); return; } sendError(error, res); }
  }
);

// ─── DELETE /:id — Delete schedule (Admin) ────────────────────────────────────

router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    try {
      const { id } = req.params;
      await inventoryTransaction(prisma, async tx => {
        const schedule = await tx.labSchedule.findUnique({
          where: { id },
          include: { room: { select: { roomNumber: true, name: true } } },
        });
        await tx.labSchedule.delete({ where: { id } });
        await recordRequiredAuditLog(tx, {
          actorUserId: req.user!.id,
          action: 'DELETE',
          entityType: 'LabSchedule',
          entityId: id,
          details: { label: schedule?.room?.roomNumber || schedule?.room?.name || id },
        });
      });
      res.json({ message: 'Schedule deleted successfully' });
    } catch (error) { sendError(error, res); }
  }
);

export default router;
