CREATE TABLE "InstallationSetup" (
  "id" TEXT NOT NULL DEFAULT 'installation',
  "completedAt" TIMESTAMP(3),
  "sessionHash" TEXT,
  "sessionExpiresAt" TIMESTAMP(3),
  "email" TEXT,
  "name" TEXT,
  "passwordHash" TEXT,
  "verificationHash" TEXT,
  "verificationExpiresAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "lastSentAt" TIMESTAMP(3),
  "windowStartedAt" TIMESTAMP(3),
  "sendCount" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "InstallationSetup_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InstallationSetup_singleton" CHECK ("id" = 'installation')
);
-- Upgrades must never expose setup on an existing installation, even without an admin.
INSERT INTO "InstallationSetup" ("id", "completedAt")
SELECT 'installation', CASE WHEN
  EXISTS (SELECT 1 FROM "users") OR EXISTS (SELECT 1 FROM "academic_years" WHERE NOT ("id"='system-baseline-2026-2027' AND "year"='2026-2027' AND "isActive"=false))
  OR EXISTS (SELECT 1 FROM "terms") OR EXISTS (SELECT 1 FROM "equipment")
  OR EXISTS (SELECT 1 FROM "buildings") OR EXISTS (SELECT 1 FROM "programs")
  OR EXISTS (SELECT 1 FROM "rooms") OR EXISTS (SELECT 1 FROM "subjects")
  OR EXISTS (SELECT 1 FROM "departments")
THEN CURRENT_TIMESTAMP ELSE NULL END;
