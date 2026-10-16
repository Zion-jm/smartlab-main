ALTER TABLE "borrow_requests" ADD COLUMN "submissionKey" TEXT, ADD COLUMN "submissionHash" TEXT;
CREATE UNIQUE INDEX "borrow_requests_requestedBy_submissionKey_key" ON "borrow_requests"("requestedBy", "submissionKey");
