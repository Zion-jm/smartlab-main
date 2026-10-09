BEGIN;
-- Existing duplicates must be reviewed before deployment; do not delete linked records.
DROP INDEX "rooms_name_only_normalized_key";
CREATE UNIQUE INDEX "rooms_name_normalized_key" ON "rooms" ("buildingId", lower(btrim(regexp_replace("name", '[[:space:]]+', ' ', 'g')))) WHERE "buildingId" IS NOT NULL AND "name" IS NOT NULL;
CREATE UNIQUE INDEX "rooms_unassigned_number_key" ON "rooms" (lower(btrim(regexp_replace("roomNumber", '[[:space:]]+', ' ', 'g')))) WHERE "buildingId" IS NULL AND "roomNumber" IS NOT NULL;
CREATE UNIQUE INDEX "rooms_unassigned_name_key" ON "rooms" (lower(btrim(regexp_replace("name", '[[:space:]]+', ' ', 'g')))) WHERE "buildingId" IS NULL AND "name" IS NOT NULL;
COMMIT;
