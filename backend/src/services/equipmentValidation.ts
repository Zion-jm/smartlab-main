import { Prisma } from '@prisma/client';
import { RequestActionError } from './requestActionError';

export function equipmentText(value: unknown, label: string, max: number, required = false): string | null {
  if ((value === null || value === undefined) && !required) return null;
  if (typeof value !== 'string') throw new RequestActionError(400, label + ' must be text.');
  const text = value.replace(/\s+/g, ' ').trim();
  if (required && !text) throw new RequestActionError(400, label + ' is required.');
  if (text.length > max) throw new RequestActionError(400, label + ' must be at most ' + max + ' characters.');
  return text || null;
}

export async function assertEquipmentName(tx: Prisma.TransactionClient, name: string, id = '') {
  const matches = await tx.$queryRaw<{id: string}[]>`
    SELECT id FROM equipment WHERE lower(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g')))
      = lower(btrim(regexp_replace(${name}, '[[:space:]]+', ' ', 'g'))) AND id <> ${id} LIMIT 1
  `;
  if (matches.length) throw new RequestActionError(409, 'Equipment with this name already exists, including archived equipment. Use a distinct name for a different model or variant.');
}

export function assertEquipmentVersion(value: unknown, updatedAt: Date) {
  if (typeof value !== 'string' || !value || !Number.isFinite(Date.parse(value)))
    throw new RequestActionError(409, 'Refresh the equipment record before saving.');
  if (new Date(value).getTime() !== updatedAt.getTime())
    throw new RequestActionError(409, 'Equipment changed since you opened it. Refresh the equipment list and reopen the editor before saving.');
}
