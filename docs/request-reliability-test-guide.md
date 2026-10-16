# Request submission and notification reliability

Deploy the migration `20261016020000_request_submission_idempotency` before starting the updated backend. Existing requests remain valid; their submission keys are null. Deploy the updated faculty and student forms together with the backend.

## Behavior

- Faculty and student forms reuse a submission key when retrying the same payload. They block an additional submit while a call is in flight. A changed payload or a completed submission gets a new key.
- Keys are unique per requesting account. Reusing a key with different data returns a conflict. Replaying the same key returns the existing request without repeating its audit, notification or emails.
- The existing same-day, same-period, overlapping-equipment pending-request rule runs inside a serializable transaction for both creation and edits. Older clients without keys still receive this duplicate protection.
- Submission, edit, approval, rejection, checkout, return and cancellation save their applicable notices and email queue records within the domain transaction. Schedule-route approval and adjustment-response cancellation use the same transactional services.
- Email transmission remains asynchronous. A transport outage leaves a committed queued email for the existing worker to retry. A failure to store the notice or queue entry rolls back the business action.
- Partial returns create an in-app notice; the completion email is queued when all units are returned, as before.

## Staging checks

1. Submit a faculty or student equipment request. Confirm one request and one corresponding administrator notice.
2. Retry the identical POST body, including its `submissionKey`, using the same authenticated account. Confirm the same request ID and no extra submission notice.
3. Retry the key with a different purpose. Expect HTTP 409.
4. Submit the same pending equipment/date/period under a different key. Expect HTTP 409 with the existing request ID.
5. Approve a test request. Confirm the state and borrower notification; confirm the queued approval email is delivered when email delivery is enabled.
6. Complete a checkout and a partial/full return. Confirm notices match the committed state and the full return queues its email.
7. Cancel a pending request as its owner. Confirm the owner and administrators receive the applicable notices.

## Automated verification

`npm run build`, `npm run lint:ci`, and `npm run test:regression` (with an isolated local TEST_DATABASE_URL).

The regression suite exercises simultaneous requests, replay and payload mismatch, old clients without keys, room-only retries, notification/outbox failure rollback, return inventory rollback, and raw SQL serialization retries. No production database or actual email sending is needed.

Keys are retained by the mounted form for network retries. Reloading the browser starts a new form; the pending-equipment duplicate rule still applies. Existing historical duplicate requests or missing notifications are not automatically rewritten.
