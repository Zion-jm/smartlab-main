# SmartLab step 9 — preserve history when retiring records

Implemented locally on 2026-09-30. No database migration, reset, or remote deployment was performed.

## What changed

Deleting an account or equipment through the application API no longer erases it or its loan history. The old DELETE endpoints now perform safe retirement so older clients cannot accidentally erase records.

Account retirement deactivates the account and invalidates its existing login tokens. Profiles, schedules, notifications, requests and loan items remain. Equipment counters do not change when an account is retired. Administrators can still return or cancel its existing borrowed requests. Retiring your own account through this endpoint is rejected; use another administrator account.

Equipment retirement changes only its status to UNAVAILABLE. Its name, description and stock counters remain intact. Borrowed and historical request line items remain. Existing loans can be returned or cancelled, restoring physical stock while leaving the equipment unavailable. Retirement does not automatically mark a loan returned.

Outstanding approved reservations block equipment retirement with HTTP 409. Resolve those reservations first using the supported request workflow. Pending selections are preserved for review, but approval cannot reserve retired equipment. Historical returned/rejected/cancelled records do not block retirement.

Retirement and its audit event commit together in a serializable transaction. Repeating retirement is harmless and does not duplicate a retirement audit event. Concurrency tests cover retirement racing with return, approval and another retirement.

## API and interface

- POST /api/users/:id/retire: administrator-only account retirement.
- POST /api/equipment/:id/retire: administrator-only equipment retirement.
- DELETE on either resource is retained as a retirement alias. No application hard-delete endpoint remains for these resources.
- Missing IDs return 404; unauthenticated callers get 401; non-admin callers get 403.
- The equipment Archive button now calls the explicit retirement endpoint and shows useful conflict explanations.
- Manage Accounts keeps its existing deactivation controls; there is no new account-retirement button in this change.
- Audit Logs includes a Retired action filter.

Retirement currently uses the existing DEACTIVATED/UNAVAILABLE statuses. It does not add a separate permanent archive flag. Administrative reactivation remains possible through existing supported edits. Separating lifecycle state from quantity-derived equipment status is still the remaining part of checklist item 10.

## Retention rule and exceptional deletion

The implemented default is retention without automatic expiry: preserve account, equipment, request, schedule and audit references during ordinary retirement. This is the current application behavior, not a legal retention period. A business owner must separately approve any future timed retention/anonymization policy.

Permanent deletion is not available through normal application routes, even for records with no history. Any exceptional production purge requires a separately reviewed maintenance procedure: explicit owner authorization, a recoverable database backup, identification of all related references, settlement of outstanding loans and reservations, preservation or approved anonymization of required history, transactional changes, inventory reconciliation and a retained maintenance audit. No production purge script was added.

Automated tests may delete only their own disposable fixtures in local smartlab_test. The updated fixture cleanup helper checks the local API/database and accepts explicit IDs created by the test. It is not an application deletion feature.

## See the behavior locally

1. Restart your usual local development command if backend changes are not automatically reloaded. Refresh localhost:5000.
2. Use disposable local equipment. Open Equipment and archive an item with positive stock and no approved reservation.
3. Its status should become unavailable; its name and quantities should remain. Existing history should still be visible.
4. For a disposable borrowed item, archive it and then return its loan. Borrowed stock should decrease and available stock increase, while status remains unavailable.
5. Try archiving an item with an outstanding approved reservation. It should be refused with a useful explanation and no stock change.
6. Deactivate a disposable borrower in Manage Accounts. Its history must remain, and an administrator should still be able to finish its outstanding loan.

Do not deactivate your only administrator for this check.

## Verification

Both backend and frontend production builds passed. The existing frontend large-bundle warning remains.

- Main regression run: 195 tests passed in 12 suites, including 17 retirement tests.
- Updated account/equipment/authentication compatibility run: 60 tests passed in 3 suites.
- Authentication overlaps the runs: total coverage is 236 distinct tests in 14 distinct suites.
- API/database tests confirmed preserved records, preserved quantities, return/cancellation, retirement conflicts, retry/idempotency, old DELETE compatibility, authorization, missing records and concurrent operations.
- Prior session security, authentication, inventory, approval, adjustment and Manila date regression suites passed.
- Browser click-through was not performed. UI compilation and API behavior were verified.

Tests ran against local smartlab_test with a temporary API on port 3119 and SMTP disabled. Disposable fixtures were cleaned up, including three retained fixtures from the first run before its cleanup was updated. The temporary test server was stopped afterward.

## Changed files and recovery

- backend/src/services/retirementService.ts (new)
- backend/src/routes/users.ts and equipment.ts
- frontend/src/services/api.ts
- frontend/src/pages/AdminEquipment.tsx and AdminAuditLogs.tsx
- backend/tests/retirement.test.js (new)
- backend/tests/support/localFixtureCleanup.js (new)
- backend/tests/auth.test.js, users.test.js and equipment.test.js

SmartLab-Before-Fix-9.zip preserves pre-change backend/src, backend/tests, frontend/src and docs. It is a source snapshot, not a database/full repository backup. It excludes .env files and dependencies. If reverting, account for newly added files separately and remember that restoring the old DELETE routes restores destructive behavior.

All edits remain local and uncommitted alongside previous fixes. Full test results are in SmartLab-Fix-9-Test-Results.txt and SmartLab-Fix-9-Compatibility-Tests.txt.
