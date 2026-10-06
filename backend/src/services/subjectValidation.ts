import { PrismaClient } from '@prisma/client';
import { RequestActionError } from './requestActionError';
export const normalizeSubjectText = (value: unknown): string => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
export async function validateSubject(db: PrismaClient, code: string, name: string, excludeId = '') {
  if (!code || !name) throw new RequestActionError(400, 'Subject code and name are required.');
  const matches = await db.$queryRaw<{ field: string }[]>`
    SELECT 'code' AS field FROM subjects WHERE id <> ${excludeId}
      AND lower(btrim(regexp_replace(code, '[[:space:]]+', ' ', 'g'))) = lower(${code})
    UNION ALL
    SELECT 'name' AS field FROM subjects WHERE id <> ${excludeId}
      AND lower(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g'))) = lower(${name})`;
  if (matches.some(row => row.field === 'code')) throw new RequestActionError(409, 'This subject code already exists.');
  if (matches.length) throw new RequestActionError(409, 'This subject name already exists.');
}
