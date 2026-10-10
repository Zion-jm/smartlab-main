CREATE TYPE "StudentAcademicStatus" AS ENUM ('ENROLLED', 'CONTINUING', 'GRADUATED', 'WITHDRAWN');
CREATE TABLE "student_academic_records" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "studentId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "academicYearId" TEXT NOT NULL REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "programId" TEXT NOT NULL REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "programCode" TEXT NOT NULL, "programName" TEXT NOT NULL,
 "yearLevel" INTEGER, "status" "StudentAcademicStatus" NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "student_academic_level_valid" CHECK (("yearLevel" IS NULL OR "yearLevel" BETWEEN 1 AND 4) AND ("status" NOT IN ('ENROLLED', 'CONTINUING') OR "yearLevel" IS NOT NULL))
);
CREATE UNIQUE INDEX "student_academic_records_studentId_academicYearId_key" ON "student_academic_records"("studentId", "academicYearId");
CREATE INDEX "student_academic_records_academicYearId_status_idx" ON "student_academic_records"("academicYearId", "status");
-- No automatic backfill: an administrator must confirm the year to which each profile belongs.
