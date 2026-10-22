import { addCalendarDays, dateToDateKey, manilaTodayForPicker } from '../../utils/dateTime';
import type { ScheduleType } from '../../types/labSchedule';

export type ChartOutputOptions = {
  period: 'week' | 'month';
  lab: string;
  type: ScheduleType | 'ALL';
  action: 'print' | 'pdf' | 'csv';
};
export const outputWeeks = (period: ChartOutputOptions['period'], today = dateToDateKey(manilaTodayForPicker())) => {
  const first = period === 'month' ? `${today.slice(0, 7)}-01` : today;
  const day = new Date(`${first}T00:00:00Z`).getUTCDay();
  const monday = addCalendarDays(first, day === 0 ? -6 : 1 - day);
  const weeks = [monday];
  if (period === 'month') {
    for (let next = addCalendarDays(monday, 7); next.slice(0, 7) <= today.slice(0, 7); next = addCalendarDays(next, 7)) weeks.push(next);
  }
  return weeks;
};
