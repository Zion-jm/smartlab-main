import { Prisma, PrismaClient } from '@prisma/client';

type AuditClient = PrismaClient | Prisma.TransactionClient;

export type AuditLogInput = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: unknown;
};

const SENSITIVE_KEY = /(password|token|secret|credential|authorization|cookie|smtp|database_url|jwt)/i;
const MAX_STRING_LENGTH = 1000;
const MAX_DEPTH = 5;

const redactAuditValue = (value: unknown, depth = 0): unknown => {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redactAuditValue(item, depth + 1) ?? null);
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
      result[key] = SENSITIVE_KEY.test(key)
        ? '[redacted]'
        : redactAuditValue(nestedValue, depth + 1) ?? null;
    }
    return result;
  }
  return String(value).slice(0, MAX_STRING_LENGTH);
};

export const safeAuditDetails = (details: unknown): unknown =>
  redactAuditValue(details);

/** Best-effort descriptive events only; critical events use recordRequiredAuditLog. */
export const recordOptionalAuditLog = async (
  client: AuditClient,
  input: AuditLogInput,
): Promise<void> => {
  try {
    await client.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action.slice(0, 120),
        entityType: input.entityType.slice(0, 120),
        entityId: input.entityId.slice(0, 160),
        details: safeAuditDetails(input.details) as Prisma.InputJsonValue | Prisma.NullTypes.JsonNull | undefined,
      },
    });
  } catch (error) {
    console.error('Optional audit log write failed');
  }
};

// Capture display context in the same transaction; later directory edits must not rewrite history.
const auditDetailsWithContext = async (client: Prisma.TransactionClient, input: AuditLogInput) => {
  const details = input.details && typeof input.details === 'object' && !Array.isArray(input.details) ? input.details as Record<string, unknown> : {};
  if (input.entityType === 'BorrowRequest') {
    const request = await client.borrowRequest.findUnique({ where: { id: input.entityId }, select: {
      dateNeeded: true, location: true, usageLocation: true,
      requester: { select: { firstName: true, lastName: true } },
      room: { select: { roomNumber: true, name: true } }, usageRoom: { select: { roomNumber: true, name: true } },
    } });
    const room = request?.room ?? request?.usageRoom;
    return { ...details, referenceCode: 'REQ-' + input.entityId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-6).padStart(6, '0'),
      ...(request ? { context: [ [room?.roomNumber, room?.name].filter(Boolean).join(' – ') || request.usageLocation || request.location,
        request.dateNeeded.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }),
        [request.requester.firstName, request.requester.lastName].filter(Boolean).join(' ') ].filter(Boolean).join(' · ') } : {}) };
  }
  if (input.entityType === 'LabSchedule') {
    const schedule = await client.labSchedule.findUnique({ where: { id: input.entityId }, select: {
      scheduleDate: true, dayOfWeek: true, room: { select: { roomNumber: true, name: true } },
      faculty: { select: { user: { select: { firstName: true, lastName: true } } } },
    } });
    if (schedule) return { ...details, context: [ [schedule.room?.roomNumber, schedule.room?.name].filter(Boolean).join(' – '),
      schedule.scheduleDate ? schedule.scheduleDate.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }) : ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][schedule.dayOfWeek],
      [schedule.faculty.user.firstName, schedule.faculty.user.lastName].filter(Boolean).join(' ') ].filter(Boolean).join(' · ') };
  }
  return input.details;
};

/** Required business audit: caller must supply its transaction; failures propagate. */
export const recordRequiredAuditLog = async (client: Prisma.TransactionClient, input: AuditLogInput): Promise<void> => {
  const details = await auditDetailsWithContext(client, input);
  await client.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action.slice(0, 120),
      entityType: input.entityType.slice(0, 120),
      entityId: input.entityId.slice(0, 160),
      details: safeAuditDetails(details) as Prisma.InputJsonValue | Prisma.NullTypes.JsonNull | undefined,
    },
  });
};
