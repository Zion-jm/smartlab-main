import { ValidationError } from '../services/domainError';
export const MANILA_TIME_ZONE = 'Asia/Manila';
export const DAY_MS = 24 * 60 * 60 * 1000;
const OFFSET_MS = 8 * 60 * 60 * 1000;

export function validDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
}
// Legacy offset-free ISO input is explicitly Manila wall time, never host-local.
export function parseManilaDate(value: unknown): Date {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value !== 'string') return new Date(NaN);
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return validDateKey(text) ? new Date(text + 'T00:00:00+08:00') : new Date(NaN);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text) || !validDateKey(text.slice(0, 10))) return new Date(NaN);
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : text + '+08:00');
}
export function manilaDateKey(value: Date | string): string {
  const date = parseManilaDate(value);
  if (Number.isNaN(date.getTime())) throw new ValidationError('Invalid Manila date.');
  return new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}
export function manilaDayBounds(value: Date | string): { start: Date; end: Date } {
  const start = new Date(manilaDateKey(value) + 'T00:00:00+08:00');
  return { start, end: new Date(start.getTime() + DAY_MS) };
}
export const manilaWeekday = (value: Date | string): number => new Date(manilaDateKey(value) + 'T00:00:00Z').getUTCDay();
export const manilaMinutes = (value: Date): number => (value.getUTCHours() * 60 + value.getUTCMinutes() + 480) % 1440;
export const formatManilaDate = (value: Date | string): string => parseManilaDate(value).toLocaleDateString('en-PH', { timeZone: MANILA_TIME_ZONE, year: 'numeric', month: 'short', day: 'numeric' });
export const formatManilaTime = (value: Date | string): string => parseManilaDate(value).toLocaleTimeString('en-PH', { timeZone: MANILA_TIME_ZONE, hour: '2-digit', minute: '2-digit' });
