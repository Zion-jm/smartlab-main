-- Align database defaults and referential actions with schema.prisma.
-- Preserve policy content, return records, and the existing singleton CHECK.
BEGIN;

ALTER TABLE "borrowing_policy" ALTER COLUMN "id" SET DEFAULT 'default';

ALTER TABLE "equipment_returns"
  DROP CONSTRAINT "equipment_returns_borrowRequestId_fkey";
ALTER TABLE "equipment_returns"
  ADD CONSTRAINT "equipment_returns_borrowRequestId_fkey"
  FOREIGN KEY ("borrowRequestId") REFERENCES "borrow_requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
