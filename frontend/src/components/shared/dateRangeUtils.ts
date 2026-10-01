import { dateToDateKey, addCalendarDays } from '../../utils/dateTime';
export type DateRangeValue = { from: string; to: string };
export type DateRangePreset = 'today' | 'week' | 'month';
export const getDateRangePreset = (preset: DateRangePreset, referenceDate = new Date()): DateRangeValue => {
  const key = dateToDateKey(referenceDate);
  const date = new Date(key + 'T00:00:00Z');
  if (preset === 'week') {
    const from = addCalendarDays(key, -((date.getUTCDay() + 6) % 7));
    return { from, to: addCalendarDays(from, 6) };
  }
  if (preset === 'month') {
    const from = key.slice(0, 7) + '-01';
    date.setUTCMonth(date.getUTCMonth() + 1, 0);
    return { from, to: date.toISOString().slice(0, 10) };
  }
  return { from: key, to: key };
};
