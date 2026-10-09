# Website email notifications

Outgoing email is stored in `EmailOutbox`. Status is PENDING, SENDING, SENT (accepted by SMTP), or FAILED. SENT does not confirm inbox placement. The worker checks every 30 seconds, retries up to five attempts with increasing delays, and recovers abandoned claims after five minutes.

## Configuration
- `FRONTEND_URL`: actual website origin; used for authenticated request links.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: transport and sender.
- `EMAIL_DELIVERY_ENABLED=true`: explicitly enables sending queued mail. Without it, messages stay saved and no external email is sent.
- Review the queue before enabling delivery: pending messages from local activity will otherwise be sent.

Admin recipients are active admin accounts. They receive immediate new-request, request-edit and requester-cancellation alerts. Requesters receive submitted, approved, declined, borrowed, returned and cancelled messages. Email content is an event snapshot; request links show current data.

Apply migration `20261003160000_email_outbox` before deploying this code. Use the project's migration workflow on an initialized database. The local test database had uninitialized migration history, so only the new table's SQL was applied; old baseline migrations were not replayed.

## Check delivery history
```sql
SELECT "id", "subject", "status", "attempts", "createdAt", "sentAt", "lastError"
FROM "EmailOutbox" ORDER BY "createdAt" DESC;
```
Retry a reviewed FAILED message by its exact ID:
```sql
UPDATE "EmailOutbox" SET "status"='PENDING', "attempts"=0, "nextAttemptAt"=NOW(), "lastError"=NULL
WHERE "id"='REPLACE_WITH_REVIEWED_ID' AND "status"='FAILED';
```

Do not bulk retry without review. A worker crash after SMTP acceptance but before recording SENT can lead to redelivery; SMTP cannot guarantee exactly-once delivery. Stable Message-ID and unique event keys reduce duplication. Enqueue occurs after domain commits, so an enqueue database failure is logged and requires reconciliation; it must not falsely report the request itself as failed.

## Local verification
From backend: `node scripts/test-email-local.cjs`. This requires an empty pending queue and mocks transport, creates uniquely named test rows, then removes only those rows. It tests HTML escaping, matching references, links, 360px layout, deduplication, disabled sending, retries and concurrent claims. No real email is sent.

Email branding: deploy backend/assets/email/pup-logo.png alongside backend/dist. Request emails embed this seal as an inline CID attachment; no public image URL is required. Template changes apply to newly queued emails.

Account appeals: apply migration 20261004020000_reactivation_requests before deployment. Correct credentials are required for appeals, with one pending appeal per account. Admin notices and email outbox entries are saved transactionally. Reactivation closes pending appeals; actual account status changes queue user emails. Run node backend/scripts/test-reactivation-local.cjs after building for offline checks.

Password recovery: apply 20261004040000_password_reset before deployment. Set FRONTEND_URL to the public website origin so email links work on other devices. Links expire after 30 minutes; successful reset invalidates all prior sessions and reset links without activating deactivated accounts. Requests have a one-minute account cooldown and a maximum of three per 30 minutes, plus the public authentication rate limiter. Manage Accounts includes Send reset link. Run node backend/scripts/test-password-reset-local.cjs after building for offline checks. Reset tokens are hashed in PasswordReset; treat the email outbox as sensitive because queued email bodies contain reset links.

## Brevo HTTPS delivery on Render Free
Set EMAIL_PROVIDER=brevo, BREVO_API_KEY (private API key, not SMTP key), EMAIL_FROM_ADDRESS (verified sender), EMAIL_FROM_NAME, and HTTPS FRONTEND_URL. Keep EMAIL_DELIVERY_ENABLED=false until pending EmailOutbox records have been reviewed. Then enable delivery and create one new test event. No database migration is required. SMTP remains the default for existing installations.

Brevo receives the existing HTML/text via HTTPS; the PUP logo uses FRONTEND_URL/PUPLogo.png instead of a CID attachment. Email clients may require allowing remote images. SENT means provider acceptance, not guaranteed inbox delivery; check Brevo transactional logs for bounces. Failed attempts retain only sanitized HTTP status diagnostics, never provider response bodies or credentials. Retries can duplicate a message if provider acceptance is followed by a timeout or database failure. Pending old notifications are not automatically removed; review them before enabling.
