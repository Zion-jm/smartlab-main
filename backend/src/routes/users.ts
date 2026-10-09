import { validNewPassword, passwordPolicyMessage } from '../utils/passwordPolicy';
import { requestPasswordReset } from '../services/passwordResetService';
import { accountStatusChanged } from '../services/accountReactivationService';
import { prisma } from '../db/prisma';
import { pagination, pageHeaders } from '../utils/pagination';
import { sendError } from '../middleware/errors';
import { retireAccount } from '../services/retirementService';
import { RequestActionError } from '../services/requestActionError';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma, UserRole, UserStatus, User, FacultyProfile, StudentProfile } from '@prisma/client';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { recordRequiredAuditLog } from '../services/auditLogService';

const router = Router();


const ROLE_VALUE_TO_ID: Record<UserRole, number> = {
  ADMIN: 1,
  FACULTY: 2,
  STUDENT: 3,
};

const STATUS_VALUE_TO_ID: Record<UserStatus, number> = {
  ACTIVE: 1,
  // Keep the existing wire ID for compatibility with clients that already
  // consume the user response shape.
  DEACTIVATED: 3,
};

const ROLE_ID_TO_VALUE: Record<number, UserRole> = {
  [ROLE_VALUE_TO_ID.ADMIN]: UserRole.ADMIN,
  [ROLE_VALUE_TO_ID.FACULTY]: UserRole.FACULTY,
  [ROLE_VALUE_TO_ID.STUDENT]: UserRole.STUDENT,
};

const STATUS_ID_TO_VALUE: Record<number, UserStatus> = {
  [STATUS_VALUE_TO_ID.ACTIVE]: UserStatus.ACTIVE,
  [STATUS_VALUE_TO_ID.DEACTIVATED]: UserStatus.DEACTIVATED,
};

type UserWithProfiles = Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'role' | 'status'> & {
  facultyProfile?: (FacultyProfile & { department?: { id: string; name: string } | null }) | null;
  studentProfile?: (StudentProfile & { program?: { id: string; name: string; code: string } | null }) | null;
};

const mapUserToResponse = (user: UserWithProfiles) => {
  const department = user.facultyProfile?.department;
  const program = user.studentProfile?.program;
  const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();

  return {
    user_id: user.id,
    gmail: user.email,
    full_name: fullName || user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    role_id: ROLE_VALUE_TO_ID[user.role],
    role_name: user.role,
    status_id: STATUS_VALUE_TO_ID[user.status],
    status_name: user.status,
    department_id: department?.id ?? null,
    department_name: department?.name ?? null,
    department: department?.name ?? null,
    program_id: program?.id ?? null,
    program_name: program?.name ?? null,
    program_code: program?.code ?? null,
    program: program?.name ?? null,
    year_level: user.studentProfile?.yearLevel ?? null,
  };
};

// Get all users (Admin only)
router.get(
  '/',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    try {
      const { role, status, search } = req.query;

      const where: any = {};

      if (role) {
        where.role = role;
      }

      if (status) {
        where.status = status;
      }

      if (search) {
        where.OR = [
          { email: { contains: search as string, mode: 'insensitive' } },
          { firstName: { contains: search as string, mode: 'insensitive' } },
          { lastName: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const paging = pagination(req.query);
      const users = await prisma.user.findMany({
        skip: paging.skip, take: paging.take,
        where,
        select: {
          id: true, email: true, firstName: true, lastName: true, role: true, status: true,
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
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      });

      const formatted = users.map(mapUserToResponse);

      pageHeaders(res, paging, await prisma.user.count({ where }));
      res.json(formatted);
    } catch (error) { sendError(error, res); }
  }
);

// Create user (Admin only)
router.post(
  '/',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    try {
      const {
        first_name,
        last_name,
        gmail,
        password,
        role_id,
        status_id,
        department_id,
        program_id,
        year,
        year_level,
      } = req.body;

      if (!gmail || !password || role_id == null || status_id == null) {
        res.status(400).json({ error: 'Email, password, role, and status are required.' });
        return;
      }

      if (!validNewPassword(password)) { res.status(400).json({ error: passwordPolicyMessage }); return; }
      if (typeof gmail !== 'string' || gmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gmail)) { res.status(400).json({ error: 'Enter a valid email address.' }); return; }
      const role = ROLE_ID_TO_VALUE[Number(role_id)];
      const status = STATUS_ID_TO_VALUE[Number(status_id)];

      if (!role || !status) {
        res.status(400).json({ error: 'Invalid role or status provided.' });
        return;
      }

      if (role === UserRole.FACULTY && !department_id) {
        res.status(400).json({ error: 'Department is required for faculty accounts.' });
        return;
      }

      if (role === UserRole.STUDENT && (!program_id || !(year ?? year_level))) {
        res.status(400).json({ error: 'Program and year level are required for student accounts.' });
        return;
      }

      const existingUser = await prisma.user.findUnique({ where: { email: gmail } });
      if (existingUser) {
        res.status(409).json({ error: 'Email is already registered.' });
        return;
      }

      if (!first_name || !last_name) {
        res.status(400).json({ error: 'First name and last name are required.' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const createdUser = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: gmail,
            passwordHash,
            firstName: first_name,
            lastName: last_name,
            role,
            status,
          },
        });

        if (role === UserRole.FACULTY) {
          await tx.facultyProfile.create({
            data: {
              userId: user.id,
              departmentId: department_id ?? null,
            },
          });
        } else if (role === UserRole.STUDENT) {
          await tx.studentProfile.create({
            data: {
              userId: user.id,
              programId: program_id ?? null,
              yearLevel: Number(year ?? year_level) || null,
            },
          });
        } else if (role === UserRole.ADMIN) {
          await tx.adminProfile.create({
            data: {
              userId: user.id,
            },
          });
        }

        await recordRequiredAuditLog(tx, {
          actorUserId: req.user!.id,
          action: 'CREATE',
          entityType: 'User',
          entityId: user.id,
          details: {
            label: `${user.firstName} ${user.lastName}`,
            email: user.email,
            role: user.role,
            status: user.status,
          },
        });
        return user;
      });

      const savedUser = await prisma.user.findUnique({
        where: { id: createdUser.id },
        include: {
          facultyProfile: {
            include: { department: true },
          },
          studentProfile: {
            include: { program: true },
          },
        },
      });

      const department = savedUser?.facultyProfile?.department;
      const program = savedUser?.studentProfile?.program;

      const responsePayload = {
        user_id: savedUser?.id,
        gmail: savedUser?.email,
        first_name: savedUser?.firstName,
        last_name: savedUser?.lastName,
        role_id: ROLE_VALUE_TO_ID[savedUser!.role],
        role_name: savedUser?.role,
        status_id: STATUS_VALUE_TO_ID[savedUser!.status],
        status_name: savedUser?.status,
        department_id: department?.id ?? null,
        department_name: department?.name ?? null,
        department: department?.name ?? null,
        program_id: program?.id ?? null,
        program_name: program?.name ?? null,
        program_code: program?.code ?? null,
        program: program?.name ?? null,
        year_level: savedUser?.studentProfile?.yearLevel ?? null,
      };

      res.status(201).json({ message: 'User created successfully', user: responsePayload });
    } catch (error) { sendError(error, res); }
  }
);

// Get user by ID (Admin or own user)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is requesting their own profile or is admin
    if (req.user!.id !== id && req.user!.role !== UserRole.ADMIN) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id },
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
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) { sendError(error, res); }
});

// Update user (Admin or own user)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user!.role === UserRole.ADMIN;

    if (!isAdmin && req.user!.id !== id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: {
        facultyProfile: true,
        studentProfile: true,
        adminProfile: true,
      },
    });

    if (!existingUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const firstNameInput = req.body.first_name ?? req.body.firstName;
    const lastNameInput = req.body.last_name ?? req.body.lastName;
    const emailInput = req.body.gmail ?? req.body.email;
    const phoneInput = req.body.phone;
    if (phoneInput !== undefined && (typeof phoneInput !== 'string' || (phoneInput.trim() !== '' && !/^09[0-9]{9}$/.test(phoneInput.trim())))) {
      res.status(400).json({ error: 'Enter an 11-digit mobile number starting with 09, for example 09123456789.' });
      return;
    }

    const firstName = typeof firstNameInput === 'string' && firstNameInput.trim() ? firstNameInput.trim() : existingUser.firstName;
    const lastName = typeof lastNameInput === 'string' && lastNameInput.trim() ? lastNameInput.trim() : existingUser.lastName;
    const email = typeof emailInput === 'string' && emailInput.trim() ? emailInput.trim() : existingUser.email;
    const phone = typeof phoneInput === 'string' ? phoneInput.trim() || null : existingUser.phone;

    if (!firstName || !lastName) {
      res.status(400).json({ error: 'First name and last name are required.' });
      return;
    }

    if (!isAdmin && email !== existingUser.email) {
      res.status(403).json({ error: 'Email changes must be made by an administrator.' }); return;
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Enter a valid email address.' }); return;
    }
    if (email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({ where: { email } });
      if (emailExists) {
        res.status(409).json({ error: 'Email is already registered.' });
        return;
      }
    }

    let nextRole = existingUser.role;
    let nextStatus = existingUser.status;

    if (isAdmin) {
      const roleIdInput = req.body.role_id ?? req.body.roleId;
      const statusIdInput = req.body.status_id ?? req.body.statusId;

      if (roleIdInput != null) {
        const mappedRole = ROLE_ID_TO_VALUE[Number(roleIdInput)];
        if (!mappedRole) {
          res.status(400).json({ error: 'Invalid role provided.' });
          return;
        }
        nextRole = mappedRole;
      } else if (req.body.role) {
        const requestedRole = String(req.body.role).toUpperCase();
        if (!Object.values(UserRole).includes(requestedRole as UserRole)) {
          res.status(400).json({ error: 'Invalid role provided.' });
          return;
        }
        nextRole = requestedRole as UserRole;
      }

      if (statusIdInput != null) {
        const mappedStatus = STATUS_ID_TO_VALUE[Number(statusIdInput)];
        if (!mappedStatus) {
          res.status(400).json({ error: 'Invalid status provided.' });
          return;
        }
        nextStatus = mappedStatus;
      } else if (req.body.status) {
        const requestedStatus = String(req.body.status).toUpperCase();
        const normalizedStatus = requestedStatus as UserStatus;
        if (!Object.values(UserStatus).includes(normalizedStatus)) {
          res.status(400).json({ error: 'Invalid status provided.' });
          return;
        }
        nextStatus = normalizedStatus;
      }
    }

    const normalizeStringOrNull = (value: any) => {
      if (value === undefined || value === null) return null;
      const trimmed = String(value).trim();
      return trimmed.length ? trimmed : null;
    };

    const departmentId = isAdmin
      ? normalizeStringOrNull(req.body.department_id ?? req.body.departmentId ?? existingUser.facultyProfile?.departmentId)
      : existingUser.facultyProfile?.departmentId ?? null;
    const programId = isAdmin
      ? normalizeStringOrNull(req.body.program_id ?? req.body.programId ?? existingUser.studentProfile?.programId)
      : existingUser.studentProfile?.programId ?? null;
    const rawYearLevel = isAdmin
      ? req.body.year ?? req.body.year_level ?? req.body.yearLevel ?? existingUser.studentProfile?.yearLevel
      : existingUser.studentProfile?.yearLevel ?? null;
    const yearLevel =
      rawYearLevel === undefined || rawYearLevel === null || rawYearLevel === ''
        ? null
        : Number(rawYearLevel);

    if (yearLevel !== null && (Number.isNaN(yearLevel) || yearLevel < 1)) {
      res.status(400).json({ error: 'Invalid year level provided.' });
      return;
    }

    if (isAdmin) {
      if (nextRole === UserRole.FACULTY && !departmentId) {
        res.status(400).json({ error: 'Department is required for faculty accounts.' });
        return;
      }

      if (nextRole === UserRole.STUDENT && (!programId || !yearLevel)) {
        res.status(400).json({ error: 'Program and year level are required for student accounts.' });
        return;
      }
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id, updatedAt: existingUser.updatedAt, sessionVersion: existingUser.sessionVersion },
        data: {
          firstName,
          lastName,
          email,
          phone,
          role: nextRole,
          status: nextStatus,
          ...(nextRole !== existingUser.role || nextStatus !== existingUser.status || email !== existingUser.email ? { sessionVersion: { increment: 1 } } : {}),
        },
      });

      if (nextRole === UserRole.FACULTY) {
        await tx.facultyProfile.upsert({
          where: { userId: id },
          update: { departmentId },
          create: { userId: id, departmentId },
        });
        await tx.studentProfile.deleteMany({ where: { userId: id } });
        await tx.adminProfile.deleteMany({ where: { userId: id } });
      } else if (nextRole === UserRole.STUDENT) {
        await tx.studentProfile.upsert({
          where: { userId: id },
          update: { programId, yearLevel },
          create: { userId: id, programId, yearLevel },
        });
        await tx.facultyProfile.deleteMany({ where: { userId: id } });
        await tx.adminProfile.deleteMany({ where: { userId: id } });
      } else if (nextRole === UserRole.ADMIN) {
        await tx.adminProfile.upsert({
          where: { userId: id },
          update: {},
          create: { userId: id },
        });
        await tx.facultyProfile.deleteMany({ where: { userId: id } });
        await tx.studentProfile.deleteMany({ where: { userId: id } });
      }

      const updatedUser = await tx.user.findUniqueOrThrow({
        where: { id },
        include: {
          facultyProfile: { include: { department: true } },
          studentProfile: { include: { program: true } },
        },
      });
      if (isAdmin) {
        await recordRequiredAuditLog(tx, {
          actorUserId: req.user!.id,
          action: 'UPDATE',
          entityType: 'User',
          entityId: updatedUser.id,
          details: {
            label: `${updatedUser.firstName} ${updatedUser.lastName}`,
            previous: { role: existingUser.role, status: existingUser.status },
            next: { role: updatedUser.role, status: updatedUser.status },
          },
        });
        if (existingUser.role !== updatedUser.role) {
          await recordRequiredAuditLog(tx, {
            actorUserId: req.user!.id,
            action: 'ROLE_CHANGED',
            entityType: 'User',
            entityId: updatedUser.id,
            details: { label: `${updatedUser.firstName} ${updatedUser.lastName}`, previous: existingUser.role, next: updatedUser.role },
          });
        }
        if (existingUser.status !== updatedUser.status) {
          await recordRequiredAuditLog(tx, {
            actorUserId: req.user!.id,
            action: 'STATUS_CHANGED',
            entityType: 'User',
            entityId: updatedUser.id,
            details: { label: `${updatedUser.firstName} ${updatedUser.lastName}`, previous: existingUser.status, next: updatedUser.status },
          });
        }
      }
      if (!isAdmin && email !== existingUser.email) {
        await recordRequiredAuditLog(tx, { actorUserId: req.user!.id, action: 'SESSIONS_REVOKED', entityType: 'User', entityId: id, details: { reason: 'Email changed' } });
      }
      await accountStatusChanged(tx, updatedUser, existingUser.status);
      return updatedUser;
    });

    if (!updatedUser) {
      res.status(404).json({ error: 'User not found after update.' });
      return;
    }

    res.json({
      message: 'User updated successfully',
      user: mapUserToResponse(updatedUser),
    });
  } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') { res.status(409).json({ error: 'Account changed. Refresh and try again.' }); return; } sendError(error, res); }
});

router.post('/:id/password-reset', authenticateToken, authorizeRoles(UserRole.ADMIN), async (req,res) => {
  try {
    const user=await prisma.user.findUniqueOrThrow({where:{id:req.params.id},select:{email:true}});
    await requestPasswordReset(user.email,req.user!.id);
    res.json({message:'A reset link has been requested. If one was sent recently, ask the user to check their existing email.'});
  } catch(error) { sendError(error,res); }
});
// Update user status (Admin only)
router.patch(
  '/:id/status',
  authenticateToken,
  authorizeRoles(UserRole.ADMIN),
  async (req, res) => {
    try {
      const { id } = req.params;
      const requestedStatus = String(req.body.status ?? '').toUpperCase() as UserStatus;

      if (!Object.values(UserStatus).includes(requestedStatus)) {
        res.status(400).json({ error: 'Invalid status provided.' });
        return;
      }

      const user = await prisma.$transaction(async tx => {
        const previous = await tx.user.findUniqueOrThrow({ where: { id } });
        const user = await tx.user.update({
          where: { id, updatedAt: previous.updatedAt },
          data: { status: requestedStatus, sessionVersion: { increment: 1 } },
          select: {
            id: true,
            email: true,
            status: true,
            updatedAt: true,
          },
        });

        await recordRequiredAuditLog(tx, {
          actorUserId: req.user!.id,
          action: 'STATUS_CHANGED',
          entityType: 'User',
          entityId: user.id,
          details: { label: user.email, next: user.status },
        });
        await accountStatusChanged(tx, user, previous.status);
        return user;
      });
      res.json({
        message: 'User status updated successfully',
        user,
      });
    } catch (error) { sendError(error, res); }
  }
);

// End all login sessions without deactivating the account.
router.post('/:id/revoke-sessions', authenticateToken, authorizeRoles(UserRole.ADMIN), async (req, res) => {
  try {
    await prisma.$transaction(async tx => {
      const changed = await tx.user.updateMany({ where: { id: req.params.id }, data: { sessionVersion: { increment: 1 } } });
      if (!changed.count) throw new RequestActionError(404, 'User not found');
      await recordRequiredAuditLog(tx, { actorUserId: req.user!.id, action: 'SESSIONS_REVOKED', entityType: 'User', entityId: req.params.id });
    });
    res.json({ message: 'All sessions revoked. The user must sign in again.' });
  } catch (error) { sendError(error, res); }
});

// DELETE is retained for older clients, but it now retires rather than erases.
const retireAccountHandler: import('express').RequestHandler = async (req, res) => {
  try {
    const user = await retireAccount(prisma, req.params.id, req.user!.id);
    res.json({ message: 'Account deactivated. Request history and outstanding loans were preserved.', user });
  } catch (error) { sendError(error, res); }
};
router.post('/:id/retire', authenticateToken, authorizeRoles(UserRole.ADMIN), retireAccountHandler);
router.delete('/:id', authenticateToken, authorizeRoles(UserRole.ADMIN), retireAccountHandler);

export default router;
