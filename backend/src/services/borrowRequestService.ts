import { DomainError } from './domainError';
import { manilaDayBounds, parseManilaDate } from '../utils/manilaTime';
import { Prisma, RequestStatus, UserRole } from '@prisma/client';
import {
  borrowRequestInclude,
  type BorrowRequestWithRelations,
  type BorrowRequestOrder,
} from '../types/borrowRequest.types';

export { borrowRequestInclude };
export type { BorrowRequestWithRelations, BorrowRequestOrder };

// ─── State machine ────────────────────────────────────────────────────────────

export const STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  [RequestStatus.PENDING]: [RequestStatus.APPROVED, RequestStatus.REJECTED, RequestStatus.CANCELLED],
  [RequestStatus.APPROVED]: [RequestStatus.BORROWED, RequestStatus.REJECTED],
  [RequestStatus.REJECTED]: [],
  [RequestStatus.CANCELLED]: [],
  [RequestStatus.RETURNED]: [],
  [RequestStatus.BORROWED]: [RequestStatus.RETURNED, RequestStatus.CANCELLED],
};

export const ensureTransition = (current: RequestStatus, target: RequestStatus): void => {
  const allowed = STATUS_TRANSITIONS[current] ?? [];
  if (!allowed.includes(target)) {
    throw new DomainError(409, `Invalid status transition: ${current} → ${target}`);
  }
};

// ─── Sort mapping ─────────────────────────────────────────────────────────────

export const sortMapping: Record<string, BorrowRequestOrder> = {
  newest: { createdAt: 'desc' },
  oldest: { createdAt: 'asc' },
  'date-asc': { dateNeeded: 'asc' },
  'date-desc': { dateNeeded: 'desc' },
  'name-asc': [{ requester: { firstName: 'asc' } }, { requester: { lastName: 'asc' } }],
  'name-desc': [{ requester: { firstName: 'desc' } }, { requester: { lastName: 'desc' } }],
};

// ─── Data transformers ────────────────────────────────────────────────────────

export const formatLocation = (request: BorrowRequestWithRelations): string | null => {
  if (request.room) {
    const parts = [request.room.roomNumber, request.room.name].filter(Boolean);
    return parts.length ? parts.join(' • ') : null;
  }
  if (request.location) {
    return request.location;
  }
  return null;
};

export const summarizeRequest = (request: BorrowRequestWithRelations) => {
  const equipmentList = request.items
    .map((item) => item.equipment?.name)
    .filter(Boolean)
    .join(', ');

  const toIso = (value?: Date | null) => (value ? value.toISOString() : null);

  return {
    id: request.id,
    requesterId: request.requester.id,
    requesterName: `${request.requester.firstName} ${request.requester.lastName}`.trim(),
    requesterEmail: request.requester.email,
    requesterRole: request.requester.role,
    requesterAvatar: null,
    facultyId: request.faculty?.id ?? null,
    program: request.program?.name ?? null,
    programCode: request.program?.code ?? null,
    programId: request.program?.id ?? null,
    yearLevel: request.yearLevel,
    facultyName: request.faculty?.user
      ? `${request.faculty.user.firstName} ${request.faculty.user.lastName}`.trim()
      : null,
    location: formatLocation(request),
    roomId: request.room?.id ?? null,
    isComputerLab: request.room?.isComputerLab ?? null,
    room: request.room,
    subject: request.subject?.name ?? null,
    subjectId: request.subject?.id ?? null,
    equipmentList: equipmentList || null,
    dateNeeded: request.dateNeeded.toISOString(),
    timeStart: toIso(request.timeStart),
    timeEnd: toIso(request.timeEnd),
    purpose: request.purpose ?? null,
    notes: request.notes ?? null,
    status: request.status,
    rejectionNote: request.status === RequestStatus.REJECTED ? request.notes : null,
    createdAt: request.createdAt.toISOString(),
    approvedAt: toIso(request.approvedAt),
    borrowedAt: toIso(request.borrowedAt),
    returnedAt: toIso(request.returnedAt),
    cancelledAt: toIso(request.cancelledAt),
    declinedAt: toIso(request.declinedAt),
    academicYearId: request.academicYearId,
    termId: request.termId,
    items: request.items.map((item) => ({
      id: item.id,
      equipmentId: item.equipmentId,
      equipmentName: item.equipment?.name ?? 'Unknown equipment',
      quantity: item.quantity,
    })),
  };
};

export type RequestSummary = ReturnType<typeof summarizeRequest>;

export const buildEmailDetails = (summary: RequestSummary) => ({
  id: summary.id,
  requesterName: summary.requesterName,
  requesterRole: summary.requesterRole,
  programCode: summary.programCode,
  program: summary.program,
  yearLevel: summary.yearLevel,
  dateNeeded: summary.dateNeeded,
  timeStart: summary.timeStart,
  timeEnd: summary.timeEnd,
  location: summary.location,
  purpose: summary.purpose,
  items: summary.items.map((item) => ({ name: item.equipmentName, quantity: item.quantity })),
});

// ─── Filter builders ──────────────────────────────────────────────────────────

export const mapRoleFilter = (role?: string | null): UserRole | null => {
  if (!role || role === 'ALL') return null;
  if (role === 'FACULTY') return UserRole.FACULTY;
  if (role === 'STUDENT') return UserRole.STUDENT;
  if (role === 'ADMIN' || role === 'STAFF') return UserRole.ADMIN;
  return null;
};

export const buildBaseFilters = (params: {
  search?: string;
  role?: string | null;
  fromDate?: string;
  toDate?: string;
}): Prisma.BorrowRequestWhereInput[] => {
  const conditions: Prisma.BorrowRequestWhereInput[] = [];

  if (params.search) {
    const search = params.search.trim();
    if (search) {
      conditions.push({
        OR: [
          { id: { contains: search, mode: 'insensitive' } },
          { room: { name: { contains: search, mode: 'insensitive' } } },
          { room: { roomNumber: { contains: search, mode: 'insensitive' } } },
          { items: { some: { equipment: { name: { contains: search, mode: 'insensitive' } } } } },
          { requester: { firstName: { contains: search, mode: 'insensitive' } } },
          { requester: { lastName: { contains: search, mode: 'insensitive' } } },
          { requester: { email: { contains: search, mode: 'insensitive' } } },
          { purpose: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
  }

  const roleFilter = mapRoleFilter(params.role ?? null);
  if (roleFilter) {
    conditions.push({ requester: { role: roleFilter } });
  }

  if (params.fromDate) {
    const from = parseManilaDate(params.fromDate);
    if (!Number.isNaN(from.getTime())) {
      conditions.push({ dateNeeded: { gte: manilaDayBounds(from).start } });
    }
  }

  if (params.toDate) {
    const to = parseManilaDate(params.toDate);
    if (!Number.isNaN(to.getTime())) {
      conditions.push({ dateNeeded: { lt: manilaDayBounds(to).end } });
    }
  }

  return conditions;
};
