import { passwordChangeLimiter } from '../middleware/requestLimiter';
import { validNewPassword, passwordPolicyMessage } from '../utils/passwordPolicy';
import { requestPasswordReset, resetPassword } from '../services/passwordResetService';
import { randomUUID } from 'node:crypto';
import { accountLink, queueAccountMail } from '../services/accountReactivationService';
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

router.use(['/login', '/register', '/reactivation', '/forgot-password', '/reset-password'], authLimiter);

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

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Explain account status only after verifying the supplied credentials.
    if (user.status !== UserStatus.ACTIVE) {
      const pending = await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "ReactivationRequest" WHERE "userId"=${user.id} AND "status"='PENDING'`;
      res.status(403).json({ appealPending: pending.length > 0, code: 'ACCOUNT_DEACTIVATED', error: 'Your account has been deactivated. Please contact the laboratory administrator to request reactivation.' });
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

// Credentials are rechecked; this endpoint never grants an authenticated session.
router.post('/reactivation', async (req, res) => {
  try {
    const { email, password, reason = '' } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password || email.length > 254 || password.length > 1024 || typeof reason !== 'string' || reason.length > 1000) {
      res.status(400).json({ error: 'Enter your credentials and a reason of at most 1000 characters.' }); return;
    }
    const user = await prisma.user.findUnique({ where: { email }, include: { studentProfile: { include: { program: true } } } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) { res.status(401).json({ error: 'Invalid email or password.' }); return; }
    const created = await prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ status: string; sessionVersion: number }[]>`SELECT "status", "sessionVersion" FROM "users" WHERE "id"=${user.id} FOR UPDATE`;
      if (!locked[0] || locked[0].status === 'ACTIVE' || locked[0].sessionVersion !== user.sessionVersion) throw new DomainError(409, 'Your account changed. Please sign in again.');
      const id = randomUUID();
      const added = await tx.$executeRaw`INSERT INTO "ReactivationRequest" ("id","userId","reason") VALUES (${id},${user.id},${reason.trim()}) ON CONFLICT DO NOTHING`;
      if (!added) return false;
      const profile = user.studentProfile;
      const identity = user.role === 'STUDENT' ? 'Student' + (profile ? ' · ' + [profile.program?.code || profile.program?.name, profile.yearLevel].filter(Boolean).join(' - ') : '') : user.role === 'FACULTY' ? 'Faculty' : 'Admin';
      const message = [user.firstName + ' ' + user.lastName, identity, user.email, 'Requested account reactivation.', 'Reason: ' + (reason.trim() || 'Not provided')].join('\n');
      const admins = await tx.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true, email: true } });
      for (const admin of admins) {
        await tx.notification.create({ data: { userId: admin.id, type: 'SYSTEM_ANNOUNCEMENT', title: 'Reactivation request', message, referenceType: 'account_reactivation', referenceId: user.id } });
        await queueAccountMail(tx, admin.email, 'appeal:' + id + ':' + admin.id, 'Reactivation request', message, accountLink(user.email), 'Review account');
      }
      await recordRequiredAuditLog(tx, { actorUserId: user.id, action: 'REACTIVATION_REQUESTED', entityType: 'User', entityId: user.id, details: { reason: reason.trim() } });
      return true;
    });
    res.status(created ? 201 : 200).json({ pending: true, message: created ? 'Your reactivation request has been sent to the administrator.' : 'Your reactivation request is already pending.' });
  } catch (error) { sendError(error, res); }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (typeof email !== 'string' || !email.trim() || email.length > 254) { res.status(400).json({error:'Enter your email address.'}); return; }
    await requestPasswordReset(email.trim());
    res.json({message:'If an account exists with this email, we’ve sent a password reset link. Please check your inbox and spam folder.'});
  } catch(error) { sendError(error,res); }
});
router.post('/reset-password', async (req,res) => {
  try {
    const {token,password}=req.body;
    if(typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) { res.status(400).json({error:'This reset link is invalid. Please request a new link.'}); return; }
    if(!validNewPassword(password)) { res.status(400).json({error:'Use at least 8 characters and no more than 72 bytes for your password.'}); return; }
    await resetPassword(token,password);
    res.json({message:'Your password has been reset. Please sign in again.'});
  } catch(error) { sendError(error,res); }
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
router.patch('/password', authenticateToken, passwordChangeLimiter, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      res.status(400).json({ error: 'Current password and new password are required.' });
      return;
    }

    if (!validNewPassword(newPassword) || currentPassword.length > 1024) {
      res.status(400).json({ error: passwordPolicyMessage });
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
