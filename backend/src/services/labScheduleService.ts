import { prisma } from '../db/prisma';
import { ValidationError } from '../services/domainError';
import { manilaDateKey, manilaWeekday, manilaMinutes, parseManilaDate } from '../utils/manilaTime';
import { Prisma, ScheduleType } from '@prisma/client';



export const MINUTES_PER_HOUR = 60;

export const minutesFromDate = (value: Date): number =>
  manilaMinutes(value);

export const hasTimeOverlap = (
  existingStart: Date,
  existingEnd: Date,
  candidateStart: Date,
  candidateEnd: Date
): boolean => {
  const existingStartMinutes = minutesFromDate(existingStart);
  const existingEndMinutes = minutesFromDate(existingEnd);
  const candidateStartMinutes = minutesFromDate(candidateStart);
  const candidateEndMinutes = minutesFromDate(candidateEnd);
  return candidateStartMinutes < existingEndMinutes && candidateEndMinutes > existingStartMinutes;
};

export const normalizeDayOfWeek = (value: unknown): number => {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isInteger(parsed) || parsed < 0 || parsed > 6) {
    throw new ValidationError('dayOfWeek must be a number between 0 (Sunday) and 6 (Saturday).');
  }
  return parsed;
};

export const parseDateTime = (value: unknown): Date | null => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = parseManilaDate(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const scheduleTypeValues = new Set(Object.values(ScheduleType));

export const resolveScheduleType = (value: unknown): ScheduleType =>
  typeof value === 'string' && scheduleTypeValues.has(value as ScheduleType)
    ? (value as ScheduleType)
    : ScheduleType.ONE_TIME;

// dateNeeded/scheduleDate represent the Manila calendar day; clock times are UTC instants.
export const calendarDay = manilaDateKey;
export const calendarWeekday = manilaWeekday;
export const sameDay = (a: Date, b: Date): boolean => calendarDay(a) === calendarDay(b);

export type ConflictCheckInput = {
  roomId: string;
  academicYearId?: string | null;
  termId?: string | null;
  scheduleType: ScheduleType;
  scheduleDate?: Date | null;
  dayOfWeek?: number | null;
  timeStart: Date;
  timeEnd: Date;
  excludeScheduleId?: string;
};

export const checkScheduleConflicts = async ({
  roomId,
  academicYearId,
  termId,
  scheduleType,
  scheduleDate,
  dayOfWeek,
  timeStart,
  timeEnd,
  excludeScheduleId,
}: ConflictCheckInput, db: Prisma.TransactionClient = prisma) => {
  const candidateDayOfWeek =
    scheduleType === ScheduleType.ONE_TIME
      ? (scheduleDate ? calendarWeekday(scheduleDate) : null)
      : dayOfWeek ?? null;

  if (candidateDayOfWeek == null) {
    throw new ValidationError('dayOfWeek is required to check schedule conflicts.');
  }

  const where: Prisma.LabScheduleWhereInput = {
    roomId,
    ...(excludeScheduleId && { id: { not: excludeScheduleId } }),
  };

  if (academicYearId) {
    where.academicYearId = academicYearId;
  }

  if (termId) {
    where.termId = termId;
  }

  const conflicts = await db.labSchedule.findMany({
    where,
    include: {
      room: true,
      faculty: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      program: true,
      subject: true,
    },
  });

  return conflicts.filter((existing) => {
    if (!hasTimeOverlap(existing.timeStart, existing.timeEnd, timeStart, timeEnd)) {
      return false;
    }

    const existingIsOneTime = existing.scheduleType === ScheduleType.ONE_TIME;
    const existingDate = existing.scheduleDate;
    const existingDay = existing.dayOfWeek;

    if (scheduleType === ScheduleType.ONE_TIME) {
      if (!scheduleDate) {
        return false;
      }

      if (existingIsOneTime) {
        if (!existingDate) {
          return false;
        }
        return sameDay(existingDate, scheduleDate);
      }

      return existingDay === candidateDayOfWeek;
    }

    // Candidate is weekly
    if (existingIsOneTime) {
      if (!existingDate) {
        return false;
      }
      return calendarWeekday(existingDate) === candidateDayOfWeek;
    }

    return existingDay === candidateDayOfWeek;
  });
};
