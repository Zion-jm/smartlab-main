import { prisma } from '../db/prisma';
import { ValidationError } from '../services/domainError';
import { sendError } from '../middleware/errors';
import { manilaDayBounds, parseManilaDate } from '../utils/manilaTime';
import { Router } from 'express';
import { Prisma, UserRole } from '@prisma/client';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { safeAuditDetails } from '../services/auditLogService';

const router = Router();


const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  ROLE_CHANGED: 'Role changed',
  STATUS_CHANGED: 'Status changed',
  DELETE: 'Deleted',
  APPROVE: 'Approved',
  REJECT: 'Rejected',
  BORROW: 'Marked borrowed',
  RETURN: 'Marked returned',
  CANCEL: 'Cancelled',
  ACTIVATE: 'Activated',
};

const ENTITY_LABELS: Record<string, string> = {
  User: 'User',
  Equipment: 'Equipment',
  LabSchedule: 'Lab schedule',
  BorrowRequest: 'Borrow request',
  AcademicDirectory: 'Academic directory',
  AcademicPeriod: 'Academic period',
  StudentAcademicRecord: 'Student academic record',
};

const toPositiveInt = (value: unknown, fallback: number, max: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
};

const parseDateFilter = (value: unknown, endOfDay = false): Date | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const raw = value.trim();
  const date = parseManilaDate(raw);
  if (Number.isNaN(date.getTime())) throw new ValidationError('Invalid date filter.');
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return endOfDay ? manilaDayBounds(date).end : manilaDayBounds(date).start;
  return date;
};

const readableSummary = (action: string, entityType: string, details: unknown, entityId: string): string => {
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    const record = details as Record<string, unknown>;
    const requestCode = entityType === 'BorrowRequest' ? 'REQ-' + entityId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-6).padStart(6, '0') : undefined;
    const label = [record.referenceCode ?? requestCode, record.context ?? record.label ?? record.name ?? record.reference].filter(value => typeof value === 'string' && value.trim()).join(' · ');
    if (typeof label === 'string' && label.trim()) {
      return `${ACTION_LABELS[action] ?? action} ${ENTITY_LABELS[entityType] ?? entityType}: ${label}`;
    }
  }
  const reference = entityType === 'BorrowRequest' ? 'REQ-' + entityId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-6).padStart(6, '0') : entityId;
  return `${ACTION_LABELS[action] ?? action} ${ENTITY_LABELS[entityType] ?? entityType}: ${reference}`;
};

router.get(
  '/',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    try {
      const page = toPositiveInt(req.query.page, 1, 100000);
      const pageSize = toPositiveInt(req.query.pageSize, 20, 100);
      const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 120) : '';
      const action = typeof req.query.action === 'string' ? req.query.action.trim().slice(0, 120) : '';
      const entityType = typeof req.query.entityType === 'string' ? req.query.entityType.trim().slice(0, 120) : '';
      const actorUserId = typeof req.query.actorUserId === 'string' ? req.query.actorUserId.trim().slice(0, 160) : '';
      const actor = typeof req.query.actor === 'string' ? req.query.actor.trim().slice(0, 120) : '';
      const from = parseDateFilter(req.query.from);
      const to = parseDateFilter(req.query.to, true);

      if (from && to && from >= to) {
        res.status(400).json({ error: 'The from date must be before the to date.' });
        return;
      }

      const where: Prisma.AuditLogWhereInput = {};
      if (action) where.action = action;
      if (entityType) where.entityType = entityType;
      if (actorUserId) where.actorUserId = actorUserId;
      if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) };
      if (search || actor) {
        const searchTerm = search || actor;
        const contains = (value: string): Prisma.StringFilter => ({ contains: value, mode: 'insensitive' });
        where.OR = [
          ...(search ? [
            { action: contains(search) },
            { entityType: contains(search) },
            { entityId: contains(search.replace(/^REQ-/i, '')) },
          ] : []),
          ...((search || actor) ? [{
            actor: {
              OR: [
                { firstName: contains(searchTerm) },
                { lastName: contains(searchTerm) },
                { email: contains(searchTerm) },
              ],
            },
          }] : []),
        ];
      }

      const [total, logs] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            actor: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        }),
      ]);

      res.json({
        logs: logs.map((log) => {
          const details = safeAuditDetails(log.details);
          return {
            id: log.id,
            actorUserId: log.actorUserId,
            actor: {
              id: log.actor.id,
              name: [log.actor.firstName, log.actor.lastName].filter(Boolean).join(' ') || log.actor.email,
              email: log.actor.email,
            },
            action: log.action,
            actionLabel: ACTION_LABELS[log.action] ?? log.action,
            entityType: log.entityType,
            entityLabel: ENTITY_LABELS[log.entityType] ?? log.entityType,
            entityId: log.entityId,
            recordReference: log.entityType === 'BorrowRequest' ? 'REQ-' + log.entityId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-6).padStart(6, '0') : (details && typeof details === 'object' && 'label' in details && typeof details.label === 'string' ? details.label : log.entityId),
            details,
            summary: readableSummary(log.action, log.entityType, details, log.entityId),
            createdAt: log.createdAt,
          };
        }),
        total,
        page,
        pageSize,
      });
    } catch (error) { sendError(error, res); }
  },
);

export default router;