import { prisma } from '../db/prisma';
import { pagination, pageHeaders } from '../utils/pagination';
import { requestVisibility } from '../services/requestVisibility';
import { sendError } from '../middleware/errors';
import { effectiveStatus, equipmentView } from '../services/equipmentLifecycle';
import { retireEquipment, restoreEquipment } from '../services/retirementService';
import { MAX_QUANTITY, assertStockSupportsReservations } from '../services/inventoryCapacityService';
import { RequestActionError } from '../services/requestActionError';
import { inventoryTransaction } from '../services/inventoryTransaction';
import { manilaDayBounds, DAY_MS } from '../utils/manilaTime';
import { Router, type Response } from 'express';
import { EquipmentStatus, RequestStatus, UserRole } from '@prisma/client';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { recordRequiredAuditLog } from '../services/auditLogService';
import {
  academicPeriodWhere,
  getPeriodSelectionFromQuery,
  resolveAcademicPeriodSelection,
} from '../services/academicPeriodService';

const router = Router();


const validateQuantities = (
  totalQuantity: number,
  borrowedQuantity: number,
  damagedQuantity: number,
  res: Response
): string | null => {
  if (!Number.isInteger(totalQuantity) || totalQuantity < 0 || totalQuantity > MAX_QUANTITY) {
    res.status(400).json({ error: 'Total quantity must be a whole number from 0 to 2147483647.' });
    return 'invalid';
  }
  if (!Number.isInteger(borrowedQuantity) || borrowedQuantity < 0 || borrowedQuantity > MAX_QUANTITY) {
    res.status(400).json({ error: 'Borrowed quantity must be a whole number from 0 to 2147483647.' });
    return 'invalid';
  }
  if (!Number.isInteger(damagedQuantity) || damagedQuantity < 0 || damagedQuantity > MAX_QUANTITY) {
    res.status(400).json({ error: 'Damaged quantity must be a whole number from 0 to 2147483647.' });
    return 'invalid';
  }
  if (totalQuantity === 0 && (borrowedQuantity > 0 || damagedQuantity > 0)) {
    res.status(400).json({ error: 'Total quantity must account for borrowed or damaged items.' });
    return 'invalid';
  }
  if (borrowedQuantity + damagedQuantity > totalQuantity) {
    res
      .status(400)
      .json({ error: 'Borrowed + damaged quantity cannot exceed total quantity.' });
    return 'invalid';
  }
  return null;
};

const handlePrismaError = (error: unknown, res: Response, _fallback = 'Request failed') => { sendError(error, res); };

// Get all equipment (Admin + Faculty)
router.get('/', authenticateToken, authorizeRoles(UserRole.ADMIN, UserRole.FACULTY, UserRole.STUDENT), async (req, res) => {
  try {
    const { status, search, lowStock } = req.query;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (lowStock === '1' || lowStock === 'true') {
      where.availableQuantity = { lte: 1 };
      where.totalQuantity = { gt: 1 };
    }

    const paging = pagination(req.query);
    const equipment = await prisma.equipment.findMany({
      skip: paging.skip, take: paging.take,
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    pageHeaders(res, paging, await prisma.equipment.count({ where }));
    res.json(equipment.map(equipmentView));
  } catch (error) { sendError(error, res); }
});

// Get single equipment by ID (Admin + Faculty)
router.get('/:id', authenticateToken, authorizeRoles(UserRole.ADMIN, UserRole.FACULTY), async (req, res) => {
  try {
    const { id } = req.params;

    const equipment = await prisma.equipment.findUnique({
      where: { id },
      include: {
        requestItems: {
          where: { borrowRequest: requestVisibility(req.user!) },
          include: {
            borrowRequest: {
              select: {
                id: true,
                status: true,
                requestedBy: true,
                dateNeeded: true,
              },
            },
          },
        },
      },
    });

    if (!equipment) {
      res.status(404).json({ error: 'Equipment not found' });
      return;
    }

    res.json(equipmentView(equipment));
  } catch (error) { sendError(error, res); }
});

// Create equipment (Admin only)
router.post(
  '/',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    try {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const description = req.body?.description ? String(req.body.description).trim() : null;
      const totalQuantity = req.body?.totalQuantity ?? 0;
      const borrowedQuantity = req.body?.borrowedQuantity ?? 0;
      const damagedQuantity = req.body?.damagedQuantity ?? 0;
      const requestedStatus = req.body?.status as EquipmentStatus | undefined;

      if (!name) {
        res.status(400).json({ error: 'Equipment name is required.' });
        return;
      }

      if (validateQuantities(totalQuantity, borrowedQuantity, damagedQuantity, res)) return;
      if (borrowedQuantity !== 0) throw new RequestActionError(400, 'New equipment cannot have borrowed units. Record loans through checkout.');
      if (requestedStatus !== undefined && !Object.values(EquipmentStatus).includes(requestedStatus)) throw new RequestActionError(400, 'Invalid equipment status.');

      const retiredAt = requestedStatus === EquipmentStatus.UNAVAILABLE ? new Date() : null;
      const status = effectiveStatus({ retiredAt, availableQuantity: totalQuantity - borrowedQuantity - damagedQuantity, borrowedQuantity, damagedQuantity });

      const equipment = await inventoryTransaction(prisma, async tx => {
        const equipment = await tx.equipment.create({
          data: {
            name,
            description,
            totalQuantity,
            borrowedQuantity,
            damagedQuantity,
            availableQuantity: totalQuantity - borrowedQuantity - damagedQuantity,
            status,
            retiredAt,
          },
        });

        await recordRequiredAuditLog(tx, {
          actorUserId: req.user!.id,
          action: 'CREATE',
          entityType: 'Equipment',
          entityId: equipment.id,
          details: { label: equipment.name, totalQuantity: equipment.totalQuantity, status: equipment.status },
        });
        return equipment;
      });
      res.status(201).json(equipmentView(equipment));
    } catch (error) {
      handlePrismaError(error, res, 'Failed to create equipment');
    }
  }
);

// Update equipment (Admin only)
router.put(
  '/:id',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { equipment } = await inventoryTransaction(prisma, async tx => {
        const previous = await tx.equipment.findUnique({ where: { id } });
        if (!previous) throw new RequestActionError(404, 'Equipment record not found.');
        const name = req.body.name === undefined ? previous.name : typeof req.body.name === 'string' ? req.body.name.trim() : '';
        if (!name) throw new RequestActionError(400, 'Equipment name is required.');
        const totalQuantity = req.body.totalQuantity ?? previous.totalQuantity;
        const damagedQuantity = req.body.damagedQuantity ?? previous.damagedQuantity;
        const borrowedQuantity = previous.borrowedQuantity;
        if (req.body.borrowedQuantity !== undefined && req.body.borrowedQuantity !== borrowedQuantity)
          throw new RequestActionError(409, 'Borrowed quantity is managed by checkout, return and cancellation. Refresh the equipment record.');
        if ([totalQuantity, damagedQuantity].some(q => !Number.isInteger(q) || q < 0 || q > MAX_QUANTITY) || borrowedQuantity + damagedQuantity > totalQuantity)
          throw new RequestActionError(400, 'Stock quantities must be nonnegative whole numbers; total must cover borrowed and damaged units.');
        if (req.body.retiredAt !== undefined || (req.body.status !== undefined && req.body.status !== previous.status))
          throw new RequestActionError(409, 'Use Archive or Restore to change equipment lifecycle. Stock status is automatic.');
        const status = effectiveStatus({ retiredAt: previous.retiredAt, availableQuantity: totalQuantity - borrowedQuantity - damagedQuantity, borrowedQuantity, damagedQuantity });
        const activeLoans = await tx.borrowRequestItem.aggregate({ _sum: { quantity: true }, where: { equipmentId: id, borrowRequest: { status: RequestStatus.BORROWED } } });
        if ((activeLoans._sum.quantity ?? 0) !== borrowedQuantity)
          throw new RequestActionError(409, 'Inventory does not match outstanding loans. Inventory review is required.');
        const equipment = await tx.equipment.update({
          where: { id }, data: {
            name, description: req.body.description === undefined ? previous.description : req.body.description ? String(req.body.description).trim() : null,
            totalQuantity, damagedQuantity, availableQuantity: totalQuantity - borrowedQuantity - damagedQuantity, status,
          }
        });
        await assertStockSupportsReservations(tx, equipment);
        await recordRequiredAuditLog(tx, {
          actorUserId: req.user!.id,
          action: 'UPDATE',
          entityType: 'Equipment',
          entityId: equipment.id,
          details: { label: equipment.name, previous, next: { totalQuantity: equipment.totalQuantity, borrowedQuantity: equipment.borrowedQuantity, damagedQuantity: equipment.damagedQuantity, status: equipment.status } },
        });
        return { previous, equipment };
      });

      res.json(equipmentView(equipment));
    } catch (error) {
      handlePrismaError(error, res, 'Failed to update equipment');
    }
  }
);

// DELETE remains compatible with old clients without destroying request lines.
const retireEquipmentHandler: import('express').RequestHandler = async (req, res) => {
  try {
    const equipment = await retireEquipment(prisma, req.params.id, req.user!.id);
    res.json({ message: 'Equipment retired as unavailable. History and outstanding loans were preserved.', equipment });
  } catch (error) { handlePrismaError(error, res, 'Failed to retire equipment'); }
};
router.post('/:id/restore', authenticateToken, authorizeRoles(UserRole.ADMIN), async (req, res) => {
  try {
    const equipment = await restoreEquipment(prisma, req.params.id, req.user!.id);
    res.json({ message: 'Equipment restored. Availability follows its current stock.', equipment: equipmentView(equipment) });
  } catch (error) { handlePrismaError(error, res, 'Failed to restore equipment'); }
});
router.post('/:id/retire', authenticateToken, authorizeRoles(UserRole.ADMIN), retireEquipmentHandler);
router.delete('/:id', authenticateToken, authorizeRoles(UserRole.ADMIN), retireEquipmentHandler);

// Equipment stats (Admin only)
router.get('/stats/overview', authenticateToken, authorizeRoles(UserRole.ADMIN), async (req, res) => {
  try {
    const periodSelection = await resolveAcademicPeriodSelection(
      prisma,
      getPeriodSelectionFromQuery(req.query as Record<string, unknown>),
      req.user?.role
    );
    const periodFilter = academicPeriodWhere(periodSelection);
    const { start: startOfToday, end: endOfToday } = manilaDayBounds(new Date());
    const sevenDaysFromNow = new Date(endOfToday.getTime() + 7 * DAY_MS);

    const activeStatuses: RequestStatus[] = [RequestStatus.APPROVED, RequestStatus.BORROWED];

    const [inventory, lowStockCount, todayReserved, pendingRequests, upcomingReservations, overdueReservations] = await Promise.all([
      prisma.equipment.aggregate({
        _count: { id: true },
        _sum: {
          totalQuantity: true,
          availableQuantity: true,
          borrowedQuantity: true,
          damagedQuantity: true,
        },
      }),
      prisma.equipment.count({
        where: {
          totalQuantity: { gt: 1 },
          availableQuantity: { lte: 1 },
        },
      }),
      prisma.borrowRequestItem.aggregate({
        _count: { id: true },
        _sum: { quantity: true },
        where: {
          borrowRequest: {
            ...periodFilter,
            dateNeeded: { gte: startOfToday, lt: endOfToday },
            status: { in: activeStatuses },
          },
        },
      }),
      prisma.borrowRequest.count({
        where: { status: RequestStatus.PENDING, ...periodFilter },
      }),
      prisma.borrowRequestItem.aggregate({
        _count: { id: true },
        _sum: { quantity: true },
        where: {
          borrowRequest: {
            ...periodFilter,
            dateNeeded: { gte: endOfToday, lt: sevenDaysFromNow },
            status: { in: activeStatuses },
          },
        },
      }),
      prisma.borrowRequestItem.aggregate({
        _count: { id: true },
        _sum: { quantity: true },
        where: {
          borrowRequest: {
            ...periodFilter,
            dateNeeded: { lt: startOfToday },
            status: { in: activeStatuses },
          },
        },
      }),
    ]);

    const totalQuantity = inventory._sum.totalQuantity ?? 0;
    const borrowedQuantity = inventory._sum.borrowedQuantity ?? 0;
    const utilizationRate = totalQuantity > 0 ? Math.min(Math.round((borrowedQuantity / totalQuantity) * 100), 100) : 0;

    res.json({
      inventory: {
        uniqueItems: inventory._count.id,
        totalQuantity,
        availableQuantity: inventory._sum.availableQuantity ?? 0,
        borrowedQuantity,
        damagedQuantity: inventory._sum.damagedQuantity ?? 0,
        lowStockCount,
        utilizationRate,
      },
      today: {
        itemsReserved: todayReserved._count.id ?? 0,
        quantityReserved: todayReserved._sum.quantity ?? 0,
      },
      pendingRequests,
      upcoming: {
        requests: upcomingReservations._count.id ?? 0,
        quantity: upcomingReservations._sum.quantity ?? 0,
      },
      overdue: {
        requests: overdueReservations._count.id ?? 0,
        quantity: overdueReservations._sum.quantity ?? 0,
      },
    });
  } catch (error) { sendError(error, res); }
});

export default router;
