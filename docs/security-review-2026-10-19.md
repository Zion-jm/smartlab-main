# Security review — 19 October 2026

Scope: source review of Express API ingress, authentication/session validation, role/ownership checks, setup, recovery, SQL/HTML handling, deployment configuration and dependency audit. No production attack traffic, account changes or external messages. This is not an exhaustive penetration test or a guarantee against compromise.

## Findings addressed

1. Authenticated API limits previously executed only after the database user lookup, and unknown API paths had no general limiter. Added a broad IP limit before JSON parsing and authentication: 3,000 requests/minute, with bounded memory and 429/Retry-After. Added a separate 120/minute readiness limit because readiness queries the database. Existing narrower limits remain.
2. Authorization accepted any two-part header regardless of authentication scheme. Now only an exact Bearer credential is accepted; oversized/malformed headers fail before JWT/database work.
3. `securityHardening.test.js` existed but was omitted from the managed regression manifest. Included it and added malformed-header and pre-parser throttling tests.
4. Set HTTP headers timeout to 15 seconds, request-body timeout to 30 seconds, and idle keep-alive timeout to 5 seconds. These do not impose a deadline on database query execution or stop volumetric attacks.

## Current limits

| Scope | Limit per process |
| --- | --- |
| All API ingress | 3,000/IP/minute |
| Readiness endpoint | 120/IP/minute |
| Authentication | 120/IP/minute; 10 failed account attempts/15 minutes |
| Setup routes | 30/IP/minute; account limit where email is supplied |
| Authenticated API | 300/user/minute |
| Authenticated writes | 60/user/minute |
| Password change | 5/user/15 minutes |
| Reports | 10/admin/minute plus existing size/concurrency controls |
| Setup emails | Database-backed 1-minute cooldown and 5/hour |

The API ingress allowance is deliberately broad for campus networks. Test realistic concurrent usage and monitor 429 responses. Do not blindly lower it or trust arbitrary forwarding headers.

## Existing controls reviewed

- HS256-only JWT verification; database-backed role, account-status and session-version checks. Administrator permission checks and ownership checks on profile/request/notification routes examined.
- Bcrypt hashes and password byte bounds; recovery tokens hashed, expiring and single-use; generic forgot-password response. Browser setup requires a private deployer token and verified address; final creation is transactional and setup closes permanently.
- Prisma and parameterized raw SQL in runtime source. The unsafe raw call found in setup is a fixed LOCK statement, not user interpolation.
- No `dangerouslySetInnerHTML` or eval found in the searched application source. Email/PDF templates escape variable text. Existing PDF tests cover blocked external requests, browser cleanup and timeout limits.
- Helmet, explicit origins, explicit 100KB JSON limit, production environment validation and filtered error responses. Tracked environment files are examples; Docker excludes environment files and backup dumps.

These are code observations, not exhaustive live exploit tests or a history-wide secret scan.

## Verification

- Backend TypeScript compilation passed.
- 52 tests passed across securityHardening, perimeter, authErrorContract and configuration using loopback HTTP fixtures/mocked databases. This exercises throttling, spoofed forwarding headers, CORS, malformed authentication, profile email restrictions and configuration boundaries.
- `npm audit --json` completed: zero reported vulnerabilities across the current dependency graph. Evidence: `artifacts/security-audit-2026-10-19.json` (local artifact). This does not cover OS/Chromium container packages or unknown vulnerabilities.
- Full managed database regression suite and deployment rehearsal must be rerun after these changes. Prior successful runs preceded this patch.

## Remaining risks and follow-up

- Rate-limit state is process-local and resets on restart. Multiple replicas need shared atomic counters. Hosting/edge DDoS controls are necessary for traffic floods; application middleware is insufficient.
- Confirm Render proxy topology before setting TRUSTED_PROXIES. Without it, clients can share the proxy budget; overly broad trust can allow IP spoofing. Hosting configuration was not inspected.
- JWTs are stored in localStorage, so successful XSS can steal a token. Consider HttpOnly secure cookies with CSRF protection as a separate coordinated session migration. No script-injection exploit was demonstrated here.
- Administrator MFA and failed-login security alerting are not implemented. Consider those before broader public use.
- Login returns earlier for unknown users than for a wrong password on a known user. Generic errors prevent direct disclosure but timing-based enumeration remains possible; rate limits reduce, not eliminate, this risk.
- Review database TLS certificate verification, least-privilege credentials, network access rules and secret rotation in the actual hosting accounts. Those settings are not established by source review. Keep INITIAL_SETUP_TOKEN unset on existing installations.
- Restore drills, monitoring, patching, and a response plan remain operational requirements. Actual setup email delivery/browser acceptance still needs the separate disposable-installation check.

Reference: [OWASP REST assessment guidance](https://cheatsheetseries.owasp.org/cheatsheets/REST_Assessment_Cheat_Sheet.html). It calls for checking endpoint authorization and the cost of individual requests as well as request frequency.
