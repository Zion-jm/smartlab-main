# Partial and damaged equipment returns

Deploy backend and frontend together. The new migration must run before the updated API starts. Existing RETURNED loans are backfilled as fully returned in good condition, matching the previous workflow; no historical notes are invented.

## Manual staging check
1. Create test equipment with four usable units. Borrow all four through an approved request.
2. In Admin Requests, choose Mark as returned. The form defaults to all four in good condition.
3. Enter two good and one damaged. Leave notes blank: Save return must be disabled.
4. Add a factual note, such as One keyboard has broken keys. Save.
5. Expect Available 2, Damaged 1, Borrowed 1, Total 4. Request remains Borrowed with no completion date.
6. Open the admin request details and borrower My Requests details. Both must show 3 of 4 returned, one outstanding, the admin name, timestamp, quantities and note.
7. Open another return form. It should default to one good and zero damaged. It must reject more than one returned unit.
8. Enter the final return and save. Expect Returned, a completion timestamp, two separate history entries, Available 3, Damaged 1, Borrowed 0, Total 4.
9. Retry the previous submission or save a stale form from a second browser tab. Expect rejection with no further inventory change.
10. For a second test loan, deactivate the borrower after checkout, then return the equipment as admin. Returning remains allowed.
11. Cancel stays unavailable for borrowed requests, including partially returned ones. Missing units stay outstanding; this change does not implement write-offs for lost equipment.

## Automated checks
- npm run build
- npm run lint:ci
- npm run test:regression (requires local TEST_DATABASE_URL for smartlab_test; the runner creates an isolated schema)
- node scripts/test-returns-ui.cjs (requires installed Playwright Chromium, or CHROMIUM_PATH pointing to a compatible browser)

Return notes are visible to the borrower. Keep them factual; avoid private internal comments. Recorded history is immutable through the application. Corrections to an incorrectly recorded physical return require administrative reconciliation; do not submit a second invented return.
