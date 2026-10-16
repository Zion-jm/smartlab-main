ALTER TABLE "borrow_request_items" ADD COLUMN "returnedGood" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "returnedDamaged" INTEGER NOT NULL DEFAULT 0;
-- Historical completed loans were returned using the previous all-good workflow.
UPDATE "borrow_request_items" i SET "returnedGood" = i.quantity FROM "borrow_requests" r WHERE i."borrowRequestId" = r.id AND r.status = 'RETURNED';
ALTER TABLE "borrow_request_items" ADD CONSTRAINT "return_quantities_valid" CHECK ("returnedGood" >= 0 AND "returnedDamaged" >= 0 AND "returnedGood" + "returnedDamaged" <= quantity);
CREATE TABLE "equipment_returns" (
 "id" TEXT PRIMARY KEY, "submissionId" TEXT NOT NULL UNIQUE, "borrowRequestId" TEXT NOT NULL REFERENCES "borrow_requests"("id") ON DELETE CASCADE,
 "actorId" TEXT NOT NULL, "actorName" TEXT NOT NULL, "notes" TEXT NOT NULL, "lines" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "equipment_returns_request_date" ON "equipment_returns"("borrowRequestId", "createdAt");
