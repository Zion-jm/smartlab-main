# Future updates

Planned improvements for SmartLab. Items here are not implemented or deployed unless explicitly marked complete. Test changes on staging before promoting them to production.

## Session security and inactivity timeout

Recorded: 20 October 2026 (Asia/Manila).
Status: Planned; implementation not started.

### Purpose

Reduce the risk of an unattended browser remaining signed in, especially on shared laboratory computers, while warning users before their session expires.

Current behavior: login tokens expire 24 hours after login, are saved in localStorage, and have no inactivity timeout. This proposal replaces that flow with server-managed sessions.

### Proposed policy

| Setting | Administrator | Faculty / student |
| --- | --- | --- |
| Inactivity limit | 15 minutes | 30 minutes |
| Absolute session limit | 8 hours from login | 8 hours from login |
| Warning before inactivity expiry | 2 minutes | 2 minutes |

These are proposed SmartLab settings, to confirm with the instructor before rollout. Do not include a Remember me option in the initial implementation.

### User experience

- Refreshing a page keeps a valid session signed in.
- Show a countdown with **Stay signed in** and **Sign out** before inactivity expiry.
- Stay signed in extends only an unexpired inactivity deadline, never the eight-hour maximum. Expired sessions require a fresh login.
- Coordinate activity, warnings and sign-out across tabs in the same browser.
- Show a clear explanation when sign-in is required again.
- Decide how to preserve unfinished request forms without retaining sensitive information on shared devices. Never automatically resubmit a transaction after login.

### Implementation checklist

- [ ] Add a tracked database migration for sessions: user, hashed random session identifier, creation time, last qualifying activity, absolute expiry and revocation state; include appropriate indexes and expired-session cleanup.
- [ ] Replace localStorage authentication tokens with an HttpOnly, Secure, SameSite session cookie; define cookie path, expiry and local-development handling explicitly.
- [ ] Add CSRF protection and appropriate origin checks for state-changing requests, including session activity and logout endpoints.
- [ ] Enforce idle and absolute expiration on the backend for every protected request. Continue checking account status and authorization.
- [ ] Define qualifying activity. Notification polling, status checks and automatic refresh must not keep an unattended session alive. Throttle activity updates and never trust client-supplied timestamps to extend deadlines.
- [ ] Return server-calculated deadlines for the browser warning. Treat the browser timer as a usability feature, not the security enforcement.
- [ ] Implement warning, explicit continuation, expiry handling and multi-tab synchronization.
- [ ] Revoke the current server session on logout. Revoke affected sessions on password changes, account deactivation and administrator session revocation.
- [ ] Remove old browser token storage and update API requests, login state, CORS/CSRF handling and authentication tests together.
- [ ] Record session lifecycle events without logging raw cookies, tokens or credentials.

### Acceptance checks

- [ ] Automated tests with controlled time cover each role's idle limit and the eight-hour cap without waiting real hours.
- [ ] Stay signed in cannot revive an expired or revoked session or extend the absolute limit.
- [ ] Direct API requests fail after expiry or logout, even if the browser UI is bypassed.
- [ ] Background polling does not extend inactivity; deliberate activity behaves consistently across tabs.
- [ ] Password changes, deactivation and session revocation invalidate the expected sessions.
- [ ] Cookie attributes and CSRF protections are verified; normal production login and requests still work.
- [ ] Refresh, browser reopening, multiple tabs, connection loss and unfinished forms are tested on staging.
- [ ] Database migration, regression tests and deployment smoke checks pass.

### Rollout

Ship the frontend, backend, migration and tests together. Validate on staging, take a production backup, then promote the reviewed release. Existing users will need to sign in once under the new session system. Document that transition and a rollback procedure that does not restore acceptance of invalidated legacy tokens.

References: [existing session behavior](session-security.md), [verification](reproducible-verification.md), and [OWASP session-management guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
