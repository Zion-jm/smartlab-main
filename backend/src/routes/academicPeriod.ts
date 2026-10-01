import { prisma } from '../db/prisma';
import { sendError } from '../middleware/errors';
import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { getActiveAcademicPeriod } from '../services/academicPeriodService';

const router = Router();


const YEAR_PATTERN = /^\d{4}-\d{4}$/;
const DEFAULT_TERM_NAMES = ['1st Semester', '2nd Semester', 'Summer Term'];

const periodLabel = (year: string, term: string) => `${year} · ${term}`;

const serializeCurrent = (academicYear: { id: string; year: string; isActive: boolean } | null, term: { id: string; name: string; isActive: boolean } | null) => (
  academicYear && term
    ? {
      academicYear,
      term,
      label: periodLabel(academicYear.year, term.name),
    }
    : null
);

router.get(
  '/current',
  authenticateToken,
  async (_req, res) => {
    try {
      res.json({ current: await getActiveAcademicPeriod(prisma) });
    } catch (error) { sendError(error, res); }
  }
);

router.get(
  '/',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (_req, res) => {
    try {
      const [activeAcademicYear, activeTerm, academicYears, terms, auditLogs] = await Promise.all([
        prisma.academicYear.findFirst({
          where: { isActive: true },
          select: { id: true, year: true, isActive: true },
        }),
        prisma.term.findFirst({
          where: { isActive: true },
          select: { id: true, name: true, isActive: true },
        }),
        prisma.academicYear.findMany({
          orderBy: { year: 'desc' },
          select: { id: true, year: true, isActive: true, createdAt: true, updatedAt: true },
        }),
        prisma.term.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true, isActive: true, createdAt: true, updatedAt: true },
        }),
        prisma.auditLog.findMany({
          where: { entityType: 'AcademicPeriod' },
          orderBy: { createdAt: 'desc' },
          take: 12,
          include: {
            actor: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        }),
      ]);

      res.json({
        current: serializeCurrent(activeAcademicYear, activeTerm),
        academicYears,
        terms,
        suggestedTerms: DEFAULT_TERM_NAMES,
        history: auditLogs.map((log) => ({
          id: log.id,
          action: log.action,
          entityId: log.entityId,
          details: log.details,
          createdAt: log.createdAt,
          actor: {
            id: log.actor.id,
            name: [log.actor.firstName, log.actor.lastName].filter(Boolean).join(' ') || log.actor.email,
            email: log.actor.email,
          },
        })),
      });
    } catch (error) { sendError(error, res); }
  }
);

router.post(
  '/',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    const year = typeof req.body?.year === 'string' ? req.body.year.trim() : '';
    const termName = typeof req.body?.termName === 'string' ? req.body.termName.trim() : '';
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

    if (!YEAR_PATTERN.test(year) || Number(year.slice(5)) !== Number(year.slice(0, 4)) + 1) {
      res.status(400).json({ error: 'Academic year must use the format YYYY-YYYY, with consecutive years.' });
      return;
    }

    if (!termName || termName.length > 60) {
      res.status(400).json({ error: 'A semester or term name is required and must be 60 characters or fewer.' });
      return;
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const previousYear = await tx.academicYear.findFirst({
          where: { isActive: true },
          select: { id: true, year: true },
        });
        const previousTerm = await tx.term.findFirst({
          where: { isActive: true },
          select: { id: true, name: true },
        });

        const academicYear = await tx.academicYear.upsert({
          where: { year },
          update: {},
          create: { year },
          select: { id: true, year: true, isActive: true },
        });
        const term = await tx.term.upsert({
          where: { name: termName },
          update: {},
          create: { name: termName },
          select: { id: true, name: true, isActive: true },
        });

        await tx.academicYear.updateMany({ data: { isActive: false } });
        await tx.term.updateMany({ data: { isActive: false } });
        const [activeYear, activeTerm] = await Promise.all([
          tx.academicYear.update({
            where: { id: academicYear.id },
            data: { isActive: true },
            select: { id: true, year: true, isActive: true },
          }),
          tx.term.update({
            where: { id: term.id },
            data: { isActive: true },
            select: { id: true, name: true, isActive: true },
          }),
        ]);

        await tx.auditLog.create({
          data: {
            actorUserId: req.user!.id,
            action: 'ACTIVATE',
            entityType: 'AcademicPeriod',
            entityId: `${activeYear.id}:${activeTerm.id}`,
            details: {
              previous: previousYear && previousTerm
                ? { year: previousYear.year, term: previousTerm.name }
                : null,
              next: { year: activeYear.year, term: activeTerm.name },
              reason: reason || null,
            },
          },
        });

        return { activeYear, activeTerm };
      });

      res.status(201).json({
        message: 'Academic period activated successfully.',
        current: serializeCurrent(result.activeYear, result.activeTerm),
      });
    } catch (error) { sendError(error, res); }
  }
);

export default router;