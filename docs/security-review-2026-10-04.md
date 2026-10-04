# Security review — 4 October 2026

Scope: targeted source review of authentication, route authorization, password recovery, profile updates, email delivery and PDF rendering. This is not a penetration test or a guarantee against all vulnerabilities. No production attack traffic, email or database modifications were performed.

## Changes
- Authenticated API requests: 300 per user per minute.
- Authenticated POST/PUT/PATCH/DELETE: 60 per user per minute, within the API limit.
- Password changes: 5 attempts per user per 15 minutes, including successful attempts.
- PDF reports: 10 per admin per minute, in addition to existing report size/concurrency limits.
- Limits reserve slots synchronously, return 429 with Retry-After, bound memory to 20,000 identities and expire buckets. Identity is taken from verified authentication, not an arbitrary forwarded header.
- Non-admin profile updates reject email changes, including email/gmail aliases. Previously the UI restriction was bypassable via direct API calls. Admin email updates remain supported.
- Account creation, password changes and recovery enforce 8 characters minimum and bcrypt's 72 UTF-8 byte maximum. This prevents silent password truncation. Existing login passwords remain compatible.
- API responses explicitly use Cache-Control: no-store. Express's existing default 100kb JSON limit is now explicit.

## Existing protections inspected
JWT HS256 verification; database-backed status/session-version validation; admin-only privileged routes; user ownership checks for profile/request access; hashed single-use expiring recovery tokens; parameterized SQL; escaped email HTML; outbound resource blocking in Chromium PDF rendering; Helmet and exact-origin CORS. These observations are source review, not exhaustive runtime authorization coverage.

## Verification
Backend TypeScript build passed. securityHardening and perimeter suites: 18 checks passed with a local HTTP harness and mocked profile database, no email. Includes concurrent reservations, identity separation, expiry, spoofed forwarding headers, direct profile email edits and UTF-8 password boundaries.

## Remaining work and operational limits
- npm audit --omit=dev could not reach the npm registry in this environment. Dependency vulnerability status is unverified; rerun with registry access, review advisories, then apply targeted compatible upgrades. Do not blindly use audit fix --force.
- Limiters are process-local and reset on deployment/restart. Before multiple replicas, use a shared atomic rate-limit store. These controls are not DDoS protection.
- General user limits execute after authentication and its user lookup. They do not eliminate unauthenticated traffic or database lookup costs. Use hosting/edge controls for volumetric protection.
- Existing login limiter allows 120 IP attempts/minute and 10 failed account attempts/15 minutes. Verify proxy configuration on Render: without trusted proxies, multiple clients may share the proxy address; never trust arbitrary X-Forwarded-For or enable trust proxy globally. Determine trusted proxy addresses from the deployment, not guesses.
- Run the full managed database authorization/session suite on a disposable local test database before release; it was not run in this review.
- Confirm secrets previously shown in screenshots have been rotated. Restrict temporary external database access after maintenance.
- Monitor legitimate requests for 429 responses and tune limits from actual use. Shared school network IPs do not merge authenticated user budgets, but login IP budgets can be shared.

No migration is needed. Deploy backend changes with their new middleware and password-policy files together.
