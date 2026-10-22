CREATE TYPE "ActivationState" AS ENUM ('LEGACY', 'PENDING', 'COMPLETE', 'CANCELLED');
ALTER TABLE "users" ADD COLUMN "activationState" "ActivationState" NOT NULL DEFAULT 'LEGACY', ADD COLUMN "emailVerifiedAt" TIMESTAMP(3), ADD COLUMN "activatedAt" TIMESTAMP(3);
ALTER TABLE "users" ALTER COLUMN "activationState" SET DEFAULT 'PENDING';
CREATE TABLE "AccountInvitation" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "tokenHash" TEXT NOT NULL, "invitedEmail" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
 "usedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdById" TEXT NOT NULL
);
CREATE UNIQUE INDEX "AccountInvitation_tokenHash_key" ON "AccountInvitation"("tokenHash");
CREATE INDEX "AccountInvitation_userId_createdAt_idx" ON "AccountInvitation"("userId", "createdAt");
CREATE INDEX "AccountInvitation_expiresAt_idx" ON "AccountInvitation"("expiresAt");
