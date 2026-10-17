CREATE TABLE "borrowing_policy" (
  "id" TEXT PRIMARY KEY CHECK ("id" = 'default'),
  "content" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "borrowing_policy" ("id", "content") VALUES ('default', $policy$SmartLab Laboratory and Equipment Borrowing Policy

1. Who may submit requests
Students and faculty with active SmartLab accounts may submit requests. Students must have an eligible academic record for the applicable academic year. All requests are subject to administrator review and resource availability.

2. Submitting a request
Provide accurate details, including the purpose, date, time, intended location, and equipment quantities. For laboratory reservations, select the required room. An equipment-only request does not reserve its intended usage location.

3. Approval and changes
Submitting a request does not guarantee approval. Check SmartLab for its status and any administrator notes. Pending requests may be edited. Pending or approved requests may be cancelled before equipment is released.

4. Equipment collection
Collect equipment only after approval and coordinate collection with the administrator. Approval reserves equipment; the administrator records its release when it is handed over. Check the quantity and condition before leaving and immediately report any discrepancy.

5. Proper use
Use equipment and laboratory facilities responsibly and only for the approved purpose. Follow laboratory instructions. Do not transfer borrowed equipment to another person without administrator permission.

6. Returning equipment
Return equipment by the agreed return time. The administrator checks and records returned quantities and their condition. Partial returns may be recorded, but any unreturned items remain the borrower's responsibility.

7. Damage, loss, and delays
Immediately report damage, loss, or an expected delay to the administrator. Do not attempt unauthorized repairs. Any responsibility, replacement, or disciplinary decision follows the school's applicable policies.

8. Laboratory use
Use the laboratory only during the approved schedule. Keep the room clean, observe safety rules, and report problems before leaving. Contact the administrator if a scheduling conflict occurs.

9. Account and record changes
A change in account status or academic period does not remove responsibility for outstanding equipment. Contact the administrator to arrange returns even if account access is unavailable.

10. Questions and assistance
Contact the laboratory administrator for corrections, collection arrangements, return concerns, or clarification of this policy.$policy$) ON CONFLICT ("id") DO NOTHING;
