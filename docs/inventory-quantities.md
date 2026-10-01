# SmartLab inventory quantities and reservations — fix 7

Implemented locally on 2026-09-30. No deployment, database reset, or schema migration was performed.

## What changed in plain language

A reservation is a promise to lend equipment at a particular time. It is not a physical checkout.

Example: you own 10 projectors. Two are still borrowed and three are damaged. Five can be lent. If an approved request reserves two during 8–10 AM, a new request during that time can reserve three. Pending requests warn users but do not consume capacity.

An overdue loan stays unavailable until returned or cancelled through the administrator workflow. The system does not assume it will be returned in time for a future reservation.

If six units are reserved from 8–9 AM and six from 9–10 AM, the peak reservation is six, not twelve. End times do not overlap the next start time. Stock is shared across academic periods, and all dates use Manila calendar days. Legacy reservations without times occupy the full day.

## Input rules

- Saved request selections require a numeric integer from 1 through 2,147,483,647 (the database integer limit). Negative numbers, zero, fractions, strings and duplicate equipment IDs are rejected with HTTP 400.
- A room-only request may have an empty selection list. Omitted selections remain supported during creation; editing requires an array.
- A read-only conflict preview may use requestedQuantity: 0 to fetch reservation warnings. This does not create or modify a request.
- Equipment stock counters must be nonnegative integers within the database limit. New equipment starts with zero borrowed units.
- Ordinary equipment edits cannot change the borrowed counter. Checkout, return and cancellation manage that counter.
- Equipment edits check outstanding BORROWED records, not APPROVED reservations, against the borrowed counter. Existing mismatches require inventory review; this fix does not silently rewrite historical data.
- Reducing total stock, increasing damage, or marking equipment unavailable is rejected if it would invalidate an outstanding approved reservation. The edit rolls back.
- Explicit UNAVAILABLE status is preserved by ordinary edits and returns. Unavailable or damaged equipment cannot be checked out.

## How the paths agree

The shared inventoryCapacityService supplies request validation, physical eligibility, exact time overlap and peak reservation usage. Preview, approval, adjustments and equipment editing use those rules. Checkout uses the same blocked-status policy with an atomic availableQuantity >= requested quantity update; it does not subtract an approved reservation a second time. Approval does not move physical stock.

Availability previews use one consistent database snapshot. Approval, adjustments, stock editing, checkout and returns use the existing serializable transaction helper with bounded conflict retries.

Adjustment calculation, item replacement and notification creation now commit together. Selections reduced to zero are removed. If all selections are removed, the request remains pending for review; it is not automatically cancelled. Review it before approving, particularly when there is no room booking. Notification acceptance/deadline enforcement remains the separate workflow follow-up in the audit checklist; the displayed 24-hour deadline is not newly enforced here.

The equipment form now shows the server's validation explanation. The availability hook also sends the correct equipment/ requestedQuantity fields to fetch reservation warnings.

## How to see it locally

1. Restart your usual development command if it is not watching backend files, then refresh localhost:5000.
2. Use disposable test equipment in your local test database.
3. Create equipment with 10 units and 3 damaged. Its available physical stock is 7.
4. Approve a request for 2 units. Physical borrowed stock stays 0. A preview for the same time should show 5 remaining.
5. Try changing damaged stock to 9. The form should explain that the change would invalidate an approved reservation, and the original numbers should remain.
6. Mark the approved request borrowed. Physical borrowed becomes 2 and available becomes 5. Return it to restore available to 7.
7. If you have a disposable unavailable item, change its name. It should remain unavailable.

Some forms already prevent invalid quantities. The API tests exercise those cases directly so bypassing the form does not bypass validation.

## Verification

- Backend TypeScript build: passed.
- Frontend TypeScript/Vite production build: passed.
- 162 tests passed across 10 suites, including 36 quantity/capacity tests.
- Tests cover damaged stock, overdue loans, cross-period stock, adjacent bookings, legacy all-day reservations, zero/fractional/negative input, duplicate lines, unavailable checkout, rollback, adjustments, and three rounds of approval racing a stock reduction.
- Earlier authentication, adjustment authorization, inventory concurrency, approval concurrency, configuration and Manila-time suites also passed.
- Tests used localhost smartlab_test and a temporary API on port 3119 with SMTP disabled. Tests used isolated temporary records and cleaned them up.
- Existing frontend bundle-size warning remains. Browser click-through validation of these new screens was not performed; builds and API/database behavior were verified.

## Files changed

- backend/src/services/inventoryCapacityService.ts (new shared rules)
- backend/src/services/approvalService.ts
- backend/src/services/inventoryMovementService.ts
- backend/src/routes/borrowRequests.ts
- backend/src/routes/equipment.ts
- backend/src/routes/equipmentConflicts.ts
- backend/src/routes/equipmentAdjustments.ts
- frontend/src/components/equipment/EquipmentDrawer.tsx
- frontend/src/hooks/useEquipmentAvailability.ts
- backend/tests/inventoryCapacity.test.js (new regression coverage)

## Recovery and next work

SmartLab-Before-Fix-7.zip contains pre-change backend/src, backend/tests, frontend/src and docs snapshots. It is a source snapshot, not a complete repository/database backup, and excludes environment files and credentials. Restore individual files carefully so earlier work is retained; remove the new service/test if fully reverting this step.

All changes remain local and uncommitted alongside fixes 1–6 and pre-existing work. Nothing was pushed. Next checklist item: account deactivation and session invalidation (item 8).
