import type { ApiLabSchedule, LabSchedule } from '../../types/labSchedule';
import { dateToWeekdayIndex, formatTimeRange } from '../../utils/dateTime';
import { dayNames } from './scheduleViewUtils';

export const normalizeSchedule = (schedule: ApiLabSchedule & { borrowRequest?: { id: string } | null; _meta?: { canChangeScheduleType: boolean; isRequestDerived: boolean; lockReason: string | null } | null }, labels: readonly string[] = dayNames): LabSchedule => {
  const dateValue = schedule.scheduleDate ? new Date(schedule.scheduleDate) : null;
  const isWeekly = schedule.scheduleType === 'WEEKLY';
  const displayDate = isWeekly
    ? 'Every week'
    : dateValue
        ? dateValue.toLocaleDateString(undefined, { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })
        : '—';
  const weekdayIndex = schedule.dayOfWeek ?? (dateValue ? dateToWeekdayIndex(dateValue) : null);
  const displayDay = typeof weekdayIndex === 'number' ? labels[weekdayIndex] : '—';
  const dayOfWeekIndex = typeof weekdayIndex === 'number' ? weekdayIndex : null;
  const roomLabel = schedule.room?.name || schedule.room?.roomNumber || 'Unassigned lab';
  const isComputerLab = Boolean(schedule.room?.isComputerLab);
  const facultyName = `${schedule.faculty?.user?.firstName ?? ''} ${schedule.faculty?.user?.lastName ?? ''}`.trim() || 'Unassigned';
  const subjectLabel = schedule.subject?.name || schedule.subject?.code || 'Lab Session';
  const programBase = schedule.program?.code || schedule.program?.name || '—';
  const programLabel = schedule.yearLevel ? `${programBase} - ${schedule.yearLevel}` : programBase;
  const academicYearLabel = schedule.academicYear?.year ?? null;
  const termLabel = schedule.term?.name ?? null;

  return {
    id: schedule.id,
    scheduleType: schedule.scheduleType,
    date: schedule.scheduleDate,
    startTime: schedule.timeStart,
    endTime: schedule.timeEnd,
    displayDate,
    displayDay,
    dayOfWeekIndex,
    timeRange: formatTimeRange(schedule.timeStart, schedule.timeEnd),
    roomLabel,
    isComputerLab,
    facultyName,
    subjectLabel,
    programLabel,
    yearLevel: schedule.yearLevel ?? null,
    academicYearLabel,
    termLabel,
    borrowRequest: schedule.borrowRequest ?? undefined,
    _meta: schedule._meta ?? undefined,
  };
};
