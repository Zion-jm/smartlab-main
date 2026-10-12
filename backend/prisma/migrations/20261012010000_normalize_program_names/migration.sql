-- Normalize program names in the directory and in academic-record snapshots.
UPDATE "programs"
SET "name" = CASE "code"
  WHEN 'BSA' THEN 'Bachelor of Science in Accountancy'
  WHEN 'BSIT' THEN 'Bachelor of Science in Information Technology'
  WHEN 'BSEE' THEN 'Bachelor of Science in Electronics Engineering'
  WHEN 'BSBIO' THEN 'Bachelor of Science in Biology'
  ELSE "name"
END,
"updatedAt" = CURRENT_TIMESTAMP
WHERE "code" IN ('BSA', 'BSIT', 'BSEE', 'BSBIO');

UPDATE "student_academic_records"
SET "programName" = CASE "programCode"
  WHEN 'BSA' THEN 'Bachelor of Science in Accountancy'
  WHEN 'BSIT' THEN 'Bachelor of Science in Information Technology'
  WHEN 'BSEE' THEN 'Bachelor of Science in Electronics Engineering'
  WHEN 'BSBIO' THEN 'Bachelor of Science in Biology'
  ELSE "programName"
END,
"updatedAt" = CURRENT_TIMESTAMP
WHERE "programCode" IN ('BSA', 'BSIT', 'BSEE', 'BSBIO');
