import { prisma } from '../db/prisma';
import { sendError } from '../middleware/errors';
import { Router } from 'express';
import { EquipmentStatus, RequestStatus, ScheduleType, UserRole } from '@prisma/client';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import {
  generateBorrowRequestPdf,
  generateDemandAnalysisPdf,
  generateEquipmentPdf,
  generateLabSchedulePdf,
  type DemandAnalysisReportFilters,
  type DemandGroupBy,
  type DemandRoomFilter,
  type DemandSourceFilter,
  type DemandStatusScope,
  type BorrowRequestReportFilters,
  type BorrowRequestReportScope,
  type ScheduleReportFilters,
  type ScheduleReportScope,
  type ScheduleReportView,
  type ScheduleRoomFilter,
} from '../services/reportPdfService';
import {
  getPeriodSelectionFromQuery,
  resolveAcademicPeriodSelection,
} from '../services/academicPeriodService';

const router = Router();


const parseScope = (value: string | undefined): BorrowRequestReportScope =>
  value === 'period' ? 'period' : 'filtered';

const demandGroupValues: DemandGroupBy[] = ['faculty', 'submittedBy', 'program', 'subject', 'room'];
const demandSourceValues: DemandSourceFilter[] = ['ALL', 'STUDENT', 'FACULTY'];
const demandRoomValues: DemandRoomFilter[] = ['ALL', 'COMPUTER_LAB', 'OTHER'];
const demandStatusValues: DemandStatusScope[] = ['ACTIVE', 'ALL'];
const scheduleRoomValues: ScheduleRoomFilter[] = ['ALL', 'COMPUTER_LAB', 'OTHER'];
const scheduleViewValues: ScheduleReportView[] = ['log', 'analysis'];
const equipmentViewValues = ['inventory', 'usage'] as const;
const equipmentReportValues = ['log', 'analysis'] as const;

router.get(
  '/borrow-requests.pdf',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    try {
      const query = req.query as Record<string, string | undefined>;
      const requestedStatus = query.status && query.status !== 'ALL' ? query.status : undefined;

      if (requestedStatus && !Object.values(RequestStatus).includes(requestedStatus as RequestStatus)) {
        res.status(400).json({ error: 'Invalid request status filter.' });
        return;
      }
      const periodSelection = await resolveAcademicPeriodSelection(
        prisma,
        getPeriodSelectionFromQuery(query),
        req.user?.role
      );

      const filters: BorrowRequestReportFilters = {
        scope: parseScope(query.scope),
        ...periodSelection,
        from: query.from,
        to: query.to,
        search: query.search,
        status: requestedStatus,
        room: query.room,
        program: query.program,
        year: query.year,
      };

      const report = await generateBorrowRequestPdf(prisma, filters);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${report.filename}"`,
        'Content-Length': String(report.buffer.length),
        'Cache-Control': 'private, no-store',
      });
      res.send(report.buffer);
    } catch (error) { sendError(error, res); }
  }
);

router.get(
  '/demand-analysis.pdf',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    try {
      const query = req.query as Record<string, string | undefined>;
      const requestedStatus = query.status && query.status !== 'ALL' ? query.status : undefined;
      const groupBy = query.groupBy as DemandGroupBy | undefined;
      const demandSource = query.demandSource as DemandSourceFilter | undefined;
      const demandRoomType = query.demandRoomType as DemandRoomFilter | undefined;
      const demandStatusScope = query.demandStatusScope as DemandStatusScope | undefined;

      if (requestedStatus && !Object.values(RequestStatus).includes(requestedStatus as RequestStatus)) {
        res.status(400).json({ error: 'Invalid request status filter.' });
        return;
      }
      const periodSelection = await resolveAcademicPeriodSelection(
        prisma,
        getPeriodSelectionFromQuery(query),
        req.user?.role
      );
      if (!groupBy || !demandGroupValues.includes(groupBy)) {
        res.status(400).json({ error: 'Invalid demand grouping.' });
        return;
      }
      if (!demandSource || !demandSourceValues.includes(demandSource)) {
        res.status(400).json({ error: 'Invalid demand source filter.' });
        return;
      }
      if (!demandRoomType || !demandRoomValues.includes(demandRoomType)) {
        res.status(400).json({ error: 'Invalid demand room filter.' });
        return;
      }
      if (!demandStatusScope || !demandStatusValues.includes(demandStatusScope)) {
        res.status(400).json({ error: 'Invalid demand status scope.' });
        return;
      }

      const filters: DemandAnalysisReportFilters = {
        scope: parseScope(query.scope),
        ...periodSelection,
        from: query.from,
        to: query.to,
        search: query.search,
        status: requestedStatus,
        room: query.room,
        program: query.program,
        year: query.year,
        groupBy,
        demandSource,
        demandRoomType,
        demandStatusScope,
      };

      const report = await generateDemandAnalysisPdf(prisma, filters);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${report.filename}"`,
        'Content-Length': String(report.buffer.length),
        'Cache-Control': 'private, no-store',
      });
      res.send(report.buffer);
    } catch (error) { sendError(error, res); }
  }
);

router.get(
  '/lab-schedules.pdf',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    try {
      const query = req.query as Record<string, string | undefined>;
      const scheduleType =
        query.scheduleType && query.scheduleType !== 'ALL'
          ? query.scheduleType
          : undefined;
      const roomType =
        query.roomType && query.roomType !== 'ALL'
          ? query.roomType
          : 'ALL';
      const scope: ScheduleReportScope = query.scope === 'period' ? 'period' : 'filtered';
      const view: ScheduleReportView = query.view === 'analysis' ? 'analysis' : 'log';

      if (scheduleType && !Object.values(ScheduleType).includes(scheduleType as ScheduleType)) {
        res.status(400).json({ error: 'Invalid schedule type filter.' });
        return;
      }
      if (!scheduleRoomValues.includes(roomType as ScheduleRoomFilter)) {
        res.status(400).json({ error: 'Invalid schedule room filter.' });
        return;
      }
      if (!scheduleViewValues.includes(view)) {
        res.status(400).json({ error: 'Invalid schedule report view.' });
        return;
      }

      const periodSelection = await resolveAcademicPeriodSelection(
        prisma,
        getPeriodSelectionFromQuery(query),
        req.user?.role
      );

      const filters: ScheduleReportFilters = {
        scope,
        view,
        ...periodSelection,
        from: query.from,
        to: query.to,
        search: query.search,
        day: query.day,
        room: query.room,
        roomType: roomType as ScheduleRoomFilter,
        program: query.program,
        year: query.year,
        scheduleType: scheduleType as ScheduleType | undefined,
      };

      const report = await generateLabSchedulePdf(prisma, filters);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${report.filename}"`,
        'Content-Length': String(report.buffer.length),
        'Cache-Control': 'private, no-store',
      });
      res.send(report.buffer);
    } catch (error) { sendError(error, res); }
  }
);

router.get(
  '/equipment.pdf',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    try {
      const query = req.query as Record<string, string | undefined>;
      const status = query.status && query.status !== 'ALL' ? query.status : undefined;
      const view = query.view === 'usage' ? 'usage' : 'inventory';
      const report = query.report === 'analysis' ? 'analysis' : 'log';
      const scope = query.scope === 'period' ? 'period' : 'filtered';

      if (status && !Object.values(EquipmentStatus).includes(status as EquipmentStatus)) {
        res.status(400).json({ error: 'Invalid equipment status filter.' });
        return;
      }
      if (!equipmentViewValues.includes(view)) {
        res.status(400).json({ error: 'Invalid equipment report view.' });
        return;
      }
      if (!equipmentReportValues.includes(report)) {
        res.status(400).json({ error: 'Invalid equipment report type.' });
        return;
      }

      const periodSelection = await resolveAcademicPeriodSelection(
        prisma,
        getPeriodSelectionFromQuery(query),
        req.user?.role
      );

      const result = await generateEquipmentPdf(prisma, {
        scope,
        view,
        report,
        ...periodSelection,
        from: query.from,
        to: query.to,
        search: query.search,
        status: status as EquipmentStatus | undefined,
        lowStock: query.lowStock === '1' || query.lowStock === 'true',
      });

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Content-Length': String(result.buffer.length),
        'Cache-Control': 'private, no-store',
      });
      res.send(result.buffer);
    } catch (error) { sendError(error, res); }
  }
);

export default router;