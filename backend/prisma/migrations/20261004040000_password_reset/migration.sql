CREATE TABLE "PasswordReset" (
 "tokenHash" TEXT PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
 "sessionVersion" INTEGER NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "usedAt" TIMESTAMP(3)
);
CREATE INDEX "PasswordReset_userId_createdAt_idx" ON "PasswordReset"("userId", "createdAt");
