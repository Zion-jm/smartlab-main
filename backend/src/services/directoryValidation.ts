import { Prisma, PrismaClient } from '@prisma/client';
import { RequestActionError } from './requestActionError';
import { recordRequiredAuditLog } from './auditLogService';
import { inventoryTransaction } from './inventoryTransaction';
import { manilaDayBounds } from '../utils/manilaTime';
export type DirectoryEntity = 'buildings' | 'departments' | 'programs' | 'subjects' | 'rooms';
const labels = {buildings:'Building', departments:'Department', programs:'Program', subjects:'Subject', rooms:'Room'};
export function directoryText(value: unknown, label: string, max: number, required = false): string {
  if (value != null && typeof value !== 'string') throw new RequestActionError(400, label + ' must be text.');
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (required && !text) throw new RequestActionError(400, label + ' is required.');
  if (text.length > max) throw new RequestActionError(400, label + ' must be at most ' + max + ' characters.');
  return text;
}
const normalized = (field: string) => Prisma.sql`lower(btrim(regexp_replace(${Prisma.raw('"'+field+'"')}, '[[:space:]]+', ' ', 'g')))`;
async function duplicates(tx: Prisma.TransactionClient, entity: DirectoryEntity, field: string, value: string, id: string, scope = Prisma.sql`TRUE`) {
  return tx.$queryRaw<{id:string}[]>(Prisma.sql`SELECT id FROM ${Prisma.raw('"'+entity+'"')} WHERE id <> ${id} AND ${normalized(field)} = lower(${value}) AND ${scope} LIMIT 1`);
}
export async function saveDirectory(db: PrismaClient, entity: DirectoryEntity, body: Record<string, unknown>, actorId: string, id = '') {
  const label = labels[entity];
  const data: Record<string, string | boolean | null> = {};
  if (entity === 'rooms') {
    data.roomNumber = directoryText(body.roomNumber, 'Room number', 20) || null;
    data.name = directoryText(body.roomName, 'Room name', 150) || null;
    data.buildingId = directoryText(body.buildingId, 'Building', 100) || null;
    if (!data.roomNumber && !data.name) throw new RequestActionError(400, 'Room number or room name is required.');
    if (typeof body.isComputerLab !== 'boolean') throw new RequestActionError(400, 'Computer laboratory classification must be true or false.');
    data.isComputerLab = body.isComputerLab;
  } else {
    data.name = directoryText(body.name, label + ' name', 150, true);
    if (entity === 'programs' || entity === 'subjects') data.code = directoryText(directoryText(body.code, label + ' code', 20, true).toUpperCase(), label + ' code', 20, true);
  }
  try {
    return await inventoryTransaction(db, async tx => {
      // Fixed internal model names only; HTTP input never selects a SQL identifier.
      const model = {buildings:tx.building, departments:tx.department, programs:tx.program, subjects:tx.subject, rooms:tx.room}[entity] as any;
      const before = id ? await model.findUnique({where:{id}}) : null;
      if (id && !before) throw new RequestActionError(404, label + ' not found.');
      const warnings: string[] = [];
      if (entity === 'rooms') {
        if (data.buildingId && !await tx.building.findUnique({where:{id:String(data.buildingId)}})) throw new RequestActionError(400, 'Selected building does not exist.');
        const scope = data.buildingId ? Prisma.sql`"buildingId" = ${data.buildingId}` : Prisma.sql`"buildingId" IS NULL`;
        for (const field of ['roomNumber', 'name']) {
          if (!data[field]) continue;
          const matches = await duplicates(tx, entity, field, String(data[field]), id, scope);
          if (matches.length) throw new RequestActionError(409, 'This room ' + (field === 'name' ? 'name' : 'number') + ' already exists ' + (data.buildingId ? 'in the selected building.' : 'among rooms without a building.'));
        }
        if (before?.isComputerLab && !data.isComputerLab) {
          const today = manilaDayBounds(new Date()).start;
          const schedules = await tx.labSchedule.count({where:{roomId:id,OR:[{scheduleType:'ONE_TIME',scheduleDate:{gte:today}},{scheduleType:'WEEKLY',academicYear:{isActive:true},term:{isActive:true}}]}});
          const requests = await tx.borrowRequest.count({where:{roomId:id,requestType:{not:'EQUIPMENT'},status:{in:['PENDING','APPROVED','BORROWED']},dateNeeded:{gte:today}}});
          if (schedules || requests) throw new RequestActionError(409, 'This laboratory has active or future schedules or requests. Resolve them before changing its classification.');
        }
      } else {
        for (const field of ['code','name']) if (data[field] && (await duplicates(tx,entity,field,String(data[field]),id)).length) throw new RequestActionError(409, 'This ' + label.toLowerCase() + ' ' + field + ' already exists.');
      }
      const saved = id ? await model.update({where:{id},data}) : await model.create({data});
      const snapshot = (row: any) => row ? Object.fromEntries(Object.keys(data).map(key=>[key,row[key]])) : null;
      await recordRequiredAuditLog(tx,{actorUserId:actorId,action:id?'UPDATE':'CREATE',entityType:'AcademicDirectory',entityId:saved.id,details:{recordType:label,before:snapshot(before),after:snapshot(saved)}});
      if (entity === 'rooms') {
        const building = saved.buildingId ? await tx.building.findUnique({where:{id:saved.buildingId}}) : null;
        return {id:saved.id,roomNumber:saved.roomNumber,roomName:saved.name,buildingId:saved.buildingId,buildingName:building?.name ?? null,isComputerLab:saved.isComputerLab,warnings};
      }
      return {id:saved.id,name:saved.name,...(data.code ? {code:saved.code} : {}),warnings};
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = JSON.stringify(error.meta?.target ?? '');
      const field = /code/i.test(target) ? 'code' : /name/i.test(target) ? 'name' : entity === 'rooms' ? 'number or name' : 'code or name';
      throw new RequestActionError(409, 'This ' + label.toLowerCase() + ' ' + field + ' already exists' + (entity === 'rooms' ? (data.buildingId ? ' in the selected building.' : ' among rooms without a building.') : '.'));
    }
    throw error;
  }
}
