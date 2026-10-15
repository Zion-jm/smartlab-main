# Checkout workflow test guide

Use staging with clearly labelled test requests and equipment. Times use Asia/Manila. Run after deploying this change and passing GitHub Verification. No database migration is required.

## Preparation
1. Sign in as an administrator and note available/borrowed counts for a test equipment item.
2. Use a faculty account, or a student with a configured current-year academic record, to submit test requests.
3. Approve requests before their start time. Use valid half-hour booking times, between 7 AM and 9 PM, on a non-Sunday.

## Normal checkout and return
1. Create and approve a request for a session starting soon, for one unit.
2. Wait until its scheduled start, then click Mark as borrowed before the end.
3. Expect no time warning. Status becomes Borrowed; available decreases by one and borrowed increases by one.
4. Try again from a stale second browser tab. Expect rejection and no additional inventory movement.
5. Confirm the equipment is physically returned, then mark Returned. Counts return to their initial values.
6. Retry return from a stale tab. Expect rejection and no additional stock restoration.

## Early checkout
1. Approve a request for tomorrow (or later today).
2. Click Mark as borrowed. Expect a warning showing the scheduled Manila date and time.
3. Leave the reason empty or enter spaces. Record checkout stays disabled; Go back makes no changes.
4. Enter a short reason and record checkout. With sufficient stock and no conflicting reservations, expect Borrowed and one stock deduction.
5. Inspect the BORROW audit event: admin, reason, recording time and scheduled period should be retained. The original deadline stays unchanged.
6. Physically return the test item and record Returned.

## Competing reservation
1. Use an item with exactly one usable available unit and no outstanding loan.
2. Approve A for 9–10 AM and B for 10 AM–12 PM on a future test day.
3. Before A ends, attempt early checkout for B with a reason.
4. Expect a reservation-conflict message, B stays Approved and inventory stays unchanged.
5. Cancel both approved test reservations when finished. Do not change the computer clock; backend time controls validation.

## Missed checkout
1. Approve a short session before it starts, and let its end time pass without marking Borrowed.
2. Click Mark as borrowed; enter Already collected; recording late.
3. With matching stock, expect Borrowed and one stock deduction. Original deadline stays in the past. Check the existing overdue display.
4. Check audit history, then record the actual return.
5. This records the entry time, not a backdated handover. If stock cannot be reconciled, the system must reject checkout; investigate inventory rather than increasing stock just to bypass it.

## Cancellation boundaries
1. Cancel a Pending request: expect Cancelled, no physical inventory movement.
2. Cancel an Approved request: expect Cancelled and released reservation, no physical inventory movement.
3. Mark another request Borrowed: Cancel should no longer appear in its action drawer.
4. A direct cancel API call for that Borrowed request must return 409. Inventory and status stay unchanged.
5. Use Mark as returned after receiving the equipment.

## Return after deactivation
1. Mark a test borrower's equipment Borrowed.
2. Deactivate that borrower using another active admin account.
3. As admin, record the return. It must succeed and restore stock once.

## Automated verification
Build and focused checkout policy tests run locally. Run the full managed regression suite with TEST_DATABASE_URL pointing to the isolated test database, or use GitHub Verification. Never point tests at the deployed application database.
