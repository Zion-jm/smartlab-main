import { prisma } from '../db/prisma';
import { assertRequestVisible } from '../services/requestVisibility';
import { sendError } from '../middleware/errors';
import { Router, Response } from 'express';
import { UserRole } from '@prisma/client';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { manilaDateKey, parseManilaDate } from '../utils/manilaTime';
import { dateToTimeString, getTimeBlocks } from '../utils/timeBlocks';
import { loadCapacity, validateRequestItems, timeWindow } from '../services/inventoryCapacityService';
import { RequestActionError } from '../services/requestActionError';

const router = Router();

const roles = authorizeRoles(UserRole.ADMIN, UserRole.FACULTY, UserRole.STUDENT);
function parseInput(input: Record<string, unknown>) {
  for (const key of ['academicYearId', 'termId', 'date', 'timeStart', 'timeEnd'])
    if (typeof input[key] !== 'string' || !input[key]) throw new RequestActionError(400, 'Academic period, date and time range are required.');
  if (input.excludeRequestId != null && typeof input.excludeRequestId !== 'string') throw new RequestActionError(400, 'Invalid excluded request ID.');
  const { academicYearId, termId, date, timeStart, timeEnd } = input as Record<string, string>;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeStart) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeEnd)) throw new RequestActionError(400, 'Use HH:mm for a same-day time range.');
  const dateNeeded = parseManilaDate(date), key = manilaDateKey(dateNeeded);
  const window = { dateNeeded, timeStart: parseManilaDate(key + 'T' + timeStart + ':00+08:00'), timeEnd: parseManilaDate(key + 'T' + timeEnd + ':00+08:00') };
  timeWindow(window);
  return { window, exclude: input.excludeRequestId as string | undefined, requestInfo: { academicYearId, termId, date, timeStart, timeEnd, timeBlocks: getTimeBlocks(timeStart, timeEnd) } };
}
function fail(error: unknown, res: Response) { sendError(error, res); }
type Snapshot = Awaited<ReturnType<typeof loadCapacity>>;
function details(snapshot: Snapshot, id: string, role: UserRole) {
  return snapshot.reservations.flatMap((r, index) => r.items.filter(i => i.equipmentId === id).map(i => ({
    requestId: role === UserRole.ADMIN ? r.id : 'reservation-' + index,
    redacted: role !== UserRole.ADMIN,
    requesterName: role === UserRole.ADMIN ? r.requester.firstName + ' ' + r.requester.lastName : 'Reserved',
    ...(role === UserRole.ADMIN ? { requesterEmail: r.requester.email, purpose: r.purpose } : {}), quantity: i.quantity,
    timeStart: r.timeStart ? dateToTimeString(r.timeStart) : '00:00', timeEnd: r.timeEnd ? dateToTimeString(r.timeEnd) : '24:00',
    status: r.status,
  })));
}
router.post('/conflicts', authenticateToken, roles, async (req, res) => {
  try {
    const { window, exclude, requestInfo } = parseInput(req.body);
    const raw = req.body.equipment ?? [];
    if (!Array.isArray(raw)) throw new RequestActionError(400, 'Equipment selections must be an array.');
    const items = validateRequestItems(raw.map(item => ({ equipmentId: item?.equipmentId, quantity: item?.requestedQuantity === 0 ? 1 : item?.requestedQuantity })))
      .map((item, index) => ({ ...item, quantity: raw[index].requestedQuantity as number })); // Zero is a read-only reservation lookup, never a saved loan.
    await assertRequestVisible(prisma, req.user!, exclude);
    const snapshot = await prisma.$transaction(tx => loadCapacity(tx, window, items.map(i => i.equipmentId), exclude, true), { isolationLevel: 'RepeatableRead' });
    const availability: Record<string, { available: number; total: number; percentage: number }> = {};
    const conflicts = items.flatMap(item => {
      const entry = snapshot.entries.find(e => e.stock.id === item.equipmentId);
      const available = entry?.available ?? 0, total = entry?.stock.totalQuantity ?? 0;
      availability[item.equipmentId] = { available, total, percentage: total ? available / total * 100 : 0 };
      const conflictingRequests = details(snapshot, item.equipmentId, req.user!.role), shortage = Math.max(0, item.quantity - available);
      return shortage || conflictingRequests.length ? [{ equipmentId: item.equipmentId, equipmentName: entry?.stock.name ?? 'Unknown Equipment', requestedQuantity: item.quantity, availableQuantity: available, totalQuantity: total, shortage, conflictingRequests }] : [];
    });
    res.json({ success: true, data: { requestInfo, conflicts, availability, summary: { hasConflicts: conflicts.length > 0, totalConflicts: conflicts.length, conflictingRequestsCount: snapshot.reservations.length, timeRange: requestInfo.timeStart + ' - ' + requestInfo.timeEnd } } });
  } catch (error) { fail(error, res); }
});
router.get('/availability', authenticateToken, roles, async (req, res) => {
  try {
    const { window, exclude, requestInfo } = parseInput(req.query);
    const snapshot = await prisma.$transaction(tx => loadCapacity(tx, window, undefined, exclude, true), { isolationLevel: 'RepeatableRead' });
    const availability = snapshot.entries.map(({ stock, reserved, available }) => {
      const percentage = stock.totalQuantity ? available / stock.totalQuantity * 100 : 0;
      return {
        id: stock.id, name: stock.name, equipmentStatus: stock.status, total: stock.totalQuantity, available, used: reserved, percentage,
        status: available === 0 ? 'unavailable' : percentage < 30 ? 'critical' : percentage < 70 ? 'limited' : 'available',
        reservations: details(snapshot, stock.id, req.user!.role).map(({ requesterName, requesterEmail, ...r }) => ({ ...r, facultyName: requesterName })),
      };
    }).sort((a, b) => a.percentage - b.percentage);
    res.json({
      success: true, data: {
        requestInfo, availability, summary: {
          totalEquipment: availability.length, availableEquipment: availability.filter(e => e.status === 'available').length,
          limitedEquipment: availability.filter(e => e.status === 'limited').length, criticalEquipment: availability.filter(e => e.status === 'critical').length,
          unavailableEquipment: availability.filter(e => e.status === 'unavailable').length, totalConflictingRequests: snapshot.reservations.length,
        }
      }
    });
  } catch (error) { fail(error, res); }
});
export default router;
