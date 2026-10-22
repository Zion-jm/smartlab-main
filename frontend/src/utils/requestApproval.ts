import { dateToDateKey, parseManilaValue } from './dateTime';

export function requestApprovalNotice(request: { status: string; dateNeeded: string; timeStart?: string | null }, now = new Date()): string | null {
  if (request.status !== 'PENDING') return null;
  const day = dateToDateKey(request.dateNeeded);
  const today = dateToDateKey(now);
  const start = request.timeStart ? parseManilaValue(request.timeStart) : new Date(NaN);
  if (!day || !Number.isFinite(start.getTime())) return 'Approval unavailable: the request date or start time is missing or invalid.';
  if (day < today || (day === today && start.getTime() <= now.getTime())) return 'The requested date or start time has passed. This request can no longer be approved.';
  if (new Date(day + 'T00:00:00Z').getUTCDay() === 0) return 'Approval unavailable: requests cannot be scheduled on Sundays.';
  return null;
}
