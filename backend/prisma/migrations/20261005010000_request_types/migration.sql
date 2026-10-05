CREATE TYPE "BorrowRequestType" AS ENUM ('LEGACY', 'LABORATORY', 'EQUIPMENT');
ALTER TABLE "borrow_requests" ADD COLUMN "requestType" "BorrowRequestType" NOT NULL DEFAULT 'LEGACY', ADD COLUMN "usageRoomId" TEXT, ADD COLUMN "usageLocation" TEXT;
ALTER TABLE "borrow_requests" ADD CONSTRAINT "borrow_requests_usageRoomId_fkey" FOREIGN KEY ("usageRoomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
