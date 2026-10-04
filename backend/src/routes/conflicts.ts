import { assertRequestVisible } from '../services/requestVisibility';
import { prisma } from '../db/prisma';
import { DomainError } from '../services/domainError';
import { sendError } from '../middleware/errors';
import { checkScheduleConflicts as findScheduleConflicts, ConflictCheckInput, calendarDay, calendarWeekday, sameDay, hasTimeOverlap, normalizeDayOfWeek, parseDateTime, resolveScheduleType } from '../services/labScheduleService';
import { Router } from 'express';
import { ScheduleType, UserRole } from '@prisma/client';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { dateToTimeString, timeToMinutes } from '../utils/timeBlocks';

const router = Router();


const MINUTES_PER_HOUR = 60;

const formatDate = (value: Date | null | undefined) => {
  if (!value) return null;
  return calendarDay(value);
};

const formatDayOfWeek = (dayIndex: number | null | undefined) => {
  if (typeof dayIndex !== 'number') return null;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayIndex] ?? null;
};

const formatTime = (value: Date | null | undefined) => {
  if (!value) return null;
  const totalMinutes = timeToMinutes(dateToTimeString(value));
  let hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : '';
  return `${hours}${minutesStr} ${ampm}`;
};

// Pending requests are advisory; unscheduled approved room reservations also block.
const checkScheduleConflicts = async (input: ConflictCheckInput & { excludeRequestId?: string }): Promise<any[]> => {
  const schedules = (await findScheduleConflicts(input)).filter(schedule => !input.excludeRequestId || schedule.borrowRequestId !== input.excludeRequestId);
  const linked = input.excludeScheduleId ? await prisma.labSchedule.findUnique({ where: { id: input.excludeScheduleId }, select: { borrowRequestId: true } }) : null;
  const pending = await prisma.borrowRequest.findMany({
    where: {
      roomId: input.roomId,
      OR: [{ status: 'PENDING' }, { status: { in: ['APPROVED', 'BORROWED'] }, schedules: { none: {} } }],
      ...(input.academicYearId ? { academicYearId: input.academicYearId } : {}),
      ...(input.termId ? { termId: input.termId } : {}),
      ...((input.excludeRequestId || linked?.borrowRequestId) ? { id: { notIn: [input.excludeRequestId, linked?.borrowRequestId].filter((id): id is string => Boolean(id)) } } : {}),
    }, include: { requester: { select: { firstName: true, lastName: true, email: true } }, room: true, subject: true, program: true }
  });
  return [...schedules, ...pending.filter(r =>
    (input.scheduleType === ScheduleType.ONE_TIME ? !!input.scheduleDate && sameDay(r.dateNeeded, input.scheduleDate) : calendarWeekday(r.dateNeeded) === input.dayOfWeek) &&
    (!r.timeStart || !r.timeEnd || hasTimeOverlap(r.timeStart, r.timeEnd, input.timeStart, input.timeEnd)))];
};

router.post(
  '/check',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN, UserRole.FACULTY, UserRole.STUDENT),
  async (req, res) => {
    try {
      const {
        roomId,
        academicYearId,
        termId,
        scheduleType: scheduleTypeInput,
        scheduleDate,
        dayOfWeek,
        timeStart,
        timeEnd,
        excludeScheduleId,
        excludeRequestId,
      } = req.body;

      const scheduleType = resolveScheduleType(scheduleTypeInput);
      const scheduleDateValue = parseDateTime(scheduleDate);
      const timeStartValue = parseDateTime(timeStart);
      const timeEndValue = parseDateTime(timeEnd);

      if (!roomId || !academicYearId || !termId || !timeStartValue || !timeEndValue) {
        res.status(400).json({ error: 'roomId, academicYearId, termId, timeStart, and timeEnd are required.' });
        return;
      }

      if (timeEndValue <= timeStartValue) {
        res.status(400).json({ error: 'timeEnd must be later than timeStart.' });
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
          normalizedDayOfWeek = normalizeDayOfWeek(dayOfWeek);
        } catch (err) { sendError(err, res); }
      }

      if (normalizedDayOfWeek == null) {
        res.status(400).json({ error: 'Unable to determine dayOfWeek for schedule.' });
        return;
      }

      if (excludeScheduleId && req.user!.role !== UserRole.ADMIN) {
        const owned = await prisma.labSchedule.findFirst({ where: { id: excludeScheduleId, faculty: { userId: req.user!.id } }, select: { id: true } });
        if (!owned) throw new DomainError(403, 'Access denied');
      }
      if (excludeRequestId != null && typeof excludeRequestId !== 'string') throw new DomainError(400, 'Invalid excluded request ID.');
      await assertRequestVisible(prisma, req.user!, excludeRequestId);
      const conflicts = await checkScheduleConflicts({
        roomId,
        academicYearId,
        termId,
        scheduleType,
        scheduleDate: scheduleDateValue,
        dayOfWeek: normalizedDayOfWeek,
        timeStart: timeStartValue,
        timeEnd: timeEndValue,
        excludeScheduleId,
        excludeRequestId,
      });

      const conflictSummaries = conflicts.map((conflict, index) => {
        if (req.user!.role !== UserRole.ADMIN) {
          return { id: 'conflict-' + index, type: 'faculty' in conflict ? 'lab_schedule' : 'borrow_request',
            severity: conflict.status === 'PENDING' ? 'medium' : 'high', title: 'Existing reservation',
            message: 'This room has an overlapping reservation.', details: {
              location: conflict.room?.roomNumber ?? conflict.room?.name ?? 'Lab room',
              date_needed: formatDate(conflict.scheduleDate ?? conflict.dateNeeded),
              day_of_week: formatDayOfWeek(conflict.dayOfWeek), time_start: formatTime(conflict.timeStart),
              time_end: formatTime(conflict.timeEnd), status: conflict.status ?? 'Approved',
            } };
        }
        // Check if this is a lab schedule or a pending request
        const isLabSchedule = 'faculty' in conflict;

        if (isLabSchedule) {
          const facultyName = conflict.faculty?.user
            ? `${conflict.faculty.user.firstName ?? ''} ${conflict.faculty.user.lastName ?? ''}`.trim()
            : null;
          const location = conflict.room?.name ?? conflict.room?.roomNumber ?? 'Lab room';
          const timeStartLabel = formatTime(conflict.timeStart);
          const timeEndLabel = formatTime(conflict.timeEnd);

          return {
            id: conflict.id,
            type: 'lab_schedule',
            severity: 'high',
            title: conflict.subject?.name ?? conflict.subject?.code ?? 'Existing schedule',
            message: `${location} is already reserved from ${timeStartLabel} to ${timeEndLabel}.`,
            details: {
              schedule_id: conflict.id,
              schedule_type: conflict.scheduleType,
              location,
              date_needed: formatDate(conflict.scheduleDate),
              day_of_week: formatDayOfWeek(conflict.dayOfWeek),
              time_start: timeStartLabel,
              time_end: timeEndLabel,
              subject: conflict.subject?.name ?? conflict.subject?.code,
              faculty_name: facultyName || undefined,
              program: conflict.program ? `${conflict.program.code} - ${conflict.yearLevel ?? ''}` : undefined,
              status: 'Approved',
            },
          };
        } else {
          const isPending = conflict.status === 'PENDING';
          const requesterName = conflict.requester
            ? `${conflict.requester.firstName ?? ''} ${conflict.requester.lastName ?? ''}`.trim()
            : 'Unknown requester';
          const location = conflict.room?.name ?? conflict.room?.roomNumber ?? 'Lab room';
          const timeStartLabel = formatTime(conflict.timeStart);
          const timeEndLabel = formatTime(conflict.timeEnd);

          return {
            id: conflict.id,
            type: 'borrow_request',
            severity: isPending ? 'medium' : 'high',
            title: conflict.subject?.name ?? conflict.subject?.code ?? (isPending ? 'Pending request' : 'Approved reservation'),
            message: `${location} has a ${isPending ? 'pending request' : 'reservation'} from ${timeStartLabel} to ${timeEndLabel} by ${requesterName}.`,
            details: {
              borrow_request_id: conflict.id,
              location,
              date_needed: formatDate(conflict.dateNeeded),
              time_start: timeStartLabel,
              time_end: timeEndLabel,
              subject: conflict.subject?.name ?? conflict.subject?.code,
              requester_name: requesterName,
              requester_email: conflict.requester?.email,
              program: conflict.program ? `${conflict.program.code} - ${conflict.yearLevel ?? ''}` : undefined,
              status: isPending ? 'Pending' : conflict.status,
            },
          };
        }
      });

      res.json({
        hasConflicts: conflictSummaries.length > 0,
        conflicts: conflictSummaries,
      });
    } catch (error) { sendError(error, res); }
  }
);

export default router;
