-- Measured with scripts/benchmark-indexes.cjs; see docs/prisma-and-indexes.md.
-- Ordinary CREATE INDEX takes a write-blocking lock: deploy in a maintenance window.
CREATE INDEX "borrow_request_items_equipmentId_idx" ON "borrow_request_items" ("equipmentId");
CREATE INDEX "borrow_requests_academicYearId_termId_status_dateNeeded_idx" ON "borrow_requests" ("academicYearId", "termId", "status", "dateNeeded");
CREATE INDEX "lab_schedules_academicYearId_termId_roomId_idx" ON "lab_schedules" ("academicYearId", "termId", "roomId");
CREATE INDEX "lab_schedules_borrowRequestId_idx" ON "lab_schedules" ("borrowRequestId");
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications" ("userId", "createdAt");
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs" ("actorUserId", "createdAt");
