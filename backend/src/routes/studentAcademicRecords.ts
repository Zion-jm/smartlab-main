import { Router } from 'express';
import { Prisma, StudentAcademicStatus, UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { sendError } from '../middleware/errors';
import { DomainError, ValidationError } from '../services/domainError';
import { recordRequiredAuditLog } from '../services/auditLogService';

const router = Router();
router.use(authenticateToken);
router.get('/me', authorizeRoles(UserRole.STUDENT), async (req, res) => {
  try {
    const year = await prisma.academicYear.findFirst({ where: { isActive: true } });
    const [record, count] = await Promise.all([
      year ? prisma.studentAcademicRecord.findUnique({ where: { studentId_academicYearId: { studentId: req.user!.id, academicYearId: year.id } } }) : null,
      prisma.studentAcademicRecord.count({ where: { studentId: req.user!.id } }),
    ]);
    res.json({ record, managed: count > 0 });
  } catch (error) { sendError(error, res); }
});
router.use(authorizeRoles(UserRole.ADMIN));
router.get('/', async (req, res) => {
  try {
    const academicYearId = String(req.query.academicYearId ?? '');
    if (!academicYearId || !await prisma.academicYear.findUnique({ where: { id: academicYearId } })) throw new ValidationError('Select an existing academic year.');
    const search = String(req.query.search ?? '').trim().slice(0, 100);
    const page = Math.max(1, Math.min(100000, Number(req.query.page) || 1));
    if (!Number.isInteger(page)) throw new ValidationError('Invalid page.');
    const where: Prisma.UserWhereInput = { AND: [
      { OR: [{ role: UserRole.STUDENT }, { studentAcademicRecords: { some: { academicYearId } } }] },
      ...(search ? [{ OR: ['firstName', 'lastName', 'email'].map(field => ({ [field]: { contains: search, mode: 'insensitive' } })) }] : []),
    ] };
    const [total, students, programs] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({ where, orderBy: [{ lastName: 'asc' }, { id: 'asc' }], skip: (page - 1) * 25, take: 25,
        select: { id: true, firstName: true, lastName: true, email: true, status: true,
          studentProfile: { select: { programId: true, yearLevel: true } },
          studentAcademicRecords: { where: { academicYearId } },
        } }),
      prisma.program.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
    ]);
    res.json({ total, page, pageSize: 25, students, programs });
  } catch (error) { sendError(error, res); }
});
router.post('/', async (req, res) => {
  try {
    const { studentId, academicYearId, programId, status, yearLevel, expectedUpdatedAt, reason } = req.body;
    if (![studentId, academicYearId, programId, reason].every(value => typeof value === 'string' && value.trim())) throw new ValidationError('Student, academic year, program and reason are required.');
    if (!Object.values(StudentAcademicStatus).includes(status)) throw new ValidationError('Invalid academic status.');
    if (yearLevel !== null && (!Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 4)) throw new ValidationError('Year level must be 1–4 or empty for graduated/withdrawn students.');
    if (['ENROLLED', 'CONTINUING'].includes(status) && yearLevel === null) throw new ValidationError('Enrolled and continuing students require a year level.');
    const record = await prisma.$transaction(async tx => {
      const [student, year, program, previous] = await Promise.all([
        tx.user.findUnique({ where: { id: studentId } }), tx.academicYear.findUnique({ where: { id: academicYearId } }),
        tx.program.findUnique({ where: { id: programId } }),
        tx.studentAcademicRecord.findUnique({ where: { studentId_academicYearId: { studentId, academicYearId } } }),
      ]);
      if (!student || (!previous && student.role !== UserRole.STUDENT) || !year || !program) throw new ValidationError('Select a valid student, year and program.');
      if (previous ? expectedUpdatedAt !== previous.updatedAt.toISOString() : expectedUpdatedAt != null) throw new DomainError(409, 'This academic record changed. Reload before saving.');
      const data = { programId, yearLevel, status,
        programCode: previous && previous.programId === programId ? previous.programCode : program.code,
        programName: previous && previous.programId === programId ? previous.programName : program.name };
      const saved = previous ? await tx.studentAcademicRecord.update({ where: { id: previous.id }, data }) : await tx.studentAcademicRecord.create({ data: { studentId, academicYearId, ...data } });
      await recordRequiredAuditLog(tx, { actorUserId: req.user!.id, action: previous ? 'UPDATE' : 'CREATE', entityType: 'StudentAcademicRecord', entityId: saved.id,
        details: { label: `${student.firstName} ${student.lastName} · ${year.year}`, reason: reason.trim().slice(0, 500), previous, next: saved } });
      return saved;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.json({ record });
  } catch (error) { sendError(error, res); }
});
export default router;
