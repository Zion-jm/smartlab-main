# Account invitations and password setup

Administrators enter the user's name, email, role and required academic details. They no longer choose or receive the user's password. A queued invitation is not proof of delivery. Successful activation confirms access to that email inbox, not the person's identity.

## Administrator workflow

1. Open Manage Accounts and add the account. Select **Send invitation**.
2. The account remains **Pending activation** and cannot sign in.
3. The recipient opens the email link, sets and confirms a password, then signs in normally.
4. Use **Invitation options** to view queue status, resend, correct an email address, or cancel. Resending or correcting invalidates previous links. Wait one minute between sends; at most five links per account per hour.
5. A cancelled account remains unavailable. **Send new invitation** creates a fresh link without restoring old links.

Links expire after 24 hours and work once. Passwords must meet the shared policy (at least 8 characters, within the bcrypt size limit). The page provides show-password controls and plain-language errors. Activation does not automatically sign the user in.

## Configuration and deployment

Use the existing email configuration: `EMAIL_DELIVERY_ENABLED=true`, configured Brevo or SMTP credentials, verified sender, and `FRONTEND_URL` set to the exact website origin. Production requires HTTPS. Missing email configuration prevents creating new invited accounts. The existing email worker handles retries; a provider-accepted email is not necessarily delivered to an inbox.

Deploy migration `20261021010000_account_invitations` before starting the new backend. Existing users become `LEGACY` without changing passwords, status, sessions or academic records. Historical verification timestamps remain empty. New invitations are `PENDING` and `DEACTIVATED` until acceptance. First-time installation setup remains a separate flow.

Do not roll back to older application code after issuing invitations without a reviewed rollback plan: old code does not understand activation states. Keep a backup and rehearse on staging first.

## API contract

- `POST /api/users`: existing profile fields, `gmail`, `role_id` and academic fields; omit `password` and `status_id`. Returns `activation_state`.
- `GET /api/users/:id/invitation`: administrator-only expiration and delivery status; never returns the link.
- `POST /api/users/:id/invitation/resend`, `/email` (body `{ "email": "..." }`), `/cancel`, `/reinvite`: administrator-only actions.
- `POST /api/auth/invitations/inspect`: body `{ "token": "..." }`; returns masked email only.
- `POST /api/auth/invitations/accept`: body `{ "token": "...", "password": "...", "confirmPassword": "..." }`; activates once, without returning a session.
- Account list `status=PENDING` or `status=CANCELLED` filters invitations separately from activated/deactivated accounts.

Password reset, ordinary edits, status changes and retirement cannot activate pending accounts. Cancellation and acceptance invalidate remaining links. Token hashes are stored in AccountInvitation; queued email bodies contain the usable link until revoked, used or expired, when the worker redacts them. Protect database backups accordingly.

## Verification before staging

Run from the repository root with a local `smartlab_test` database and `TEST_DATABASE_URL` configured in the same terminal:

```powershell
npm run db:generate
npm run build
npm run lint:ci
node --test backend/tests/unit/accountInvitation.cjs
node backend/scripts/test-invitation-page.cjs
npm run test:regression
npm run test:setup
npm run test:ui
node scripts/test-ui.cjs --deployment
```

The page check uses mocked API responses and local Chrome (or `CHROMIUM_PATH`); it does not prove email delivery. Regression tests use isolated schemas and a test-only mail transport that never contacts an email provider. They cover account creation for all roles, blocked pending sessions, password validation, resend/correction, expiry, cancellation, one-use links and concurrent acceptance, alongside the existing business regression suites.

Before production, verify a real invitation on staging with a controlled inbox, confirm all three roles retain their existing permissions, and complete the existing borrowing, schedule, PDF, setup and deployment checks. Do not treat a build or mocked test as evidence that database migration and email delivery passed.

Use the [staging test checklist](account-invitation-staging-checklist.md) to record real-email and role checks before production.
