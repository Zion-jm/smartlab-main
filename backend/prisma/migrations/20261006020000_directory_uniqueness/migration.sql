BEGIN;
-- Resolve existing duplicates before applying. No records are merged or deleted.
CREATE UNIQUE INDEX "buildings_name_normalized_key" ON "buildings" (lower(btrim(regexp_replace("name", '[[:space:]]+', ' ', 'g'))));
CREATE UNIQUE INDEX "departments_name_normalized_key" ON "departments" (lower(btrim(regexp_replace("name", '[[:space:]]+', ' ', 'g'))));
CREATE UNIQUE INDEX "programs_code_normalized_key" ON "programs" (lower(btrim(regexp_replace("code", '[[:space:]]+', ' ', 'g'))));
CREATE UNIQUE INDEX "programs_name_normalized_key" ON "programs" (lower(btrim(regexp_replace("name", '[[:space:]]+', ' ', 'g'))));
CREATE UNIQUE INDEX "rooms_number_normalized_key" ON "rooms" ("buildingId", lower(btrim(regexp_replace("roomNumber", '[[:space:]]+', ' ', 'g')))) WHERE "buildingId" IS NOT NULL AND "roomNumber" IS NOT NULL;
CREATE UNIQUE INDEX "rooms_name_only_normalized_key" ON "rooms" ("buildingId", lower(btrim(regexp_replace("name", '[[:space:]]+', ' ', 'g')))) WHERE "buildingId" IS NOT NULL AND ("roomNumber" IS NULL OR btrim("roomNumber") = '');
COMMIT;
