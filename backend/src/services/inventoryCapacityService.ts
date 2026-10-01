import { Prisma, Equipment, RequestStatus, EquipmentStatus } from '@prisma/client';
import { manilaDayBounds, manilaMinutes } from '../utils/manilaTime';
import { RequestActionError } from './requestActionError';

export const BLOCKED_EQUIPMENT_STATUSES: EquipmentStatus[] = [EquipmentStatus.UNAVAILABLE, EquipmentStatus.DAMAGED];
export const MAX_QUANTITY = 2147483647; // PostgreSQL Int storage limit.
export type EquipmentLine = { equipmentId: string; quantity: number };
export type CapacityWindow = { dateNeeded: Date; timeStart: Date | null; timeEnd: Date | null };
export function validateRequestItems(value: unknown): EquipmentLine[] {
  if (!Array.isArray(value)) throw new RequestActionError(400, 'Equipment selections must be an array.');
  const ids = new Set<string>();
  return value.map(item => {
    if (!item || typeof item.equipmentId !== 'string' || !item.equipmentId.trim() ||
        typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) {
      throw new RequestActionError(400, 'Each equipment selection needs an ID and a whole-number quantity from 1 to 2147483647.');
    }
    if (ids.has(item.equipmentId)) throw new RequestActionError(400, 'Duplicate equipment selections are not allowed.');
    ids.add(item.equipmentId);
    return { equipmentId: item.equipmentId, quantity: item.quantity };
  });
}
export function physicalCapacity(stock: Pick<Equipment, 'status' | 'availableQuantity' | 'retiredAt'>): number {
  return stock.retiredAt || BLOCKED_EQUIPMENT_STATUSES.includes(stock.status) ? 0 : stock.availableQuantity;
}
export function timeWindow(window: Pick<CapacityWindow, 'timeStart' | 'timeEnd'>): [number, number] {
  const start = window.timeStart ? manilaMinutes(window.timeStart) : 0;
  const end = window.timeEnd ? manilaMinutes(window.timeEnd) : 1440;
  if (!!window.timeStart !== !!window.timeEnd || !Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    throw new RequestActionError(400, 'A valid same-day time range is required.');
  return [start, end];
}
type Reservation = Pick<CapacityWindow, 'timeStart' | 'timeEnd'> & { items: EquipmentLine[] };
export function overlaps(a: Reservation | CapacityWindow, b: Reservation | CapacityWindow): boolean {
  const [aStart, aEnd] = timeWindow(a), [bStart, bEnd] = timeWindow(b);
  return aStart < bEnd && bStart < aEnd;
}
export function peakReserved(reservations: Reservation[], equipmentId: string, window: Pick<CapacityWindow, 'timeStart' | 'timeEnd'>): number {
  const [start, end] = timeWindow(window);
  const events: [number, number][] = [];
  for (const reservation of reservations) {
    const lines = reservation.items.filter(item => item.equipmentId === equipmentId);
    if (!lines.length) continue;
    const [rs, re] = timeWindow(reservation);
    const from = Math.max(start, rs), to = Math.min(end, re);
    for (const line of lines) {
      if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY)
        throw new RequestActionError(409, 'An existing reservation requires inventory review.');
      if (from < to) events.push([from, line.quantity], [to, -line.quantity]);
    }
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let used = 0, peak = 0;
  for (const [, delta] of events) { used += delta; peak = Math.max(peak, used); }
  return peak;
}
export async function loadCapacity(tx: Prisma.TransactionClient, window: CapacityWindow, ids?: string[], excludeRequestId?: string, includePending = false) {
  timeWindow(window);
  const { start, end } = manilaDayBounds(window.dateNeeded);
  const equipment = await tx.equipment.findMany({ where: ids ? { id: { in: ids } } : {}, orderBy: { name: 'asc' } });
  // Stock is shared across academic periods. Outstanding loans and damage are
  // already subtracted from availableQuantity. Pending requests are advisory.
  const reservations = await tx.borrowRequest.findMany({ where: {
    status: { in: includePending ? [RequestStatus.APPROVED, RequestStatus.PENDING] : [RequestStatus.APPROVED] },
    dateNeeded: { gte: start, lt: end },
    ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
    ...(ids ? { items: { some: { equipmentId: { in: ids } } } } : {}),
  }, include: { items: true, requester: { select: { firstName: true, lastName: true, email: true } } } });
  const overlapping = reservations.filter(r => overlaps(r, window));
  const approved = overlapping.filter(r => r.status === RequestStatus.APPROVED);
  const entries = equipment.map(stock => {
    const reserved = peakReserved(approved, stock.id, window);
    return { stock, reserved, available: Math.max(0, physicalCapacity(stock) - reserved) };
  });
  return { entries, reservations: overlapping };
}
export async function assertEquipmentCapacity(tx: Prisma.TransactionClient, request: CapacityWindow & { id: string; items: EquipmentLine[] }) {
  const items = validateRequestItems(request.items);
  const { entries } = await loadCapacity(tx, request, items.map(i => i.equipmentId), request.id);
  for (const item of items) {
    const entry = entries.find(e => e.stock.id === item.equipmentId);
    if (!entry || entry.available < item.quantity) throw new RequestActionError(409, 'Equipment capacity is unavailable or already reserved for this time.');
  }
}
// Equipment edits must not invalidate any outstanding approved reservation.
export async function assertStockSupportsReservations(tx: Prisma.TransactionClient, stock: Equipment) {
  const reservations = await tx.borrowRequest.findMany({ where: { status: RequestStatus.APPROVED, items: { some: { equipmentId: stock.id } } }, include: { items: true } });
  const days = new Map<number, typeof reservations>();
  for (const r of reservations) { const day = manilaDayBounds(r.dateNeeded).start.getTime(); days.set(day, [...(days.get(day) ?? []), r]); }
  for (const day of days.values()) {
    if (peakReserved(day, stock.id, { timeStart: null, timeEnd: null }) > physicalCapacity(stock))
      throw new RequestActionError(409, 'This stock change would invalidate approved reservations. Resolve those reservations first.');
  }
}
