import { prisma } from '../db/prisma';
import { sendError } from '../middleware/errors';
import { Router } from 'express';

import { authenticateToken } from '../middleware/auth';

const router = Router();


// GET /api/notifications — current user's notifications (latest 30)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user!.id, isRead: false },
    });
    res.json({ notifications, unreadCount });
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
