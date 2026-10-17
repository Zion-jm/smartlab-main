import { createHash } from 'node:crypto';
import { Prisma, UserRole } from '@prisma/client';
// Only opaque revisions leave this endpoint; no audit details, names or request IDs.
export async function dataRevision(tx: Prisma.TransactionClient, actor: {id:string;role:UserRole}) {
  const scope = actor.role === 'ADMIN' ? Prisma.sql`TRUE` : Prisma.sql`(
    a."entityType" IN ('BorrowingPolicy','Equipment','LabSchedule','AcademicPeriod','AcademicDirectory','Room','Subject','Program','Department','Building')
    OR (a."entityType"='User' AND a."entityId"=${actor.id})
    OR (a."entityType"='StudentAcademicRecord' AND EXISTS (SELECT 1 FROM student_academic_records s WHERE s.id=a."entityId" AND s."studentId"=${actor.id}))
    OR (a."entityType"='BorrowRequest' AND EXISTS (SELECT 1 FROM borrow_requests r LEFT JOIN faculty_profiles f ON f.id=r."facultyId" WHERE r.id=a."entityId" AND (r."requestedBy"=${actor.id} OR f."userId"=${actor.id})))
    OR (a."entityType"='BorrowRequest' AND a.action IN ('APPROVE','BORROW','RETURN','CANCEL'))
  )`;
  // Count catches late commits whose creation timestamp precedes the last poll.
  const rows = await tx.$queryRaw<{count:bigint; latest:string|null}[]>`SELECT COUNT(*) AS count, MAX(a.id) AS latest FROM audit_logs a
    WHERE a."actorUserId" <> ${actor.id} AND a."entityType" IN ('BorrowRequest','BorrowingPolicy','Equipment','LabSchedule','AcademicPeriod','User','StudentAcademicRecord','AcademicDirectory','Room','Subject','Program','Department','Building')
    AND a.action NOT IN ('LOGIN','LOGOUT','PASSWORD_RESET_REQUESTED','PASSWORD_RESET','PASSWORD_CHANGED') AND ${scope}`;
  return createHash('sha256').update(`${rows[0].count}:${rows[0].latest ?? ''}`).digest('hex');
}
