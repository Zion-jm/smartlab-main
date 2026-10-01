import { prisma } from '../db/prisma';
import { recordRequiredAuditLog } from '../services/auditLogService';
import { sendError } from '../middleware/errors';
import { loadCapacity, validateRequestItems, overlaps } from '../services/inventoryCapacityService';
import { manilaDayBounds, formatManilaDate, DAY_MS } from '../utils/manilaTime';
import { inventoryTransaction } from '../services/inventoryTransaction';
import { Router } from 'express';
import { cancelBorrowRequest, RequestActionError } from '../services/cancelBorrowRequestService';

import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { UserRole, RequestStatus, NotificationType } from '@prisma/client';

const router = Router();


// ====================================================
// EQUIPMENT AUTO-ADJUSTMENT API
// ====================================================

// POST /api/requests/:id/adjust-equipment
// Automatically adjust equipment quantities for conflicting requests
router.post('/adjust-equipment', authenticateToken, authorizeRoles(UserRole.ADMIN), async (req, res) => {
  try {
    const { requestId, approvedRequestId } = req.body;
    if (typeof requestId !== 'string' || !requestId || typeof approvedRequestId !== 'string' || !approvedRequestId)
      throw new RequestActionError(400, 'Request IDs are required.');
    const response = await inventoryTransaction(prisma, async tx => {
      const target = await tx.borrowRequest.findUnique({ where: { id: requestId }, include: { items: { include: { equipment: true } } } });
      if (!target) throw new RequestActionError(404, 'Request not found');
      if (target.status !== RequestStatus.PENDING) throw new RequestActionError(409, 'Only pending requests can be adjusted');
      validateRequestItems(target.items);
      const source = await tx.borrowRequest.findUnique({ where: { id: approvedRequestId } });
      if (!source) throw new RequestActionError(404, 'Approved request not found');
      if (source.status !== RequestStatus.APPROVED) throw new RequestActionError(409, 'Source request is not approved');
      if (manilaDayBounds(target.dateNeeded).start.getTime() !== manilaDayBounds(source.dateNeeded).start.getTime() || !overlaps(target, source))
        throw new RequestActionError(400, 'Requests must have overlapping time ranges on the same Manila date.');
      const snapshot = await loadCapacity(tx, target, target.items.map(i => i.equipmentId), requestId);
      const adjustments = target.items.map(item => {
        const availableQuantity = snapshot.entries.find(e => e.stock.id === item.equipmentId)?.available ?? 0;
        const adjustedQuantity = Math.min(item.quantity, availableQuantity);
        return { equipmentId: item.equipmentId, equipmentName: item.equipment.name, originalQuantity: item.quantity, availableQuantity, adjustedQuantity, shortage: item.quantity - adjustedQuantity };
      });
      if (!adjustments.some(a => a.shortage > 0)) return { success: true, data: { adjusted: false, message: 'No adjustments needed - sufficient equipment available', adjustments: [] } };
      // Zero-capacity selections are removed, never persisted as zero-unit loans.
      await tx.borrowRequest.update({
        where: { id: requestId, status: RequestStatus.PENDING, updatedAt: target.updatedAt }, data: {
          items: {
            deleteMany: {}, create: adjustments.filter(a => a.adjustedQuantity > 0).map(a => ({ equipmentId: a.equipmentId, quantity: a.adjustedQuantity })),
          }
        }
      });
      await recordRequiredAuditLog(tx, { actorUserId: req.user!.id, action: 'ADJUST', entityType: 'BorrowRequest', entityId: requestId, details: { adjustments } });
      const responseDeadline = new Date(Date.now() + DAY_MS);
      const adjustmentDetails = adjustments.map(a => a.equipmentName + ': ' + a.originalQuantity + ' → ' + a.adjustedQuantity).join(', ');
      const notification = await tx.notification.create({
        data: {
          userId: target.requestedBy, type: NotificationType.SYSTEM_ANNOUNCEMENT, title: 'Equipment Request Adjusted',
          referenceType: 'borrow_request', referenceId: requestId, borrowRequestId: requestId,
          message: 'Your equipment request for ' + formatManilaDate(target.dateNeeded) + ' has been adjusted due to inventory constraints.\n\nAdjustments: ' + adjustmentDetails + '\n\nSelections reduced to zero have been removed. Please review the remaining items, modify your request, or cancel. Please respond within 24 hours.',
        }
      });
      return {
        success: true, data: {
          adjusted: true, requestId, approvedRequestId, adjustments,
          notification: { id: notification.id, responseDeadline, message: 'Adjustment notification sent to user' },
          summary: { totalEquipment: adjustments.length, adjustedEquipment: adjustments.filter(a => a.shortage > 0).length, totalShortage: adjustments.reduce((sum, a) => sum + a.shortage, 0) },
        }
      };
    });
    res.json(response);
  } catch (error) { sendError(error, res); }
});

// POST /api/equipment-adjustments/:notificationId/respond
// Handle user response to adjustment notification
router.post('/:notificationId/respond', authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { action, requestId: suppliedRequestId } = req.body ?? {};
    if (typeof action !== 'string' || !['accept', 'modify', 'cancel'].includes(action)) {
      res.status(400).json({ error: 'Invalid action. Must be: accept, modify, or cancel' });
      return;
    }

    const result = await inventoryTransaction(prisma, async (tx) => {
      const notification = await tx.notification.findUnique({
        where: { id: notificationId }, include: { borrowRequest: true },
      });
      if (!notification) throw new RequestActionError(404, 'Notification not found');
      if (notification.userId !== req.user!.id) {
        throw new RequestActionError(403, 'Unauthorized access to notification');
      }
      // Existing adjustment notices use these persisted fields. Ordinary read
      // notifications must never become authority to modify a borrow request.
      if (notification.type !== NotificationType.SYSTEM_ANNOUNCEMENT ||
        notification.title !== 'Equipment Request Adjusted' ||
        notification.referenceType !== 'borrow_request' ||
        !notification.borrowRequestId ||
        notification.referenceId !== notification.borrowRequestId ||
        !notification.borrowRequest) {
        throw new RequestActionError(400, 'Notification is not an equipment adjustment');
      }
      const requestId = notification.borrowRequest.id;
      // Older clients may still send the ID; accept only an exact match.
      if (suppliedRequestId !== undefined && suppliedRequestId !== requestId) {
        throw new RequestActionError(400, 'Request does not match the adjustment notification');
      }
      if (notification.borrowRequest.requestedBy !== req.user!.id) {
        throw new RequestActionError(403, 'Access denied');
      }
      if (notification.isRead) throw new RequestActionError(409, 'Notification already read or responded to');
      if (notification.borrowRequest.status !== RequestStatus.PENDING) {
        throw new RequestActionError(409, 'Only pending requests can respond to adjustments');
      }

      if (action === 'cancel') {
        await cancelBorrowRequest(tx, {
          id: requestId, actorId: req.user!.id, actorRole: req.user!.role, pendingOnly: true,
        });
      } else {
        // Lock/recheck the request before consuming the notification, including
        // when approval or cancellation races with an accept/modify response.
        const pending = await tx.borrowRequest.updateMany({
          where: { id: requestId, requestedBy: req.user!.id, status: RequestStatus.PENDING },
          data: { status: RequestStatus.PENDING },
        });
        if (pending.count !== 1) throw new RequestActionError(409, 'Request changed. Refresh and try again.');
      }

      const suffix = action === 'modify' ? '\n\nACTION: User chose to modify request.'
        : action === 'cancel' ? '\n\nACTION: User cancelled request.' : '';
      const claimed = await tx.notification.updateMany({
        where: { id: notificationId, userId: req.user!.id, isRead: false, borrowRequestId: requestId },
        data: { isRead: true, message: notification.message + suffix },
      });
      if (claimed.count !== 1) throw new RequestActionError(409, 'Notification already read or responded to');
      const message = action === 'accept' ? 'Adjustment accepted. Your request has been updated.'
        : action === 'modify' ? 'Please modify your request with different dates, times, or quantities.'
          : 'Your request has been cancelled.';
      await recordRequiredAuditLog(tx, { actorUserId: req.user!.id, action: 'ADJUSTMENT_RESPONSE', entityType: 'BorrowRequest', entityId: requestId, details: { action, notificationId } });
      return { action, requestId, notificationId, message };
    });

    res.json({ success: true, data: result });
  } catch (error) { sendError(error, res); }
});

export default router;
