# Shared approval and schedule conflict checks

Both approval endpoints use backend/src/services/approvalService.ts:
- PATCH /api/borrow-requests/:id/approve
- PATCH /api/lab-schedules/approve-request/:requestId

The service checks administrator authorization, pending status, room reservations, and equipment capacity before changing status. The checks, status claim, and optional schedule creation share a serializable transaction. Serialization conflicts are retried with the bounded transaction helper introduced in fix 4. Repeated approval returns a conflict and cannot create another request-derived schedule through these endpoints.

Direct schedule creation and editing also check committed room reservations inside their write transactions. Editing a schedule linked to an approved equipment request rechecks equipment capacity and rolls back both records if the new time conflicts.

## Scheduling rules

Clock times are interpreted in Asia/Manila regardless of the server time zone. Calendar date comparisons accept the existing UTC-midnight or Manila-midnight date representations. Weekly records use their stored weekday even when scheduleDate is null. One-time versus weekly conflicts work in both directions. Adjacent intervals are allowed: 08:00–09:00 does not overlap 09:00–10:00.

Room schedules remain scoped by academic year and term, matching the project's existing scheduling model. Weekly schedules apply throughout their selected period; the schema does not define recurrence start/end dates. Overnight ranges are refused; this change does not implement multi-day bookings. Broader application-wide date/time standardization remains checklist item 6.

The conflict preview shares schedule overlap rules and reports pending requests as advisory. Approved/borrowed general-room reservations without separate schedule records are also shown. A clear preview does not reserve a slot: approval always checks again. Database query failures are not treated as a conflict-free result.

## Equipment approval capacity

Equipment is physical stock shared across academic periods. Approval checks the same Manila calendar day and computes peak simultaneous demand from APPROVED reservations, rather than summing back-to-back bookings. Borrowed units are already excluded from availableQuantity; they are not subtracted twice. Damaged units are unavailable. UNAVAILABLE or DAMAGED equipment cannot be approved. No physical counters are changed by approval; borrowing still moves physical stock.

This is deliberately conservative for future bookings: outstanding borrowed units are unavailable until returned. Legacy equipment-only requests without either time reserve the whole day. Invalid quantities and partially specified or reversed time ranges are refused. The broader equipment preview/editing semantics in checklist item 7 remain separate work.

## Local verification

Build the backend. Run a separate API with local smartlab_test, SMTP_PASS empty, and optionally TZ=UTC; point TEST_API_URL at its /api URL. From backend:

```powershell
node node_modules/jest/bin/jest.js tests/approvalConcurrency.test.js tests/scheduleRules.test.js tests/inventoryConcurrency.test.js tests/inventoryTransaction.test.js tests/equipmentAdjustments.test.js tests/auth.test.js tests/configuration.test.js --runInBand
```

The approval concurrency suite refuses a nonlocal API/database or a database not named smartlab_test. It creates and cleans up its own fixtures. The test database needs the existing academic period and fix 4's inventory constraint. No reset or demo seeding is needed for an existing installation.

No schema migration is introduced in fix 5. Concurrency protection is enforced by the application transaction paths; direct database scripts remain responsible for preserving these rules. No deployment or remote database change is performed.
