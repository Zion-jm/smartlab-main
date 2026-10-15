-- Remove the pre-deployment 2025-2026 test period and its test-only data.
-- Account, directory, equipment, room, and term records are not affected.
DELETE FROM "lab_schedules"
WHERE "academicYearId" IN (
  SELECT "id" FROM "academic_years" WHERE "year" = '2025-2026'
);

-- Request items and linked notifications use ON DELETE CASCADE.
DELETE FROM "borrow_requests"
WHERE "academicYearId" IN (
  SELECT "id" FROM "academic_years" WHERE "year" = '2025-2026'
);

DELETE FROM "student_academic_records"
WHERE "academicYearId" IN (
  SELECT "id" FROM "academic_years" WHERE "year" = '2025-2026'
);

DELETE FROM "academic_years"
WHERE "year" = '2025-2026';
