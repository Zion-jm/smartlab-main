import { Prisma } from '@prisma/client';
import { allowedAcademicYearWhere } from './academicYearPolicy';
export async function currentStudentAcademic(client: Prisma.TransactionClient, studentId: string) {
 const year = await client.academicYear.findFirst({ where: { isActive: true, ...allowedAcademicYearWhere() } });
 const record = year ? await client.studentAcademicRecord.findUnique({ where: { studentId_academicYearId: { studentId, academicYearId: year.id } } }) : null;
 return { programId: record?.programId ?? null, program: record?.programName ?? null, yearLevel: record?.yearLevel ?? null };
}
