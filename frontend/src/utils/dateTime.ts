export const MANILA_TIME_ZONE = 'Asia/Manila';

export const validDateKey = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;

export const parseManilaValue = (value: string | Date): Date => {
  if (value instanceof Date) return new Date(value.getTime());
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return validDateKey(text) ? new Date(text + 'T00:00:00+08:00') : new Date(NaN);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text) || !validDateKey(text.slice(0, 10))) return new Date(NaN);
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : text + '+08:00');
};

export const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  const date = parseManilaValue(value);
  return date.toLocaleDateString('en-US', { timeZone: MANILA_TIME_ZONE, month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatTimeRange = (start?: string | null, end?: string | null): string => {
  if (!start) return '—';
  const fmt = (time: string) =>
    parseManilaValue(time).toLocaleTimeString('en-US', { timeZone: MANILA_TIME_ZONE, hour: 'numeric', minute: '2-digit' });
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
};

export const extractTimeString = (dateTimeString?: string | null): string => {
  if (!dateTimeString) return '';
  return dateToTimeString(dateTimeString);
};

const getDateParts = (value: string | Date, timeZone: string) => {
  const date = parseManilaValue(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((parts, part) => {
      parts[part.type] = part.value;
      return parts;
    }, {});
};

export const dateToDateKey = (value: string | Date | null | undefined, timeZone = 'Asia/Manila'): string => {
  if (!value) return '';
  const parts = getDateParts(value, timeZone);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : '';
};

export const dateToTimeString = (value: string | Date | null | undefined, timeZone = 'Asia/Manila'): string => {
  if (!value) return '';
  const parts = getDateParts(value, timeZone);
  return parts ? `${parts.hour}:${parts.minute}` : '';
};

export const dateToWeekdayIndex = (value: string | Date | null | undefined, timeZone = 'Asia/Manila'): number | null => {
  if (!value) return null;
  const parts = getDateParts(value, timeZone);
  if (!parts?.weekday) return null;
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const index = weekdays.indexOf(parts.weekday);
  return index >= 0 ? index : null;
};

export const combineManilaDateTime = (date: string | null, time?: string | null): string | null => {
  const day = date || '1970-01-01';
  if (!validDateKey(day) || !time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  return new Date(day + 'T' + time + ':00+08:00').toISOString();
};

export const addCalendarDays = (key: string, days: number): string => {
  if (!validDateKey(key)) return '';
  const date = new Date(key + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

// React date pickers/calendar grids use local Date fields as a date-only adapter.
// Never serialize these adapters as UTC instants; serialize their displayed fields.
export const dateKeyToPickerDate = (key: string): Date | null => {
  if (!validDateKey(key)) return null;
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};
export const pickerDateToDateKey = (date: Date | null): string => date && !Number.isNaN(date.getTime())
  ? String(date.getFullYear()).padStart(4, '0') + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0') : '';
export const manilaTodayForPicker = (now = new Date()): Date => dateKeyToPickerDate(dateToDateKey(now))!;
export const nextManilaWeekday = (dayIndex: number, now = new Date()): string | null => {
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) return null;
  const today = dateToDateKey(now);
  const current = new Date(today + 'T00:00:00Z').getUTCDay();
  return addCalendarDays(today, (dayIndex - current + 7) % 7 || 7);
};
