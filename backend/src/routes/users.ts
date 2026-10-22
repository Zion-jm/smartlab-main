import { randomBytes } from 'node:crypto';
import { invitationOrigin, normalizeInvitationEmail, issueInvitation, manageInvitation, isPendingActivation, usableActivation } from '../services/accountInvitationService';
import { assertAccountDeactivationAllowed } from '../services/adminAccessProtection';
import { inventoryTransaction } from '../services/inventoryTransaction';
import { currentStudentAcademic } from '../services/currentStudentAcademic';
import { ValidationError } from '../services/domainError';
import { allowedAcademicYearWhere } from '../services/academicYearPolicy';
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

router.get('/:id/invitation', authenticateToken, authorizeRoles(UserRole.ADMIN), async (req, res) => {
  try {
    const invitation = await prisma.accountInvitation.findFirst({ where: { userId: req.params.id }, orderBy: { createdAt: 'desc' }, select: { id: true, expiresAt: true, usedAt: true, revokedAt: true } });
    const mail = invitation ? await prisma.emailOutbox.findUnique({ where: { eventKey: 'invitation:' + invitation.id }, select: { status: true, sentAt: true } }) : null;
    res.setHeader('Cache-Control', 'no-store');
    res.json({ invitation: invitation ? { expiresAt: invitation.expiresAt, usedAt: invitation.usedAt, revokedAt: invitation.revokedAt, delivery: mail?.status ?? 'PENDING' } : null });
  } catch (error) { sendError(error, res); }
});
for (const action of ['resend', 'email', 'cancel', 'reinvite'] as const) {
  router.post('/:id/invitation/' + action, authenticateToken, authorizeRoles(UserRole.ADMIN), async (req, res) => {
    try { await manageInvitation(req.params.id, req.user!.id, action, req.body.email); res.json({ message: action === 'cancel' ? 'Invitation cancelled.' : 'Invitation queued. The user must complete email setup before signing in.' }); }
    catch (error) { sendError(error, res); }
  });
}

router.get('/stats/overview', authenticateToken, authorizeRoles(UserRole.ADMIN), async (_req, res) => {
  try {
    const [activeStudents, activeFaculty, administrators, archivedStudents, archivedFaculty, archivedAdministrators, pendingReactivation] = await Promise.all([
      prisma.user.count({ where: { role: UserRole.STUDENT, status: UserStatus.ACTIVE, activationState: usableActivation } }),
      prisma.user.count({ where: { role: UserRole.FACULTY, status: UserStatus.ACTIVE, activationState: usableActivation } }),
      prisma.user.count({ where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE, activationState: usableActivation } }),
      prisma.user.count({ where: { role: UserRole.STUDENT, status: UserStatus.DEACTIVATED, activationState: usableActivation } }),
      prisma.user.count({ where: { role: UserRole.FACULTY, status: UserStatus.DEACTIVATED, activationState: usableActivation } }),
      prisma.user.count({ where: { role: UserRole.ADMIN, status: UserStatus.DEACTIVATED, activationState: usableActivation } }),
      prisma.reactivationRequest.count({ where: { status: 'PENDING' } }),
    ]);
    res.json({ activeStudents, activeFaculty, administrators, archivedAccounts: archivedStudents + archivedFaculty + archivedAdministrators,
      archivedBreakdown: { students: archivedStudents, faculty: archivedFaculty, administrators: archivedAdministrators }, pendingReactivation });
  } catch (error) { sendError(error, res); }
});


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

type UserWithProfiles = Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'role' | 'status' | 'activationState'> & {
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
    activation_state: user.activationState,
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
        if (status === 'PENDING' || status === 'CANCELLED') where.activationState = status;
        else { where.status = status; where.activationState = usableActivation; }
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
          id: true, email: true, firstName: true, lastName: true, role: true, status: true, activationState: true,
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

      const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true, ...allowedAcademicYearWhere() } });
      const records = activeYear ? await prisma.studentAcademicRecord.findMany({ where: { academicYearId: activeYear.id, studentId: { in: users.filter(user => user.role === 'STUDENT').map(user => user.id) } } }) : [];
      const byStudent = new Map(records.map(record => [record.studentId, record]));
      const formatted = users.map(user => {
        const response = mapUserToResponse(user);
        if (user.role !== 'STUDENT') return response;
        const record = byStudent.get(user.id);
        return { ...response, program_id: record?.programId ?? null, program_name: record?.programName ?? null, program_code: record?.programCode ?? null, program: record?.programName ?? null, year_level: record?.yearLevel ?? null };
      });

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
        gmail: emailInput,
        password,
        role_id,
        status_id,
        department_id,
        program_id,
        year,
        year_level,
      } = req.body;

      if (!emailInput || role_id == null || password !== undefined || status_id !== undefined) {
        res.status(400).json({ error: 'Provide email and role only. New accounts are activated through an email invitation, not an administrator password.' });
        return;
      }

      const origin = invitationOrigin();
      const gmail = normalizeInvitationEmail(emailInput);
      if (typeof gmail !== 'string' || gmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gmail)) { res.status(400).json({ error: 'Enter a valid email address.' }); return; }
      const role = ROLE_ID_TO_VALUE[Number(role_id)];
      const status = UserStatus.DEACTIVATED;

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

      const existingUser = await prisma.user.findFirst({ where: { email: { equals: gmail, mode: 'insensitive' } } });
      if (existingUser) {
        res.status(409).json({ error: 'Email is already registered.' });
        return;
      }

      if (!first_name || !last_name) {
        res.status(400).json({ error: 'First name and last name are required.' });
        return;
      }

      const passwordHash = await bcrypt.hash(randomBytes(48).toString('hex'), 12);

      const createdUser = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: gmail,
            passwordHash,
            activationState: 'PENDING',
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
          const academicYear = await tx.academicYear.findFirst({ where: { isActive: true, ...allowedAcademicYearWhere() } });
          if (!academicYear) throw new ValidationError('Activate an academic year before creating a student account.');
          const program = await tx.program.findUnique({ where: { id: program_id } });
          const level = Number(year ?? year_level);
          if (!program || !Number.isInteger(level) || level < 1 || level > 4) throw new ValidationError('Select a valid program and year level (1–4).');
          const initialRecord = await tx.studentAcademicRecord.create({ data: { studentId: user.id, academicYearId: academicYear.id, programId: program.id, programCode: program.code, programName: program.name, yearLevel: level, status: 'ENROLLED' } });
          await recordRequiredAuditLog(tx, { actorUserId: req.user!.id, action: 'CREATE', entityType: 'StudentAcademicRecord', entityId: initialRecord.id, details: { studentId: user.id, academicYearId: academicYear.id, yearLevel: level, reason: 'Initial record at account creation' } });
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
        await issueInvitation(tx, user, req.user!.id, origin);
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
        activation_state: savedUser?.activationState,
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
        activationState: true,
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

    if (isPendingActivation(existingUser.activationState)) { res.status(409).json({ error: 'Use the invitation actions for this account.' }); return; }
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

    const nextRole = existingUser.role;
    // Validate every supplied alias, including conflicting aliases, before any write.
    for (const key of ['role_id', 'roleId', 'role']) {
      if (!Object.prototype.hasOwnProperty.call(req.body, key)) continue;
      const value = req.body[key];
      const requestedRole = key === 'role'
        ? (typeof value === 'string' ? value.toUpperCase() : undefined)
        : (typeof value === 'number' || typeof value === 'string' ? ROLE_ID_TO_VALUE[Number(value)] : undefined);
      if (!requestedRole || !Object.values(UserRole).includes(requestedRole as UserRole)) {
        throw new ValidationError('Invalid role provided.');
      }
      if (requestedRole !== existingUser.role) {
        throw new ValidationError('Account roles cannot be changed after creation.');
      }
    }
    let nextStatus = existingUser.status;

    if (isAdmin) {
      const statusIdInput = req.body.status_id ?? req.body.statusId;

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
    if (['program_id','programId','program','year','year_level','yearLevel','academicStatus','standing'].some(key => Object.prototype.hasOwnProperty.call(req.body,key))) throw new ValidationError('Edit academic details in Student Records for the relevant academic year.');
    if (isAdmin) {
      if (nextRole === UserRole.FACULTY && !departmentId) {
        res.status(400).json({ error: 'Department is required for faculty accounts.' });
        return;
      }


    }

    const updatedUser = await inventoryTransaction(prisma, async (tx) => {
      await assertAccountDeactivationAllowed(tx, id, req.user!.id, nextStatus);
      await tx.user.update({
        where: { id, updatedAt: existingUser.updatedAt, sessionVersion: existingUser.sessionVersion },
        data: {
          firstName,
          lastName,
          email,
          phone,
          status: nextStatus,
          ...(nextStatus !== existingUser.status || email !== existingUser.email ? { sessionVersion: { increment: 1 } } : {}),
          ...(email !== existingUser.email ? { emailVerifiedAt: null } : {}),
        },
      });

      if (nextRole === UserRole.FACULTY) {
        await tx.facultyProfile.upsert({
          where: { userId: id },
          update: { departmentId },
          create: { userId: id, departmentId },
        });
      } else if (nextRole === UserRole.STUDENT) {
        await tx.studentProfile.upsert({
          where: { userId: id },
          update: {},
          create: { userId: id },
        });
      } else if (nextRole === UserRole.ADMIN) {
        await tx.adminProfile.upsert({
          where: { userId: id },
          update: {},
          create: { userId: id },
        });
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
      user: { ...mapUserToResponse(updatedUser), ...(updatedUser.role === 'STUDENT' ? await (async () => {
        const current = await currentStudentAcademic(prisma, updatedUser.id);
        return { program_id: current.programId, program_name: current.program, program: current.program, program_code: null, year_level: current.yearLevel };
      })() : {}) },
    });
  } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') { res.status(409).json({ error: 'Account changed. Refresh and try again.' }); return; } sendError(error, res); }
});

router.post('/:id/password-reset', authenticateToken, authorizeRoles(UserRole.ADMIN), async (req,res) => {
  try {
    const user=await prisma.user.findUniqueOrThrow({where:{id:req.params.id},select:{email:true,activationState:true}});
    if (isPendingActivation(user.activationState)) throw new ValidationError('Use invitation actions to send this user a setup link.');
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

      const user = await inventoryTransaction(prisma, async tx => {
        await assertAccountDeactivationAllowed(tx, id, req.user!.id, requestedStatus);
        const previous = await tx.user.findUniqueOrThrow({ where: { id } });
        if (isPendingActivation(previous.activationState)) throw new ValidationError('Use the invitation actions for this account.');
        const user = await tx.user.update({
          where: { id, updatedAt: previous.updatedAt },
          data: { status: requestedStatus, sessionVersion: { increment: 1 } },
          select: {
            id: true,
            email: true,
            status: true,
        activationState: true,
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
