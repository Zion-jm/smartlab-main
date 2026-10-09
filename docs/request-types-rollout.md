# Laboratory reservations and equipment borrowing

Faculty can reserve computer laboratories, with optional equipment, or borrow equipment alone. Students can borrow equipment and cannot reserve laboratories. Roles remain separate.

Equipment requests require at least one item, a borrowing time, supervising faculty, purpose, and intended usage location. A directory room or another venue/address can be recorded. Usage locations never create laboratory schedules or participate in room conflicts; equipment availability still applies.

## Data and transactions

Migration 20261005010000_request_types adds requestType, usageRoomId and usageLocation. Existing records default to LEGACY without changing their old room associations, status, items or schedules. New and edited submissions must explicitly choose LABORATORY or EQUIPMENT. Older cached forms must be refreshed.

Approving a laboratory reservation checks room conflicts and equipment capacity in one serializable transaction. Only faculty-owned requests can create new laboratory schedules, including approval of old pending requests. Students with old pending laboratory requests must edit them into equipment borrowing or cancel them; faculty must submit any needed laboratory reservation separately.

Equipment-only approval never creates a schedule. Equipment stock changes at checkout and return using existing inventory transactions. Lab-only reservations remain APPROVED and have no checkout/return actions. Administrators may cancel newly approved requests. Cancellation releases linked schedules for new requests and restores stock when already borrowed; the audit records the released schedules. Legacy cancellation behavior remains unchanged.

Request details, notification emails, request PDF output and request spreadsheets identify request type and intended usage location. Equipment reports retain item-based totals; laboratory schedules only represent actual reservations.

## Verification

From repository root:

~~~powershell
npm.cmd run build
cd backend
node scripts/test-request-types-local.cjs
node scripts/test-request-types-browser.cjs
~~~

The test requires local PostgreSQL credentials in TEST_DATABASE_URL or backend/.env DATABASE_URL. It accepts loopback hosts only, uses smartlab_test with a unique temporary schema, applies migrations there, and drops only that schema afterward. It does not seed or migrate staging.

The browser test starts a temporary local server on port 3137, uses installed Chrome (or CHROMIUM_PATH), and saves screenshots under artifacts/request-types. It checks mobile role screens and real HTTP creation, edit restrictions and approval. It disables email delivery and cleans up its schema/server.

Covers permissions, required equipment/location, legacy default, equipment usage in an occupied lab, room conflicts, combined lab/equipment requests, inventory checkout and return, repeated return rejection, cancellation, shortages and competing approvals.

## Staging rollout

1. Back up the staging database and preserve the currently deployed revision.
2. Commit these request-type changes, keeping unrelated seed/catalog edits separate.
3. In backend, set DATABASE_URL to the staging connection securely, then run:

~~~powershell
npx.cmd prisma migrate deploy
npx.cmd prisma migrate status
Remove-Item Env:DATABASE_URL
~~~

4. Deploy the matching backend and frontend revision. The build must generate the Prisma client from the updated schema. Refresh any open request forms afterward.
5. Verify as student: equipment required, location required, no laboratory reservation option.
6. Verify as faculty: lab-only reservation, equipment-only borrowing, and lab with equipment. An equipment usage location in an occupied lab must not cause a room conflict.
7. Verify as admin: approval, cancellation, stock checkout/return and schedule release. Inspect request PDF/Excel and email labels.

Do not remove the new columns or rewrite historical data as a rollback. After new requests exist, review rollback compatibility before deploying older application code.

Local build and transaction tests do not substitute for staging browser, email-delivery and visual PDF checks.
