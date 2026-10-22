# Account invitation and password setup implementation plan

Status: Implemented locally on 21 October 2026; database-backed regression, migration rehearsal and staging email delivery remain release gates. See [Account invitations](account-invitations.md) for the current workflow.

## Outcome and scope

Replace administrator-supplied temporary passwords for newly created student, faculty and administrator accounts with emailed invitations. Administrators still enter names, roles and required academic details. Recipients choose their own passwords. Successful setup proves access to the invited inbox, not a person's real-world identity.

Keep existing accounts, passwords, academic records and sessions working. Do not silently label historical email addresses as verified. Do not reopen installation setup. Public self-registration, active-account email verification changes, MFA and the planned session redesign are separate work.

## Findings before implementation

- backend/src/routes/users.ts requires email, password, role and status; hashes the supplied password; creates the user, role profile, initial student academic record and audit records in a transaction.
- User.passwordHash is required. UserStatus currently has ACTIVE and DEACTIVATED; default is ACTIVE. There is no general email-verification timestamp.
- backend/src/routes/auth.ts checks the password and ACTIVE status at login; its conditional login update protects against concurrent changes. middleware/auth.ts checks status and sessionVersion on authenticated requests.
- passwordResetService.ts already uses random tokens, hashes, expiry, user row locks, single-use consumption, session invalidation, transactional email and required audit records. Password reset deliberately does not change activation status.
- accountReactivationService.ts supplies branded transactional mail. EmailOutbox stores email bodies, retries delivery up to five attempts and runs on a 30-second worker interval. Delivery must be enabled and configured. SENT means accepted by the mail provider, not proof of inbox delivery.
- Installation setup has its own verification flow and permanent closure. Its rules must remain separate.
- AccountDrawer.tsx currently asks for a temporary password. ManageAccounts, account types and API payloads need coordinated updates.
- Last-administrator protection counts ACTIVE administrators; it must exclude pending invitations.

## User flow

1. Administrator chooses Add account, enters profile details and email, and clicks Send invitation. No password or initial activation-status field.
2. Server validates the details and reserves the email, creates the profile and invitation, queues the email and records the audit event atomically.
3. UI shows Pending activation with an independent delivery indicator (Queued, Sending, Sent to provider, Failed).
4. Recipient opens /activate-account#token=... and sees Set up your account, a masked email, password and confirm-password fields, show/hide controls and accessible validation.
5. GET/navigation does not consume the link or activate anything. Mail security scanners cannot consume an invitation by opening it.
6. Submitting a valid password consumes the invitation and completes activation in one transaction. Set emailVerifiedAt and activatedAt; increment sessionVersion; record the event; optionally queue a confirmation email.
7. Show success with a Sign in button. Do not automatically log in or issue a JWT from activation.

Expired, revoked, already-used and invalid links get a safe explanation and instructions to contact the laboratory administrator. No public resend endpoint in the first version. A signed-in admin can resend, correct the pending email or cancel the invitation.

## Data model and invariants

Prefer an independent activation state over changing the established account-status enum:

- User.activationState: LEGACY, PENDING, COMPLETE, CANCELLED. Database default PENDING for new rows. Explicitly backfill existing users to LEGACY during migration.
- User.emailVerifiedAt: nullable timestamp. Existing records remain null unless there is reliable verification evidence.
- User.activatedAt: nullable timestamp; do not invent historical activation dates.
- Keep passwordHash required initially. For invitations generate a cryptographically random, discarded secret and store only its bcrypt hash. It is never returned, emailed or known to the administrator. This avoids a nullable-password migration across all existing consumers.
- AccountInvitation: id, userId, tokenHash (unique), invitedEmail, expiresAt, usedAt, revokedAt, createdAt, createdById, optional revocation reason and related outbox identifier. Index userId/createdAt for cooldowns and latest status; index expiry for cleanup.
- Maintain at most one outstanding invitation per user through user-row locking plus invalidation, preferably reinforced by a partial unique index for unused, unrevoked invitations. Expired predecessors are revoked before inserting a replacement.

Access requires status ACTIVE AND activationState in LEGACY/COMPLETE. PENDING and CANCELLED cannot sign in or use any protected API, even if status is accidentally set ACTIVE. UI prioritizes Pending activation/Invitation cancelled over the existing status badge. Invitation expiry is derived from the latest token; it does not turn the user into a deactivated account.

Pending users should not appear as eligible requesters, faculty assignees, active-user totals, or replacement administrators. Decide whether they remain visible in academic-directory listings with an explicit pending badge; never let account eligibility be inferred solely from a profile's existence.

## Backend contracts

- POST /api/users: admin-only invitation creation. Reuse existing profile validation and transaction structure. New payload contains identity/role/academic fields only. Reject password and caller-specified activation state/status rather than silently permitting the old password-creation path. Return 201 with safe account and invitation summaries, never a token.
- POST /api/users/:id/invitation/resend: admin-only; PENDING only; rotate link and queue fresh mail transactionally. Enforce cooldowns. Does not change email or role.
- PATCH /api/users/:id/invitation/email: admin-only; PENDING only; validate/canonicalize email, reserve uniqueness, increment sessionVersion, revoke all previous invitations and reset tokens, suppress stale queued invitation mail, issue replacement.
- POST /api/users/:id/invitation/cancel: admin-only; transition to CANCELLED, revoke tokens, invalidate sessions and suppress undelivered mail. Preserve audit/profile records. A separate confirmed Reinvite action may move CANCELLED to PENDING with a new token; no generic Activate button.
- POST /api/auth/invitations/inspect: body token, bounded input, read-only, no-store. Return only valid/invalid and minimal masked recipient information. Do not disclose role, profile, token hash or database identifiers.
- POST /api/auth/invitations/accept: body token/password/confirmPassword; validate both server-side; no-store. Does not accept email, role, status, userId or an arbitrary redirect.

All token validation errors use a safe common response. Admin-only errors can explain duplicate email, cooldown, delivery configuration and existing activation. Use appropriate 400/409/429/503 responses and Retry-After where applicable.

## Token, password and concurrency rules

- Use 32 cryptographically random bytes, represented as a bounded 64-character hex token; hash with SHA-256 in the invitation table.
- Proposed expiry: 24 hours, suitable for an invitation; keep password reset's current 30-minute lifetime separate.
- Proposed send limits: one per minute and five per user per hour, enforced in the database under the user lock. Add actor/IP limits to prevent bulk mail abuse. A resend or email correction must not reset the user's hourly quota.
- Use the existing password policy on client and server. Explain limits in ordinary language; do not expose bytes in user-facing copy. Retain the actual UTF-8 bcrypt limit internally. Never trim or silently truncate passwords. Confirm password must match.
- Check token shape, existence and expiry before expensive hashing, then hash outside the transaction. In the transaction lock the user, revalidate invitation and account, conditionally consume token, update password/activation/verification and revoke other outstanding tokens. Check expiry again using database time.
- Coordinate accept/resend/correction/cancel/status changes with the same user lock and consistent lock order. Only one concurrent acceptance succeeds. If cancellation or correction wins, the old link cannot activate. If activation wins, a correction/resend must refuse and require the active-account workflow.
- Bind acceptance to invitedEmail matching the current user email and PENDING state. A token never changes a user's role. Role edits on pending accounts should revoke/reissue the invitation or be prohibited until cancellation/reinvitation.
- Use a configured HTTPS FRONTEND_URL in production; no request Host-derived URLs or open redirects. Token in fragment, immediately remove fragment with history.replaceState after capture, keep token only in memory, never analytics/localStorage/query logs. Set no-referrer for activation, no-store for token APIs; do not include third-party scripts on that page.
- The outbox necessarily contains the plaintext link inside its email body even though the invitation table stores only a hash. Treat outbox access and backups as secret-bearing; never expose message bodies in admin APIs or logs. Add a defined redaction/retention job (proposed: erase invitation bodies once used/revoked/expired, retain delivery metadata).

## Email delivery and failure behavior

Reuse queueAccountMail/EmailOutbox/Brevo rather than introducing another provider. No new provider key is inherently required. Validate enabled/configured delivery before creating an invitation; production fails cleanly if missing. Provider outages after commit leave a pending account and retryable queued message, not a falsely activated user.

Use an invitation-specific event key linked to the invitation. Add a worker pre-send validity check and cancellation/redaction support for invitation messages. A message already in flight cannot always be recalled; its invalidated link must fail safely. Avoid modifying semantics for password reset, setup and other queued email types.

Show Queued rather than Email sent immediately after creation. SENT means sent to provider; delivery/bounce verification via provider webhooks is a separate future enhancement. Failed invitations offer correction/resend, not a manual activation bypass. Never return the link to an admin as a fallback.

Invitation email: school/Smartlab identity, brief account purpose, Set up your account button, exact expiry guidance, ignore-if-unexpected copy, and contact instructions. No password and no unnecessary student data.

## Integration safeguards

- Login: preserve generic invalid-credential behavior; check activation before session issuance and include it in the conditional last-login update to close races.
- Auth middleware: select activationState and reject PENDING/CANCELLED regardless of JWT validity.
- Password recovery: pending/cancelled accounts must not receive reset links; preserve generic public response. Reset acceptance rechecks eligibility so old reset tokens cannot activate pending accounts.
- Reactivation: only previously usable deactivated accounts may use the existing flow. Reject invitation-pending/cancelled accounts and prevent status APIs from completing activation.
- Admin protection: only ACTIVE plus LEGACY/COMPLETE admins count as replacements; pending admins cannot keep the last real administrator from being protected.
- Email edits: pending email correction uses the dedicated endpoint. Do not falsely verify active users' new email addresses through the old edit endpoint; clear any verification timestamp when email changes. A fully verified active-account email-change flow is separate scope.
- First installation: after successful existing verification, explicitly create COMPLETE user and set emailVerifiedAt using actual proof. Keep permanent setup closure. CLI bootstrap requires an explicit documented LEGACY bypass; never claim CLI-created emails are verified.
- Inventory/request/directory selectors, statistics, account searches, notification recipients, admin notices, seed scripts and fixtures: audit every ACTIVE-status query and every user.create for the new default. Distinguish historical accounts from new production invitations.
- Student academic-record creation remains atomic as today. Acceptance does not silently rewrite the student's academic record if the active term changed while the invitation was pending; validate eligibility at actual transaction/request time.

## Frontend work

AccountDrawer: remove temporary-password and initial-status inputs; keep role-specific required fields; button Send invitation; explain recipient sets password. Keep existing-account password recovery actions separate.

ManageAccounts/types/API: expose safe activation, expiry and delivery summaries; filters/badges for pending; resend/correct/cancel actions with cooldown messaging and explicit confirmation for cancellation; invitations must not show ordinary Activate/Deactivate or password-reset actions. Surface errors without clearing the admin's form.

Activation page: responsive accessible password/confirm form, visible requirements, show-password controls, paste/password-manager support, submit busy state, recoverable failure state, expired/used state and success state. Link refresh after fragment removal should explain reopening the email rather than persist secrets. Use standalone unauthenticated route and test direct navigation on Render. If another account is signed in, do not overwrite its session during activation.

## Implementation sequence

1. Add schema/migration and activation eligibility helper. Backfill existing rows explicitly. Update all auth gates, last-admin safeguards, bootstrap paths and fixtures before any invitations are created.
2. Build invitation service, locked state transitions, token lifecycle, transactional audit/outbox support and worker stale-mail suppression. Add focused service tests.
3. Add admin endpoints and public inspect/accept endpoints; validate payloads, authorization and rate limits. Close old create-password/reset/reactivation bypasses.
4. Update account forms/list and add activation page; integrate existing password components and email templates.
5. Add integration/browser coverage, migration/production rehearsals and operator documentation. Verify no secrets appear in logs or API responses.
6. Deploy and exercise staging with controlled test inboxes, then promote the exact tested commit to production.

## Acceptance test matrix

Creation: student/faculty/admin validation; duplicate/case-variant email policy; unauthorized callers; rejects supplied password/status; invalid delivery configuration; transaction rollback including initial student record/audit/outbox; reserved address cannot be duplicated.

Tokens: valid acceptance; invalid/malformed/expired/revoked/used; wrong invited email; no activation on GET/inspect; links copied into new browser; short/oversized UTF-8 password; mismatch; show/hide; no automatic login; success persists after reload.

Races: two accepts (exactly one success); accept vs resend/correct/cancel/deactivate; concurrent resends; email uniqueness collision; failed audit/outbox insert rolls back activation; expired-between-hash-and-commit.

Security: pending/cancelled login and forged/stale-session use denied; status/reset/reactivation cannot bypass; old invitation invalid after email/role changes; non-admin admin-endpoint denial; no token/password in JSON/logs/audit; token fragments cleared; limiter covers successful resend requests, not just failures.

Delivery: disabled config; queue retry; fifth failure; stale lock recovery; resend invalidates previous mail; delayed old mail; message already sending during cancellation; no cross-environment URLs or production mail from fixtures; provider acceptance distinct from inbox delivery.

Regression: existing ACTIVE/DEACTIVATED users keep behavior; last-admin protection ignores pending admin; installation wizard and CLI still work; new users get correct role profiles/academic records; authenticated password change and recovery still work.

Browser: desktop/mobile create and activate; keyboard/focus/labels; form retained on error; correct action visibility; pending badges/filter; direct /activate-account reload and unknown-route behavior; setup via real staging inbox, then sign in and verify role access.

## Migration and rollout

Use a forward additive migration, never reset production. Backfill all preexisting users LEGACY, leave passwordHash/status/sessionVersion untouched and emailVerifiedAt null. Add default PENDING only for future inserts. Verify migration ordering with fresh database and existing-baseline upgrade rehearsals.

Critical deployment constraint: an old server ignores activationState, so rolling back only application code after invitations exist is unsafe, especially if a legacy password reset can give a pending user a known password. Keep traffic/invitation creation disabled during the migration/application cutover, or first ship an eligibility-aware compatibility release. Do not mix old/new instances for invitation operations.

Staging gate: current regression suite, invitation service/API tests, test:setup, test:ui, deployment smoke and a controlled real-inbox round trip. Do not send bulk invitations or use real student lists during testing. Inspect pending delivery failures and acceptance audit events.

Production gate: verified backup, healthy email sender, correct official FRONTEND_URL, tested migration, matching frontend/backend release. Invite one controlled non-admin first, test the full flow, then allow normal admin use. Keep at least one working legacy/complete administrator throughout.

Rollback: prefer forward fix. Disable new invitation creation and revoke pending links if required. Keep activation-aware authentication deployed. Do not delete invitation schema or roll back to a status-only auth build while pending/cancelled records exist. Existing completed/legacy users keep access. Document a tested recovery procedure before release.

## Documentation and completion definition

Update docs/API.md, EMAIL_NOTIFICATIONS.md, instructor-handover-checklist.md, reproducible-verification.md, first-time-setup.md (bootstrap distinctions), future-updates.md and the account-management guide if present. Document expiry, resend limits, failed delivery, wrong email, cancellation and support contact.

Done means administrators never choose or see new-user passwords; only inbox holders can complete setup; no alternate endpoint bypasses activation; old accounts remain usable; invitation delivery and errors are observable without exposing links; staging tests and rollout rehearsal pass. No implementation is authorized by this plan document alone.

## Required regression protection and release evidence

These are implementation acceptance requirements, not a promise of zero defects. Do not call the change production-ready based on invitation tests alone.

### Establish the baseline first

Before changing application code, record the commit and run the existing build, lint, regression, setup, UI and deployment checks against the explicit isolated local test database. Record pre-existing failures separately; do not silently attribute them to or excuse them with this change. Never point automated fixtures at staging or production. Capture representative legacy ACTIVE and DEACTIVATED accounts for all roles in isolated fixtures, including existing sessions, academic records and open requests.

### Preserve unrelated behavior

- Do not refactor borrowing, inventory, schedule-conflict, PDF or academic-period rules as part of this feature.
- Keep existing-account response fields and status values compatible. Add activation metadata; change only the deliberately replaced new-account creation contract.
- Existing passwords, role/profile relationships, account status, sessionVersion and academic records must be unchanged by migration. Verify this with assertions, not just row counts. Do not print password hashes or secrets in test output.
- Test unchanged legacy sessions after migration, while proving pending/cancelled users cannot obtain or reuse sessions.
- Keep password recovery, deactivation/reactivation and first-time installation as distinct flows. Shared outbox changes require tests for existing reset, setup, status-change and notification emails as well as invitations.
- Audit every eligibility query, especially last-active-admin checks, role selectors and notifications. Pending profiles must not accidentally count as usable accounts or invalidate existing records.
- Update fixtures explicitly for legacy or completed accounts. Do not make every fixture bypass activation, remove old assertions or weaken authentication to get tests passing.

### Cross-feature verification matrix

| Existing feature | Required checks after implementation |
| --- | --- |
| Login and sessions | Legacy users of each role sign in; valid existing sessions survive migration; logout/password change/session revocation still work; deactivated users remain blocked. |
| Account administration | Edit existing profiles; deactivate/reactivate eligible users; preserve immutable roles; protect last usable admin; invitation metadata does not break account filters/pagination. |
| Academic directory and student records | Programs, departments, rooms, years and terms still load; current and historical student records remain intact; invited student's initial record is atomic and correct. |
| Requests | Existing student/faculty submit, view and cancel requests; admin approve/reject; ownership/privacy, duplicate submission and concurrency protections remain intact. |
| Inventory | Availability, checkout, returns including partial returns, counters and archive rules retain their existing behavior. |
| Lab schedules | Existing create/edit/conflict checks, role access, weekly/one-time views, mobile views and academic-period filters remain correct. |
| Reports and exports | Existing report PDF endpoints and chart PDF export still work with ordinary active accounts; invitation-pending users cannot access them. |
| Notifications and email | Existing notification views and data-refresh behavior work; queued emails retain retry semantics; invitation cancellation does not cancel unrelated messages. |
| Setup and deployment | Fresh install, permanently closed completed setup, explicit CLI bootstrap, existing-database upgrade, repeated migration and schema comparison pass. |
| User interface | Desktop/mobile account forms, menus, error states, focus, password controls and existing navigation remain usable. |

Use the existing backend suites for these behaviors, including users, auth, sessionSecurity, adminAccessProtection, adminAccessConcurrency, privacyAuthorization, academicDirectory, studentAcademicRecords, borrowRequests, inventoryConcurrency, equipmentReturns, labSchedules, notifications, auditGuarantees and realistic-user-journey. Check backend/tests/regression-suites.json and test runners so new invitation suites are actually selected, not merely present on disk.

### Ordered verification commands

Run from the repository root with the managed local test environment configured. Stop on failure rather than continuing to deployment:

1. npm run db:generate
2. npm run build
3. npm run lint:ci
4. npm run test:regression (including registered invitation suites)
5. npm run test:setup
6. npm run test:ui (extend for invitation browser scenarios)
7. node scripts/test-ui.cjs --deployment
8. node backend/scripts/test-chart-pdf.cjs

Also exercise a real staging invitation with a controlled inbox and repeat one representative student, faculty and admin journey after deployment. An email accepted by Brevo is not a completed end-to-end test; complete activation and sign-in. Record expected results, actual results, commit and date. Staging validation is separate from automated isolated tests and must not reset the shared staging database.

### Stop conditions

Do not promote if any new regression is unresolved, an existing user is unexpectedly locked out, historical data changes, invitation acceptance bypasses role/status restrictions, email failures have no recovery, or the safe rollback procedure has not been rehearsed. Do not waive failures merely because the invitation itself works. Any accepted pre-existing limitation must be explicitly documented with its impact.

Store a concise verification record for the exact release commit. Production promotion must use that tested commit, not an untested branch tip. After promotion, check login, a representative authorized read, invitation delivery and error logs; avoid creating production transactions solely for testing without an agreed test account and cleanup procedure.
