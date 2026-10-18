# Borrowing policy

## Where to find it
- Admin: System Administration > Borrowing Policy (`/admin/borrowing-policy`).
- Faculty and student request forms: View borrowing policy in the card header opens a read-only modal without leaving the form. The policy has no separate borrower sidebar tab.

## Editing
Choose Edit policy, change the plain text, then Save policy and confirm. Saving publishes the text immediately. Discard changes restores the saved text. Last updated is shown in Philippine time. Empty policies and content over 20,000 characters are rejected. If another administrator saves first, the older draft cannot overwrite their changes; copy the draft before reloading and comparing.

The sample policy is inserted once by migration `20261017010000_borrowing_policy`. It is informational only: there is no acceptance checkbox and it does not change eligibility, limits, inventory, request statuses, or approval rules. Existing installations also receive the default when this migration first runs. Later deployments preserve administrator edits.

## Deployment
Commit the schema, migration, routes, UI and tests together. Generate Prisma Client and build normally. The existing production startup migration process applies the new table and default text; do not run a demo seed or reset the deployed database.

## Verification
Backend regression tests cover the seeded default, all reader roles, unauthorized writes, empty/oversized content, missing/stale versions, audit events, revision notices and unchanged transaction counts. Browser tests cover desktop/mobile editing, save confirmation, read-only access, safe plain-text rendering and the request-form modal.
