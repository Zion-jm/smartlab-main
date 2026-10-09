BEGIN;
LOCK TABLE "borrow_requests" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "borrow_requests" WHERE "requestType"::text = 'LEGACY') THEN
    RAISE EXCEPTION 'Cannot remove LEGACY: legacy requests still exist. Review records before retrying; no records were changed.';
  END IF;
END $$;
ALTER TABLE "borrow_requests" ALTER COLUMN "requestType" DROP DEFAULT;
ALTER TYPE "BorrowRequestType" RENAME TO "BorrowRequestType_old";
CREATE TYPE "BorrowRequestType" AS ENUM ('LABORATORY', 'EQUIPMENT');
ALTER TABLE "borrow_requests" ALTER COLUMN "requestType" TYPE "BorrowRequestType" USING "requestType"::text::"BorrowRequestType";
DROP TYPE "BorrowRequestType_old";
COMMIT;
