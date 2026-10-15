import { Prisma } from '@prisma/client';
import { ValidationError } from './domainError';

export const DEFAULT_SYSTEM_BASELINE_ACADEMIC_YEAR = '2026-2027';

export const academicYearStart = (value: string): number => {
  const match = /^(\d{4})-(\d{4})$/.exec(value.trim());
  if (!match || Number(match[2]) !== Number(match[1]) + 1) {
    throw new ValidationError('Academic year must use the format YYYY-YYYY, with consecutive years.');
  }
  return Number(match[1]);
};

export const getSystemBaselineAcademicYear = (): string =>
  process.env.SYSTEM_BASELINE_ACADEMIC_YEAR?.trim() || DEFAULT_SYSTEM_BASELINE_ACADEMIC_YEAR;

export const assertAcademicYearAtOrAfterBaseline = (year: string): void => {
  const baseline = getSystemBaselineAcademicYear();
  if (academicYearStart(year) < academicYearStart(baseline)) {
    throw new ValidationError(`Academic years earlier than the system baseline (${baseline}) are not allowed.`);
  }
};

export const allowedAcademicYearWhere = (): Prisma.AcademicYearWhereInput => ({
  year: { gte: getSystemBaselineAcademicYear() },
});

export const requireAllowedAcademicYear = async (
  client: Prisma.TransactionClient,
  academicYearId: string,
  message = 'Select a valid academic year.'
) => {
  const academicYear = await client.academicYear.findUnique({ where: { id: academicYearId } });
  if (!academicYear) throw new ValidationError(message);
  assertAcademicYearAtOrAfterBaseline(academicYear.year);
  return academicYear;
};
