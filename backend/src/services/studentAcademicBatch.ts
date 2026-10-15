import { createHash, randomUUID } from 'node:crypto';
import { Prisma, StudentAcademicStatus, UserStatus } from '@prisma/client';
import { DomainError, ValidationError } from './domainError';
import { recordRequiredAuditLog } from './auditLogService';
import { accountStatusChanged } from './accountReactivationService';
import { requireAllowedAcademicYear } from './academicYearPolicy';

type BatchInput = { mode: 'SETUP' | 'PROMOTE'; academicYearId: string; sourceYearId?: string; studentIds: string[] };
const yearStart = (year: string) => /^\d{4}-\d{4}$/.test(year) && Number(year.slice(5)) === Number(year.slice(0,4)) + 1 ? Number(year.slice(0,4)) : NaN;

export async function getAcademicYearTransitionSummary(tx: Prisma.TransactionClient, academicYearId: string, sourceYearId?: string) {
  const destination = await requireAllowedAcademicYear(tx, academicYearId);
  const activeStudents = await tx.user.findMany({
    where: { role: 'STUDENT', status: UserStatus.ACTIVE },
    select: {
      id: true,
      studentAcademicRecords: { where: { academicYearId: { in: [academicYearId, ...(sourceYearId ? [sourceYearId] : [])] } }, select: { academicYearId: true, yearLevel: true, status: true, programId: true } },
    },
  });
  const configured = activeStudents.filter(student => student.studentAcademicRecords.some(record => record.academicYearId === academicYearId)).length;
  const currentGraduationReview = activeStudents.filter(student => student.studentAcademicRecords.some(record => record.academicYearId === academicYearId && record.yearLevel === 4 && ['ENROLLED', 'CONTINUING'].includes(record.status))).length;
  if (!sourceYearId) return { destination, activeStudents: activeStudents.length, configured, missing: activeStudents.length - configured, graduationReview: currentGraduationReview };

  const source = await requireAllowedAcademicYear(tx, sourceYearId);
  if (!source || yearStart(destination.year) !== yearStart(source.year) + 1) throw new ValidationError('Promotion requires consecutive academic years.');
  let continuing = 0, graduationReview = 0, protectedRecords = 0, manualReview = 0;
  for (const student of activeStudents) {
    if (student.studentAcademicRecords.some(record => record.academicYearId === academicYearId)) { protectedRecords++; continue; }
    const record = student.studentAcademicRecords.find(item => item.academicYearId === sourceYearId);
    if (!record || !record.programId || !record.yearLevel || !['ENROLLED', 'CONTINUING'].includes(record.status)) { manualReview++; continue; }
    if (record.yearLevel === 4) graduationReview++; else continuing++;
  }
  return { destination, source, activeStudents: activeStudents.length, configured, missing: activeStudents.length - configured, continuing, graduationReview, protectedRecords, manualReview };
}

export async function promoteStandardStudents(tx: Prisma.TransactionClient, input: { destinationYearId: string; sourceYearId: string; reason: string }, actorUserId: string) {
  if (!input.reason?.trim()) throw new ValidationError('A reason is required.');
  const summary = await getAcademicYearTransitionSummary(tx, input.destinationYearId, input.sourceYearId);
  const students = await tx.user.findMany({
    where: { role: 'STUDENT', status: UserStatus.ACTIVE, studentAcademicRecords: { some: { academicYearId: input.sourceYearId, yearLevel: { in: [1,2,3] }, status: { in: [StudentAcademicStatus.ENROLLED, StudentAcademicStatus.CONTINUING] } }, none: { academicYearId: input.destinationYearId } } },
    select: { id:true, firstName:true, lastName:true, studentAcademicRecords: { where: { academicYearId: input.sourceYearId }, take: 1 } },
  });
  const batchId = randomUUID();
  for (const student of students) {
    const source = student.studentAcademicRecords[0];
    const saved = await tx.studentAcademicRecord.create({ data: { studentId: student.id, academicYearId: input.destinationYearId, programId: source.programId, programCode: source.programCode, programName: source.programName, yearLevel: (source.yearLevel ?? 0) + 1, status: StudentAcademicStatus.CONTINUING } });
    await recordRequiredAuditLog(tx,{actorUserId,action:'CREATE',entityType:'StudentAcademicRecord',entityId:saved.id,details:{label:`${student.firstName} ${student.lastName} · ${summary.destination.year}`,batchId,mode:'PROMOTE_STANDARD',sourceYear:summary.source?.year,reason:input.reason.trim(),next:{programId:source.programId,yearLevel:saved.yearLevel,status:saved.status}}});
  }
  return { created: students.length, batchId, summary: await getAcademicYearTransitionSummary(tx, input.destinationYearId, input.sourceYearId) };
}
export async function previewAcademicBatch(tx: Prisma.TransactionClient, input: BatchInput) {
  if (!['SETUP', 'PROMOTE'].includes(input.mode) || typeof input.academicYearId !== 'string' || !Array.isArray(input.studentIds) || !input.studentIds.length || input.studentIds.length > 100 || input.studentIds.some(id => typeof id !== 'string') || new Set(input.studentIds).size !== input.studentIds.length) throw new ValidationError('Select 1–100 distinct students and a destination year.');
  const destination = await requireAllowedAcademicYear(tx, input.academicYearId, 'Select a valid destination year.');
  const source = input.mode === 'PROMOTE' && typeof input.sourceYearId === 'string' ? await requireAllowedAcademicYear(tx, input.sourceYearId) : null;
  if (input.mode === 'PROMOTE') {
    if (!source || yearStart(destination.year) !== yearStart(source.year) + 1) throw new ValidationError('Promotion requires consecutive academic years, for example 2026-2027 to 2027-2028.');
  }
  const students = await tx.user.findMany({ where: { id: { in: input.studentIds } }, select: { id:true, firstName:true,lastName:true,email:true,role:true,status:true,studentProfile:true,studentAcademicRecords:{where:{academicYearId:{in:[destination.id,...(source?[source.id]:[])]}}} } });
  if (students.length !== input.studentIds.length) throw new ValidationError('A selected student no longer exists.');
  return { destination, source, rows: students.map(student => {
    const existing = student.studentAcademicRecords.find(row => row.academicYearId === destination.id);
    const standing = source ? student.studentAcademicRecords.find(row => row.academicYearId === source.id) : student.studentProfile;
    const eligibleStatus = !source || (standing && 'status' in standing && ['ENROLLED','CONTINUING'].includes(standing.status));
    const blocked = existing ? 'Destination record already exists' : student.role !== 'STUDENT' || student.status !== 'ACTIVE' ? 'Requires an active student account' : !standing?.programId || !standing.yearLevel || !eligibleStatus ? 'Source standing requires individual review' : null;
    const graduating = input.mode === 'PROMOTE' && standing?.yearLevel === 4;
    const fingerprint = createHash('sha256').update(JSON.stringify({mode:input.mode,destination,source,student})).digest('hex');
    return { studentId:student.id,name:`${student.firstName} ${student.lastName}`,email:student.email,blocked,fingerprint,sourceYearLevel:standing?.yearLevel ?? null,
      programId:standing?.programId ?? '',yearLevel:graduating ? null : standing?.yearLevel ? standing.yearLevel + (input.mode === 'PROMOTE' ? 1 : 0) : null,
      status:graduating ? 'GRADUATED' : input.mode === 'PROMOTE' ? 'CONTINUING' : 'ENROLLED',requiresGraduationReview:graduating };
  }) };
}
export async function commitAcademicBatch(tx: Prisma.TransactionClient, input: BatchInput & { rows: {studentId:string;fingerprint:string;programId:string;yearLevel:number|null;status:StudentAcademicStatus;archiveAccount?:boolean}[];reason:string }, actorUserId:string) {
  if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 500 || !Array.isArray(input.rows) || !input.rows.length || input.rows.some(row => !row || typeof row !== 'object')) throw new ValidationError('Selected rows and a reason of at most 500 characters are required.');
  const preview = await previewAcademicBatch(tx,{...input,studentIds:input.rows.map(row=>row.studentId)});
  const batchId=randomUUID();
  for(const row of input.rows) {
    const current=preview.rows.find(item=>item.studentId===row.studentId)!;
    if(current.blocked || current.fingerprint !== row.fingerprint) throw new DomainError(409,'A selected record changed or already exists. Reload the preview; no records were saved.');
    if(!Object.values(StudentAcademicStatus).includes(row.status) || (row.yearLevel !== null && (!Number.isInteger(row.yearLevel)||row.yearLevel<1||row.yearLevel>4)) || (['ENROLLED','CONTINUING'].includes(row.status)&&row.yearLevel===null)) throw new ValidationError('Review each selected status and year level (1–4).');
    if (row.archiveAccount && row.status !== StudentAcademicStatus.GRADUATED) throw new ValidationError('Only a student confirmed as graduated can be archived in this batch.');
    if(typeof row.programId !== 'string') throw new ValidationError('Select a valid program.');
    const program=await tx.program.findUnique({where:{id:row.programId}});
    if(!program) throw new ValidationError('Select a valid program.');
    const saved=await tx.studentAcademicRecord.create({data:{studentId:row.studentId,academicYearId:input.academicYearId,programId:program.id,programCode:program.code,programName:program.name,yearLevel:row.yearLevel,status:row.status}});
    await recordRequiredAuditLog(tx,{actorUserId,action:'CREATE',entityType:'StudentAcademicRecord',entityId:saved.id,details:{label:`${current.name} · ${preview.destination.year}`,batchId,mode:input.mode,sourceYear:preview.source?.year ?? null,reason:input.reason.trim(),next:{programId:program.id,yearLevel:row.yearLevel,status:row.status}}});
    if (row.archiveAccount) {
      const previous = await tx.user.findUniqueOrThrow({ where: { id: row.studentId }, select: { id:true,email:true,status:true,updatedAt:true } });
      if (previous.status === UserStatus.ACTIVE) {
        const archived = await tx.user.update({ where: { id: row.studentId, updatedAt: previous.updatedAt }, data: { status: UserStatus.DEACTIVATED, sessionVersion: { increment: 1 } }, select: { id:true,email:true,status:true,updatedAt:true } });
        await recordRequiredAuditLog(tx,{actorUserId,action:'RETIRE',entityType:'User',entityId:archived.id,details:{label:archived.email,batchId,reason:`Graduation confirmed for ${preview.destination.year}`,previous:previous.status,next:archived.status}});
        await accountStatusChanged(tx, archived, previous.status);
      }
    }
  }
  return {created:input.rows.length,batchId};
}
