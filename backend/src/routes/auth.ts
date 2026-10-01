import { prisma } from '../db/prisma';
import { authLimiter } from '../middleware/authLimiter';
import { recordRequiredAuditLog } from '../services/auditLogService';
import { DomainError } from '../services/domainError';
import { sendError } from '../middleware/errors';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { UserStatus } from '@prisma/client';
import { authenticateToken, generateToken } from '../middleware/auth';

const router = Router();


// Accounts are created only through the admin-protected POST /api/users route.

router.use(['/login', '/register'], authLimiter);

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password || email.length > 254 || password.length > 1024) { res.status(400).json({ error: 'Email and password are required.' }); return; }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        facultyProfile: {
          include: {
            department: true,
          },
        },
        studentProfile: {
          include: {
            program: true,
          },
        },
      },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check if user is active
    if (user.status !== UserStatus.ACTIVE) {
      res.status(401).json({ error: 'Account is not active' });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Update last login
    const loggedIn = await prisma.user.updateMany({
      where: { id: user.id, status: UserStatus.ACTIVE, passwordHash: user.passwordHash, sessionVersion: user.sessionVersion },
      data: { lastLoginAt: new Date() },
    });
    if (loggedIn.count !== 1) { res.status(401).json({ error: 'Account changed. Please sign in again.' }); return; }

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      sessionVersion: user.sessionVersion,
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        status: user.status,
        departmentId: user.facultyProfile?.departmentId ?? null,
        department: user.facultyProfile?.department?.name ?? null,
        programId: user.studentProfile?.programId ?? null,
        program: user.studentProfile?.program?.name ?? null,
        yearLevel: user.studentProfile?.yearLevel ?? null,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      token,
    });
  } catch (error) { sendError(error, res); }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        facultyProfile: {
          select: {
            departmentId: true,
            department: {
              select: {
                name: true,
              },
            },
          },
        },
        studentProfile: {
          select: {
            programId: true,
            yearLevel: true,
            program: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        ...user,
        departmentId: user.facultyProfile?.departmentId ?? null,
        department: user.facultyProfile?.department?.name ?? null,
        programId: user.studentProfile?.programId ?? null,
        program: user.studentProfile?.program?.name ?? null,
        facultyProfile: undefined,
        yearLevel: user.studentProfile?.yearLevel ?? null,
        studentProfile: undefined,
      },
    });
  } catch (error) { sendError(error, res); }
});

// Change the authenticated user's password after verifying the current password.
router.patch('/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      res.status(400).json({ error: 'Current password and new password are required.' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters.' });
      return;
    }

    if (currentPassword === newPassword) {
      res.status(400).json({ error: 'New password must be different from the current password.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { passwordHash: true, sessionVersion: true },
    });

    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.$transaction(async tx => {
      const changed = await tx.user.updateMany({
        where: { id: req.user!.id, status: UserStatus.ACTIVE, passwordHash: user.passwordHash, sessionVersion: req.user!.sessionVersion },
        data: { passwordHash, sessionVersion: { increment: 1 } },
      });
      if (changed.count !== 1) throw new DomainError(409, 'Account changed. Please sign in again.');

      await recordRequiredAuditLog(tx, { actorUserId: req.user!.id, action: 'PASSWORD_CHANGED', entityType: 'User', entityId: req.user!.id });
    });
    res.json({ message: 'Password updated. Please sign in again on all devices.' });
  } catch (error) { sendError(error, res); }
});

export default router;
