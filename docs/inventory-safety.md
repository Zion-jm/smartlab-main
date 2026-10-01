# Inventory safety — fix 4

Borrow, return, and cancellation now claim the expected request status and move stock in one serializable database transaction. Equipment is updated in a stable ID order. Conditional counter updates refuse insufficient stock. PostgreSQL serialization/deadlock conflicts (Prisma P2034) are retried up to three times after the initial attempt; exhausted retries return HTTP 409. Unknown failures are not retried.

A repeated action returns a conflict/invalid-status response and does not move stock again. This is safe replay behavior, not an idempotency-key API that returns the original success response. Email, notifications, and audit calls remain outside the retry callback to avoid repeating them on transaction retries; their existing best-effort delivery guarantees are unchanged.

Related status guards prevent stale approvals, rejections, pending edits, and adjustments from overwriting an already changed loan. Equipment edits compare the counters read earlier before saving. Full schedule conflict enforcement and inventory editing semantics remain separate checklist work.

## Database constraint

backend/prisma/inventory-constraints.sql requires all four inventory counters to be nonnegative and totalQuantity = availableQuantity + borrowedQuantity + damagedQuantity. Casts to bigint avoid overflow during the sum check. It does not verify that borrowedQuantity equals the sum of outstanding loan records; reconcile historical records separately if those disagree.

The local smartlab_test database was checked and this constraint was installed explicitly. No inventory rows were repaired, deleted, or reseeded.

For a fresh local smartlab_test database, after schema setup, from backend:

```powershell
node scripts/check-inventory.cjs
node scripts/check-inventory.cjs --apply
```

The utility refuses other hosts/database names, reports the inconsistent-row count, and refuses to apply if that count is nonzero. Installation and validation share a transaction. It is not run on application startup.

For Replit or future hosting, review and incorporate the SQL into the database deployment/migration process. It has NOT been applied to a remote database. Prisma schema.prisma cannot express this PostgreSQL CHECK constraint; schema recreation can require reapplication. Do not use a destructive database reset as a migration strategy. Existing migration deployment work remains checklist item 11.

## Repeat focused verification

Build the backend and run a dedicated API against local smartlab_test with email disabled. Set TEST_API_URL to its /api URL. From backend:

```powershell
node node_modules/jest/bin/jest.js tests/inventoryConcurrency.test.js tests/inventoryTransaction.test.js tests/equipmentAdjustments.test.js tests/auth.test.js tests/configuration.test.js --runInBand
```

Concurrency tests create their own accounts, equipment, and requests and remove those fixtures afterward. They refuse a nonlocal database or a database not named smartlab_test. Use a disposable test database; do not point tests at production.

## What users see

The dashboard layout is unchanged. A duplicate or competing action can show a conflict message asking the user to refresh. If two requests need the last available unit, only one can borrow it. If return and cancellation race, only the winner restores stock. Restart the development app after pulling these source changes.
