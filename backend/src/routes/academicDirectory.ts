import { saveDirectory } from '../services/directoryValidation';
import { prisma } from '../db/prisma';
import { sendError } from '../middleware/errors';
import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = Router();



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

for (const entity of ['buildings', 'rooms', 'programs', 'subjects', 'departments'] as const) {
  router.post('/' + entity, authenticateToken, authorizeRoles(UserRole.ADMIN), async (req, res) => {
    try { res.status(201).json(await saveDirectory(prisma, entity, req.body ?? {}, req.user!.id)); }
    catch (error) { sendError(error, res); }
  });
  router.put('/' + entity + '/:id', authenticateToken, authorizeRoles(UserRole.ADMIN), async (req, res) => {
    try { res.json(await saveDirectory(prisma, entity, req.body ?? {}, req.user!.id, req.params.id)); }
    catch (error) { sendError(error, res); }
  });
}
export default router;
