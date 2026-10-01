import { prisma } from '../db/prisma';
import { sendError } from '../middleware/errors';
import { Router, type Response } from 'express';
import { UserRole } from '@prisma/client';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { recordOptionalAuditLog } from '../services/auditLogService';

const router = Router();


const handlePrismaError = (error: unknown, res: Response, _fallbackMessage: string): void => { sendError(error, res); };

router.get(
  '/',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (_req, res) => {
    try {
      const [buildings, rooms, programs, subjects, departments] = await Promise.all([
        prisma.building.findMany({
          orderBy: { name: 'asc' },
          include: {
            _count: {
              select: {
                rooms: true,
              },
            },
          },
        }),
        prisma.room.findMany({
          orderBy: { roomNumber: 'asc' },
          include: {
            building: {
              select: { id: true, name: true },
            },
          },
        }),
        prisma.program.findMany({
          orderBy: { code: 'asc' },
        }),
        prisma.subject.findMany({
          orderBy: { code: 'asc' },
        }),
        prisma.department.findMany({
          orderBy: { name: 'asc' },
        }),
      ]);

      res.json({
        summary: {
          buildings: buildings.length,
          rooms: rooms.length,
          programs: programs.length,
          subjects: subjects.length,
          departments: departments.length,
        },
        buildings: buildings.map((building) => ({
          id: building.id,
          name: building.name,
          roomCount: building._count.rooms,
        })),
        rooms: rooms.map((room) => ({
          id: room.id,
          roomNumber: room.roomNumber,
          roomName: room.name ?? null,
          buildingId: room.buildingId,
          buildingName: room.building?.name ?? null,
          isComputerLab: room.isComputerLab,
        })),
        programs: programs.map((program) => ({
          id: program.id,
          code: program.code,
          name: program.name,
        })),
        subjects: subjects.map((subject) => ({
          id: subject.id,
          code: subject.code,
          name: subject.name,
        })),
        departments: departments.map((department) => ({
          id: department.id,
          name: department.name,
        })),
      });
    } catch (error) { sendError(error, res); }
  }
);

router.get(
  '/programs',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (_req, res) => {
    try {
      const programs = await prisma.program.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
        },
      });

      res.json(
        programs.map((program) => ({
          program_id: program.id,
          program_code: program.code,
          program_name: program.name,
        }))
      );
    } catch (error) { sendError(error, res); }
  }
);

router.get(
  '/departments',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (_req, res) => {
    try {
      const departments = await prisma.department.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
        },
      });

      res.json(
        departments.map((department) => ({
          department_id: department.id,
          department_name: department.name,
        }))
      );
    } catch (error) { sendError(error, res); }
  }
);

router.post(
  '/buildings',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    const name = (req.body?.name ?? '').trim();
    if (!name) {
      res.status(400).json({ error: 'Building name is required.' });
      return;
    }
    try {
      const building = await prisma.building.create({ data: { name } });
      await recordOptionalAuditLog(prisma, {
        actorUserId: req.user!.id,
        action: 'CREATE',
        entityType: 'AcademicDirectory',
        entityId: building.id,
        details: { recordType: 'Building', label: building.name },
      });
      res.status(201).json({ id: building.id, name: building.name });
    } catch (error) {
      return handlePrismaError(error, res, 'Failed to create building');
    }
  }
);

router.put(
  '/buildings/:id',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    const id = req.params.id;
    const name = (req.body?.name ?? '').trim();
    if (!name) {
      res.status(400).json({ error: 'Building name is required.' });
      return;
    }
    try {
      const building = await prisma.building.update({ where: { id }, data: { name } });
      await recordOptionalAuditLog(prisma, {
        actorUserId: req.user!.id,
        action: 'UPDATE',
        entityType: 'AcademicDirectory',
        entityId: building.id,
        details: { recordType: 'Building', label: building.name },
      });
      res.json({ id: building.id, name: building.name });
    } catch (error) {
      return handlePrismaError(error, res, 'Failed to update building');
    }
  }
);

router.post(
  '/rooms',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    const roomNumber = (req.body?.roomNumber ?? '').trim();
    const roomNameRaw = req.body?.roomName;
    const roomName = typeof roomNameRaw === 'string' ? roomNameRaw.trim() : '';
    const buildingIdRaw = req.body?.buildingId;
    const isComputerLab = Boolean(req.body?.isComputerLab);

    if (!roomNumber && !roomName) {
      res.status(400).json({ error: 'Room number or room name is required.' });
      return;
    }

    try {
      const room = await prisma.room.create({
        data: {
          roomNumber: roomNumber || null,
          name: roomName || null,
          buildingId: buildingIdRaw ? String(buildingIdRaw) : null,
          isComputerLab,
        },
        include: { building: { select: { name: true } } },
      });

      await recordOptionalAuditLog(prisma, {
        actorUserId: req.user!.id,
        action: 'CREATE',
        entityType: 'AcademicDirectory',
        entityId: room.id,
        details: { recordType: 'Room', label: room.roomNumber || room.name || room.id },
      });
      res.status(201).json({
        id: room.id,
        roomNumber: room.roomNumber,
        roomName: room.name,
        buildingId: room.buildingId,
        buildingName: room.building?.name ?? null,
        isComputerLab: room.isComputerLab,
      });
    } catch (error) {
      return handlePrismaError(error, res, 'Failed to create room');
    }
  }
);

router.put(
  '/rooms/:id',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    const id = req.params.id;
    const roomNumber = (req.body?.roomNumber ?? '').trim();
    const roomNameRaw = req.body?.roomName;
    const roomName = typeof roomNameRaw === 'string' ? roomNameRaw.trim() : '';
    const buildingIdRaw = req.body?.buildingId;
    const isComputerLab = Boolean(req.body?.isComputerLab);

    if (!roomNumber && !roomName) {
      res.status(400).json({ error: 'Room number or room name is required.' });
      return;
    }

    try {
      const room = await prisma.room.update({
        where: { id },
        data: {
          roomNumber: roomNumber || null,
          name: roomName || null,
          buildingId: buildingIdRaw ? String(buildingIdRaw) : null,
          isComputerLab,
        },
        include: { building: { select: { name: true } } },
      });

      await recordOptionalAuditLog(prisma, {
        actorUserId: req.user!.id,
        action: 'UPDATE',
        entityType: 'AcademicDirectory',
        entityId: room.id,
        details: { recordType: 'Room', label: room.roomNumber || room.name || room.id },
      });
      res.json({
        id: room.id,
        roomNumber: room.roomNumber,
        roomName: room.name,
        buildingId: room.buildingId,
        buildingName: room.building?.name ?? null,
        isComputerLab: room.isComputerLab,
      });
    } catch (error) {
      return handlePrismaError(error, res, 'Failed to update room');
    }
  }
);

router.post(
  '/programs',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    const code = (req.body?.code ?? '').trim().toUpperCase();
    const name = (req.body?.name ?? '').trim();
    if (!code || !name) {
      res.status(400).json({ error: 'Program code and name are required.' });
      return;
    }
    try {
      const program = await prisma.program.create({ data: { code, name } });
      await recordOptionalAuditLog(prisma, {
        actorUserId: req.user!.id,
        action: 'CREATE',
        entityType: 'AcademicDirectory',
        entityId: program.id,
        details: { recordType: 'Program', label: `${program.code} · ${program.name}` },
      });
      res.status(201).json({ id: program.id, code: program.code, name: program.name });
    } catch (error) {
      return handlePrismaError(error, res, 'Failed to create program');
    }
  }
);

router.put(
  '/programs/:id',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    const id = req.params.id;
    const code = (req.body?.code ?? '').trim().toUpperCase();
    const name = (req.body?.name ?? '').trim();
    if (!code || !name) {
      res.status(400).json({ error: 'Program code and name are required.' });
      return;
    }
    try {
      const program = await prisma.program.update({ where: { id }, data: { code, name } });
      await recordOptionalAuditLog(prisma, {
        actorUserId: req.user!.id,
        action: 'UPDATE',
        entityType: 'AcademicDirectory',
        entityId: program.id,
        details: { recordType: 'Program', label: `${program.code} · ${program.name}` },
      });
      res.json({ id: program.id, code: program.code, name: program.name });
    } catch (error) {
      return handlePrismaError(error, res, 'Failed to update program');
    }
  }
);

router.post(
  '/subjects',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    const code = (req.body?.code ?? '').trim().toUpperCase();
    const name = (req.body?.name ?? '').trim();
    if (!code || !name) {
      res.status(400).json({ error: 'Subject code and name are required.' });
      return;
    }
    try {
      const subject = await prisma.subject.create({ data: { code, name } });
      await recordOptionalAuditLog(prisma, {
        actorUserId: req.user!.id,
        action: 'CREATE',
        entityType: 'AcademicDirectory',
        entityId: subject.id,
        details: { recordType: 'Subject', label: `${subject.code} · ${subject.name}` },
      });
      res.status(201).json({ id: subject.id, code: subject.code, name: subject.name });
    } catch (error) {
      return handlePrismaError(error, res, 'Failed to create subject');
    }
  }
);

router.put(
  '/subjects/:id',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    const id = req.params.id;
    const code = (req.body?.code ?? '').trim().toUpperCase();
    const name = (req.body?.name ?? '').trim();
    if (!code || !name) {
      res.status(400).json({ error: 'Subject code and name are required.' });
      return;
    }
    try {
      const subject = await prisma.subject.update({ where: { id }, data: { code, name } });
      await recordOptionalAuditLog(prisma, {
        actorUserId: req.user!.id,
        action: 'UPDATE',
        entityType: 'AcademicDirectory',
        entityId: subject.id,
        details: { recordType: 'Subject', label: `${subject.code} · ${subject.name}` },
      });
      res.json({ id: subject.id, code: subject.code, name: subject.name });
    } catch (error) {
      return handlePrismaError(error, res, 'Failed to update subject');
    }
  }
);

router.post(
  '/departments',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    const name = (req.body?.name ?? '').trim();
    if (!name) {
      res.status(400).json({ error: 'Department name is required.' });
      return;
    }
    try {
      const department = await prisma.department.create({ data: { name } });
      await recordOptionalAuditLog(prisma, {
        actorUserId: req.user!.id,
        action: 'CREATE',
        entityType: 'AcademicDirectory',
        entityId: department.id,
        details: { recordType: 'Department', label: department.name },
      });
      res.status(201).json({ id: department.id, name: department.name });
    } catch (error) {
      return handlePrismaError(error, res, 'Failed to create department');
    }
  }
);

router.put(
  '/departments/:id',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    const id = req.params.id;
    const name = (req.body?.name ?? '').trim();
    if (!name) {
      res.status(400).json({ error: 'Department name is required.' });
      return;
    }
    try {
      const department = await prisma.department.update({ where: { id }, data: { name } });
      await recordOptionalAuditLog(prisma, {
        actorUserId: req.user!.id,
        action: 'UPDATE',
        entityType: 'AcademicDirectory',
        entityId: department.id,
        details: { recordType: 'Department', label: department.name },
      });
      res.json({ id: department.id, name: department.name });
    } catch (error) {
      return handlePrismaError(error, res, 'Failed to update department');
    }
  }
);

export default router;
