import { PrismaClient, UserRole } from '@prisma/client';
import { RequestActionError } from './requestActionError';
import { parseManilaDate, manilaDateKey } from '../utils/manilaTime';

// New and edited requests must explicitly declare their intent. Legacy is history only.
export async function resolveRequestIntent(db: PrismaClient, body: Record<string, any>, role: UserRole, items: { equipmentId: string; quantity: number }[]) {
  const type = body.requestType;
  if (type !== 'LABORATORY' && type !== 'EQUIPMENT') throw new RequestActionError(400, 'Select laboratory reservation or equipment borrowing. Refresh the request form if necessary.');
  if (type === 'LABORATORY' && role !== UserRole.FACULTY) throw new RequestActionError(403, 'Only faculty can reserve a computer laboratory.');
  if (!body.dateNeeded || !body.timeStart || !body.timeEnd || !String(body.purpose || '').trim() || !body.facultyId) throw new RequestActionError(400, 'Date, time range, purpose and supervising faculty are required.');
  const start = parseManilaDate(body.timeStart), end = parseManilaDate(body.timeEnd);
  if (!start || !end || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) throw new RequestActionError(400, 'Choose a valid start and end time.');
  if (manilaDateKey(start) !== manilaDateKey(body.dateNeeded) || manilaDateKey(end) !== manilaDateKey(body.dateNeeded)) throw new RequestActionError(400, 'Start and end times must be on the requested date.');
  if (!await db.facultyProfile.findUnique({ where: { id: body.facultyId } })) throw new RequestActionError(400, 'Select a valid supervising faculty member.');
  if (type === 'LABORATORY') {
    const room = typeof body.roomId === 'string' ? await db.room.findUnique({ where: { id: body.roomId } }) : null;
    if (!room?.isComputerLab) throw new RequestActionError(400, 'Select a computer laboratory to reserve.');
    return { requestType: type, roomId: room.id, location: null, usageRoomId: null, usageLocation: null } as const;
  }
  if (!items.length) throw new RequestActionError(400, 'Select at least one equipment item.');
  if (body.roomId) throw new RequestActionError(400, 'Equipment borrowing cannot reserve a room. Use the intended usage location.');
  const usageRoomId = typeof body.usageRoomId === 'string' && body.usageRoomId ? body.usageRoomId : null;
  const usageLocation = typeof body.usageLocation === 'string' ? body.usageLocation.trim() : '';
  if (!usageRoomId && !usageLocation) throw new RequestActionError(400, 'An intended equipment usage location is required.');
  if (usageLocation.length > 500) throw new RequestActionError(400, 'Usage location must be at most 500 characters.');
  if (usageRoomId && !await db.room.findUnique({ where: { id: usageRoomId } })) throw new RequestActionError(400, 'Usage room does not exist.');
  return { requestType: type, roomId: null, location: null, usageRoomId, usageLocation: usageLocation || null } as const;
}
