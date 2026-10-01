import { Prisma, UserRole } from '@prisma/client';

export type AcademicPeriodRecord = {
  academicYear: {
    id: string;
    year: string;
    isActive: boolean;
  };
  term: {
    id: string;
    name: string;
    isActive: boolean;
  };
  label: string;
};

export type AcademicPeriodSelection = {
  academicYearId?: string;
  termId?: string;
};

const EMPTY_PERIOD_ID = '__no_active_academic_period__';

const cleanQueryValue = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed !== 'ALL' ? trimmed : undefined;
};

export const serializeAcademicPeriod = (
  academicYear: AcademicPeriodRecord['academicYear'] | null,
  term: AcademicPeriodRecord['term'] | null
): AcademicPeriodRecord | null =>
  academicYear && term
    ? {
        academicYear,
        term,
        label: `${academicYear.year} · ${term.name}`,
      }
    : null;

export const getActiveAcademicPeriod = async (
  prisma: Prisma.TransactionClient
): Promise<AcademicPeriodRecord | null> => {
  const [academicYear, term] = await Promise.all([
    prisma.academicYear.findFirst({
      where: { isActive: true },
      select: { id: true, year: true, isActive: true },
    }),
    prisma.term.findFirst({
      where: { isActive: true },
      select: { id: true, name: true, isActive: true },
    }),
  ]);

  return serializeAcademicPeriod(academicYear, term);
};

/**
 * Resolve the period used by a read or write operation.
 *
 * Ordinary users are always restricted to the active period. Admins may
 * request a historical year and/or term explicitly; omitting both still
 * means the active period. This keeps the default safe on every endpoint.
 */
export const resolveAcademicPeriodSelection = async (
  prisma: Prisma.TransactionClient,
  input: AcademicPeriodSelection,
  role?: UserRole
): Promise<AcademicPeriodSelection> => {
  const requestedYearId = cleanQueryValue(input.academicYearId);
  const requestedTermId = cleanQueryValue(input.termId);

  if (role === UserRole.ADMIN && (requestedYearId || requestedTermId)) {
    return {
      ...(requestedYearId ? { academicYearId: requestedYearId } : {}),
      ...(requestedTermId ? { termId: requestedTermId } : {}),
    };
  }

  const active = await getActiveAcademicPeriod(prisma);
  return active
    ? {
        academicYearId: active.academicYear.id,
        termId: active.term.id,
      }
    : {
        academicYearId: EMPTY_PERIOD_ID,
        termId: EMPTY_PERIOD_ID,
      };
};

export const academicPeriodWhere = (selection: AcademicPeriodSelection) => ({
  ...(selection.academicYearId ? { academicYearId: selection.academicYearId } : {}),
  ...(selection.termId ? { termId: selection.termId } : {}),
});

export const getPeriodSelectionFromQuery = (query: Record<string, unknown>): AcademicPeriodSelection => ({
  academicYearId: cleanQueryValue(query.academicYearId),
  termId: cleanQueryValue(query.termId),
});