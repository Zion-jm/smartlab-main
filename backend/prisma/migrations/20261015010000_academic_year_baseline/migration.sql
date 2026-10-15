-- SmartLab begins managed academic history in 2026-2027.
-- Preserve any pre-deployment test/history rows and their relations, but do not
-- allow one of those rows to remain the active academic year after deployment.
UPDATE "academic_years"
SET "isActive" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "year" < '2026-2027'
  AND "isActive" = true;

-- Make the deployment baseline available for an administrator to activate.
-- A stable ID keeps this migration idempotent while the unique year constraint
-- remains the authoritative duplicate guard.
INSERT INTO "academic_years" ("id", "year", "isActive", "createdAt", "updatedAt")
VALUES ('system-baseline-2026-2027', '2026-2027', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("year") DO NOTHING;
