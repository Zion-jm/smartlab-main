# Request safeguards and refresh notices

Implemented October 17, 2026. No new database migration is required for these changes.

## Behavior

- Approval and checkout require an active borrower. Students need an enrolled or continuing record with a year level for the request's academic year. Returns remain possible for inactive accounts and earlier periods.
- Editing, approval, rejection and checkout require the request's displayed `updatedAt` version. A stale or missing version returns HTTP 409 and asks the operator to refresh. Both approval API routes enforce this.
- Equipment-only requests with no remaining positive-quantity items cannot be approved or checked out. Laboratory reservations without equipment remain valid.
- My Requests includes the current academic period and outstanding requests from earlier periods. The history checkbox includes completed requests from earlier periods. Owners can open their historical request details.
- Signed-in users check for affected-data revisions every 30 seconds and when returning to the tab. Hidden/offline tabs pause checks. A single dismissible toast offers Refresh; confirmation protects unsaved work from an accidental click. Nothing refreshes automatically.
- Admins receive notices for relevant changes by other accounts. Owners and assigned faculty receive request updates; shared equipment, schedule, directory, and academic-period changes notify other users. Personal academic-record changes target the student and administrators. Notices contain no private record details.
- Your own actions are excluded, including actions from another tab signed in as you. An initial page load establishes a baseline without a toast. Dismissed updates stay quiet until another change occurs. Logout removes the notice and polling.
- Revisions come from committed audit records. Failed or rolled-back changes do not produce notices. The mechanism does not create notification or email records. Direct database edits without audit records are outside this mechanism.

## Manual checks on staging

1. Open an admin session and a separate faculty/student session, using different browser profiles. Wait for both pages to load.
2. Create or edit a request as the faculty/student. Within about 30 seconds, the admin should see **Updates available**. The submitting session should not receive this refresh notice.
3. Leave an unfinished form in the admin session. Make another change in the other session. There should still be only one refresh notice, and the form should keep its values.
4. Click Refresh and cancel the confirmation: the form stays intact. Save or discard the draft, click Refresh again and confirm: the latest data should appear.
5. Change a request as admin. Its owner should receive a notice. An unrelated user should not receive one for a private request edit. Inventory-affecting approval, checkout, return or cancellation may notify other users because availability changed.
6. Open the same pending request in two admin sessions. Approve or edit it in one session, then act on the older version in the other. The second action must fail safely and request a refresh.
7. Deactivate a borrower with an approved request. Checkout must fail without moving stock. An existing borrowed request must still allow a return.
8. Test a student without an eligible academic record: approval/checkout must fail. Configure the correct year's enrollment and retry using refreshed data.
9. Switch academic period. Older outstanding requests must remain in the owner's My Requests. Enable the history checkbox to see completed earlier requests.
10. Test a request whose equipment was removed by availability adjustment: approval/checkout must be blocked with the modify-or-cancel message.

## Automated verification

The regression suite includes `requestSafeguards.test.js`, covering eligibility, stale/missing versions, empty requests, historical visibility, authorization, revision targeting and transaction rollback. The UI suite includes `verify-refresh-notice.cjs`, using mocked revisions in a browser fixture to verify baseline silence, coalescing, draft preservation, dismiss, confirmed reload and logout cleanup.

Run the normal build, `npm run lint:ci`, and `npm run test:regression` with an isolated local `TEST_DATABASE_URL`. Run `npm run test:ui` with the same test database and an installed Chromium browser. Never point these tests at the deployed database.
