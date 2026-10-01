import type { LabSchedule, ScheduleType } from '../../types/labSchedule';
import { dateKeyToPickerDate, dateToDateKey, dateToTimeString } from '../../utils/dateTime';


export const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const scheduleTypeLabel: Record<ScheduleType, string> = {
  ONE_TIME: 'One-time',
  WEEKLY: 'Weekly',
};

export const chartDayOrder = [1, 2, 3, 4, 5, 6];

export const chartMinuteStart = 7 * 60;

export const chartMinuteEnd = 21 * 60;

export const chartSlotMinutes = 30;

export const chartTotalMinutes = chartMinuteEnd - chartMinuteStart;

export const chartRowHeight = 28;

export const formatClockLabel = (minutes: number) => {
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, '0')} ${period}`;
};

export const minutesFromIso = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const [hours, minutes] = dateToTimeString(date).split(':').map(Number);
  return hours * 60 + minutes;
};

export const clampMinutes = (value: number | null, min: number, max: number) => {
  if (typeof value !== 'number') return null;
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

export const chartHourMarks = Array.from(
  { length: Math.floor((chartMinuteEnd - chartMinuteStart) / 60) + 1 },
  (_, index) => chartMinuteStart + index * 60
);

export const chartSlotPercents = Array.from(
  { length: Math.floor((chartMinuteEnd - chartMinuteStart) / chartSlotMinutes) + 1 },
  (_, index) => ((index * chartSlotMinutes) / chartTotalMinutes) * 100
);

export const calendarColors = ['#800000', '#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#ea580c'];

export const sameDay = (first: Date, second: Date) =>
  first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();

export const occursOnDate = (schedule: LabSchedule, date: Date) => {
  if (schedule.scheduleType === 'WEEKLY') {
    if (typeof schedule.dayOfWeekIndex === 'number') {
      return schedule.dayOfWeekIndex === date.getDay();
    }
    return false;
  }
  if (!schedule.date) return false;
  const scheduleDate = dateKeyToPickerDate(dateToDateKey(schedule.date));
  if (!scheduleDate || Number.isNaN(scheduleDate.getTime())) return false;
  return sameDay(scheduleDate, date);
};

export const getMonthLabel = (reference: Date) =>
  reference.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
