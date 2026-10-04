import { prisma } from '../db/prisma';
import { sendError } from '../middleware/errors';
import { Router } from 'express';

import { authenticateToken } from '../middleware/auth';

const router = Router();


// GET /api/notifications — current user's notifications (latest 30)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const limit = 30;
    const offset = Math.max(0, Math.min(100000, Number.parseInt(String(req.query.offset ?? '0'), 10) || 0));
    const unreadOnly = req.query.unread === 'true';
    const where = { userId: req.user!.id, ...(unreadOnly ? { isRead: false } : {}) };
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: offset,
      take: limit + 1,
    });
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user!.id, isRead: false },
    });
    res.json({ notifications: notifications.slice(0, limit), unreadCount, hasMore: notifications.length > limit });
  } catch (error) { sendError(error, res); }
});

// GET /api/notifications/unread-count — lightweight poll endpoint
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user!.id, isRead: false },
    });
    res.json({ count });
  } catch (error) { sendError(error, res); }
});

// PATCH /api/notifications/read-all — mark all as read
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) { sendError(error, res); }
});

// PATCH /api/notifications/:id/read — mark one as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    if (notification.userId !== req.user!.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    await prisma.notification.update({ where: { id }, data: { isRead: true } });
    res.json({ message: 'Notification marked as read' });
  } catch (error) { sendError(error, res); }
});

export default router;
