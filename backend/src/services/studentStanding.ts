import { Prisma } from '@prisma/client';
import { ValidationError } from './domainError';

/** Once managed, a student needs an explicit record for the requested academic year. */
export async function studentStanding(client: Prisma.TransactionClient, studentId: string, academicYearId: string) {
  const record = await client.studentAcademicRecord.findUnique({ where: { studentId_academicYearId: { studentId, academicYearId } } });
  if (record) {
    if (!['ENROLLED', 'CONTINUING'].includes(record.status) || record.yearLevel === null) throw new ValidationError('You are not enrolled for this academic year. Contact an administrator.');
    return { programId: record.programId, yearLevel: record.yearLevel };
  }
  if (await client.studentAcademicRecord.count({ where: { studentId } })) throw new ValidationError('Your academic record for this year has not been configured. Contact an administrator.');
  // Preserve existing access during the explicit, administrator-reviewed migration.
  const profile = await client.studentProfile.findUnique({ where: { userId: studentId }, select: { programId: true, yearLevel: true } });
  if (!profile?.programId || profile.yearLevel === null) throw new ValidationError('Your student program and year level are not configured.');
  return { programId: profile.programId, yearLevel: profile.yearLevel };
}
