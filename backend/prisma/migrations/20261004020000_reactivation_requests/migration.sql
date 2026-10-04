CREATE TABLE "ReactivationRequest" (
 "id" TEXT PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
 "reason" TEXT NOT NULL DEFAULT '',
 "status" TEXT NOT NULL DEFAULT 'PENDING',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ReactivationRequest_pending_user" ON "ReactivationRequest"("userId") WHERE "status" = 'PENDING';
