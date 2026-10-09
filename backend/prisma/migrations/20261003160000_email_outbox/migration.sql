CREATE TABLE "EmailOutbox" (
 "id" TEXT PRIMARY KEY, "eventKey" TEXT NOT NULL UNIQUE, "recipient" TEXT NOT NULL,
 "subject" TEXT NOT NULL, "html" TEXT NOT NULL, "text" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
 "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lockedAt" TIMESTAMP(3),
 "sentAt" TIMESTAMP(3), "lastError" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "EmailOutbox_status_nextAttemptAt_idx" ON "EmailOutbox"("status", "nextAttemptAt");
