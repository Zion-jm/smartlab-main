# SmartLab step 8 — account access and session invalidation

Implemented locally on 2026-09-30.

## What this does

Each account has a session version stored in the database. A login token contains the version that was current when the person signed in. Every authenticated API request now verifies that the account exists, is ACTIVE, and still has that version. Permissions use the current database role, never the role written into an old token.

Changing a password increments the version and ends all previous sessions, including the current browser session. Changing account status, role or email through the supported account APIs also invalidates previous sessions. Ordinary name/phone edits leave sessions active.

Deactivation takes effect on the next authenticated request. Reactivation requires a fresh login; old tokens remain invalid. Requests already admitted by middleware may finish; this does not interrupt an in-flight operation. Password changes additionally check the current account state/version at the database update, and concurrent password changes cannot both succeed.

Administrators can explicitly end all sessions without deactivating an account using POST /api/users/:id/revoke-sessions with their authenticated bearer token. This endpoint returns 404 for an unknown account and rejects anonymous/non-admin callers. There is no dedicated revoke-sessions button in this change; the existing account deactivation controls are supported.

The frontend clears its saved authentication on explicit SESSION_INVALID responses. Ordinary permission denials and temporary authentication database failures do not trigger a logout. After changing your password, the current browser signs out immediately. A delayed failure from a different token does not clear a newer login.

## Database change and rollout

Added users.sessionVersion, an integer with default 0. Applied only to localhost smartlab_test using the guarded backend/scripts/apply-local-session-version.cjs script. Prisma Client regenerated. No database reset, seed, record deletion, or remote deployment was performed.

The reviewed additive SQL is backend/prisma/session-version.sql. Before running this code against the previous hosted development environment or another database, back up that database and apply that SQL, then generate Prisma Client and build/restart the API. The helper script intentionally refuses databases other than local smartlab_test. Do not run a reset to install this column.

Previously issued tokens do not contain a session version and are rejected. All users must sign in again after this update. Restart your local development processes to load the regenerated Prisma Client.

Future password-reset or account-access mutation code must increment sessionVersion in the same database write. Direct manual database edits do not automatically increment it. Keep the version column if reverting application code; removing it is unnecessary, and reverting authentication code restores the previous security weaknesses.

## How to see the change locally

1. Restart your usual local development command and refresh localhost:5000. Sign in again.
2. Use an administrator browser session and a separate private-window session for a disposable test account.
3. Deactivate that test account from Manage Accounts. Make another request in its private window. Its session should end.
4. Reactivate it. The old session should still fail; signing in again should work.
5. Change the disposable account's password from its profile. Sign in using the new password. Any other session for that account should be rejected on its next API request.
6. Changing just the account's name should not end its session.

Use a disposable test account, not your only administrator, for deactivation tests.

## Verification

178 tests passed across 11 suites, including 16 new session-security tests. Backend TypeScript and frontend TypeScript/Vite builds passed. Existing Vite bundle-size warning remains. Browser click-through behavior was not manually exercised; API/database behavior and compilation were verified.

New tests cover active-token deactivation, protected mutations, inactive login, reactivation, password replacement, incorrect current password, simultaneous password changes, administrator revocation, revocation route authorization, deleted users, legacy tokens, role/email edits, current database permissions and profile-only edits. Prior authentication, inventory, approval, adjustment and Manila time tests passed.

Tests used isolated records in local smartlab_test, with a temporary API on port 3119 and SMTP disabled. The test server was stopped afterward. Full results: SmartLab-Fix-8-Test-Results.txt.

## Changed files

- backend/prisma/schema.prisma and session-version.sql
- backend/scripts/apply-local-session-version.cjs
- backend/src/middleware/auth.ts
- backend/src/routes/auth.ts and users.ts
- backend/tests/sessionSecurity.test.js
- frontend/src/services/api.ts
- frontend/src/stores/authStore.ts
- frontend/src/pages/ProfileRoute.tsx

SmartLab-Before-Fix-8.zip preserves pre-change backend/src, backend/tests, backend/prisma and frontend/src. It is a source snapshot, not a database/full repository backup. It excludes .env files and dependencies. New files must be considered separately if reverting. All edits remain local and uncommitted alongside earlier work.

Next checklist item: step 9, preserve history and inventory during account/equipment retirement.
