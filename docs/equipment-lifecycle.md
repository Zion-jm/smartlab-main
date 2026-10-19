# SmartLab step 10 — equipment archive and restore

Implemented locally on 2026-10-01.

## Behavior

Equipment now has a separate retiredAt marker. Archive sets it; Restore clears it. Stock edits, checkout, returns and cancellation never clear it. Existing request history and physical counters remain intact.

The existing status field remains compatible with clients: archived equipment reports UNAVAILABLE. For active equipment, status is derived from quantities: AVAILABLE when usable stock remains, otherwise BORROWED when units are checked out, otherwise DAMAGED when damaged units remain, otherwise UNAVAILABLE for empty stock. The stockStatus field on equipment list/detail/edit responses describes quantities separately from retirement.

A new empty item is active with zero stock. Adding stock makes it available automatically. An archived item with the same stock remains archived until an administrator explicitly restores it. Restoring empty or damaged equipment does not invent usable units.

The list displays Archived and offers Restore for retired items. The edit drawer displays stock status and an archived notice. It no longer sends a stale status when saving quantities. Ordinary PUT updates cannot change lifecycle; use the explicit archive/restore operations. Older clients echoing the unchanged status are accepted.

POST /api/equipment/:id/retire and legacy DELETE archive equipment. POST /api/equipment/:id/restore restores it. Both require an administrator. Missing records return 404. Repeated restore is harmless and creates only one transition audit entry. Approved reservations still block archive. Outstanding borrowed items can still be returned after archive. Returns preserve the archive marker and restore only physical quantities.

## Database migration

The nullable equipment.retiredAt column is installed by `backend/prisma/migrations/0004_equipment_lifecycle/migration.sql`. Back up the database, follow [production deployment](production-deployment.md), and run `npm run db:deploy` from the repository root. Existing databases without migration history require the documented baseline adoption first. Do not use db push or a reset as a substitute.

The migration conservatively archives existing UNAVAILABLE equipment when introducing the column. Review those items and restore any that were merely empty. Repeated deployment does not rearchive restored records. The duplicate standalone SQL and local apply helper were removed on 2026-10-19.

Generate Prisma Client and rebuild/restart the API as described in the deployment guide.

## Try it locally

1. Create a disposable equipment item with zero units. Increase total to two: it should become available.
2. Archive it. It should show Archived and offer Restore.
3. Edit its name or quantity. It should remain archived.
4. Select Restore. Availability should follow current stock.
5. Borrow all units on an approved test request: status should become Borrowed. Return them: it should become Available.
6. Archive a borrowed test item, then return it. Its counters should recover, but it should remain archived.

## Verification and limits

Both builds passed; 243 tests passed across 14 suites. Full regression-test results are recorded in SmartLab-Fix-10-Test-Results.txt and the checklist. Browser click-through is not yet verified. Existing frontend bundle-size warning remains.

The SQL uses the existing inventory counters; this change does not reconcile historical inventory discrepancies. Physical availableQuantity continues to mean on-hand undamaged stock even when archived; retirement and the time-window capacity service determine whether it can be lent. Restoration does not reserve equipment or approve pending requests.

## Historical implementation record

Changed backend/prisma/schema.prisma; new equipment-lifecycle.sql and scripts/apply-local-equipment-lifecycle.cjs; new services/equipmentLifecycle.ts; inventoryCapacityService.ts, inventoryMovementService.ts, retirementService.ts and routes/equipment.ts; frontend equipment types, API, AdminEquipment, AdminAuditLogs and EquipmentDrawer; retirement and inventory-capacity tests.

SmartLab-Before-Fix-10.zip is a pre-change source snapshot of backend/src, backend/tests, backend/prisma, frontend/src and docs. It excludes environment files/dependencies and is not a database backup. Keep the new nullable column when reverting code unless a separately reviewed rollback requires otherwise; reverting restores older archive behavior. New files require separate consideration.

Changes remain local and uncommitted. Nothing was deployed or pushed. Next checklist item is production deployment and migration preparation; choosing a host remains a separate decision.
