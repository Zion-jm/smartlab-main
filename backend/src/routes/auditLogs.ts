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
  REJECT: 'Declined',
  BORROW: 'Marked borrowed',
  RETURN: 'Marked returned',
  CANCEL: 'Cancelled',
  ACTIVATE: 'Activated',
  RESTORE: 'Restored',
  RETIRE: 'Retired',
  SESSIONS_REVOKED: 'Sessions revoked',
  REACTIVATION_REQUESTED: 'Reactivation requested',
  PASSWORD_CHANGED: 'Password changed',
  PASSWORD_RESET_REQUESTED: 'Password reset requested',
  PASSWORD_RESET_COMPLETED: 'Password reset completed',
  ADJUST: 'Adjusted',
  ADJUSTMENT_RESPONSE: 'Adjustment response recorded',
};

const ENTITY_LABELS: Record<string, string> = {
  User: 'User',
  Equipment: 'Equipment',
  LabSchedule: 'Lab schedule',
  BorrowRequest: 'Request / reservation',
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

      const userIds = logs.filter(log => log.entityType === 'User').map(log => log.entityId);
      const requestIds = logs.filter(log => log.entityType === 'BorrowRequest').map(log => log.entityId);
      const scheduleIds = logs.filter(log => log.entityType === 'LabSchedule').map(log => log.entityId);
      const [referencedUsers, requests, schedules] = await Promise.all([
        userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true, email: true } }) : [],
        requestIds.length ? prisma.borrowRequest.findMany({ where: { id: { in: requestIds } }, select: { id: true, requestType: true } }) : [],
        scheduleIds.length ? prisma.labSchedule.findMany({ where: { id: { in: scheduleIds } }, select: {
          id: true, scheduleDate: true, dayOfWeek: true, timeStart: true, timeEnd: true,
          room: { select: { roomNumber: true, name: true } },
        } }) : [],
      ]);
      const usersById = new Map(referencedUsers.map(user => [user.id, user]));
      const requestsById = new Map(requests.map(request => [request.id, request]));
      const schedulesById = new Map(schedules.map(schedule => [schedule.id, schedule]));
      const formatDate = (date: Date) => date.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' });
      const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });

      res.json({
        logs: logs.map((log) => {
          const storedDetails = safeAuditDetails(log.details);
          const details = storedDetails && typeof storedDetails === 'object' && !Array.isArray(storedDetails)
            ? storedDetails as Record<string, unknown>
            : {};
          const referencedUser = usersById.get(log.entityId);
          const request = requestsById.get(log.entityId);
          const schedule = schedulesById.get(log.entityId);
          const userReference = referencedUser
            ? [referencedUser.firstName, referencedUser.lastName].filter(Boolean).join(' ') || referencedUser.email
            : undefined;
          const scheduleReference = schedule ? [
            [schedule.room?.roomNumber, schedule.room?.name].filter(Boolean).join(' – '),
            schedule.scheduleDate ? formatDate(schedule.scheduleDate) : ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][schedule.dayOfWeek],
            `${formatTime(schedule.timeStart)}–${formatTime(schedule.timeEnd)}`,
          ].filter(Boolean).join(' · ') : undefined;
          const entityLabel = log.entityType === 'BorrowRequest'
            ? request?.requestType === 'LABORATORY' || details.requestType === 'LABORATORY' ? 'Lab reservation' : 'Equipment request'
            : ENTITY_LABELS[log.entityType] ?? log.entityType;
          const recordReference = log.entityType === 'BorrowRequest'
            ? 'REQ-' + log.entityId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-6).padStart(6, '0')
            : userReference || scheduleReference || (typeof details.label === 'string' ? details.label : log.entityId);
          const enrichedDetails = scheduleReference && !details.context ? { ...details, context: scheduleReference } : details;
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
            entityLabel,
            entityId: log.entityId,
            recordReference,
            details: enrichedDetails,
            summary: `${ACTION_LABELS[log.action] ?? log.action} ${entityLabel}: ${recordReference}${scheduleReference && recordReference !== scheduleReference ? ` · ${scheduleReference}` : ''}`,
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
