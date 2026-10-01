# SmartLab step 12 — errors and audit guarantees

Completed locally on 1 October 2026 in `E:\BSIT 3 - DBA\smartlab-v2`. No deployment, push, commit, or database migration was performed.

## API error contract

API error responses include `{ "error": "Readable message", "code": "STABLE_CODE" }`. Existing validation/conflict detail fields remain available. Successful responses are unchanged.

| Status | Meaning | Default code |
| --- | --- | --- |
| 400 | Invalid input, dates, quantities, or JSON | VALIDATION_ERROR |
| 401 | Missing, invalid, expired, revoked, or inactive session | AUTHENTICATION_REQUIRED; SESSION_INVALID for unusable tokens/sessions |
| 403 | Authenticated caller lacks permission | FORBIDDEN |
| 404 | Requested record or route absent | NOT_FOUND |
| 409 | Duplicate record, relationship constraint, concurrent update, or prohibited state transition | CONFLICT |
| 413 | JSON request exceeds the parser limit | PAYLOAD_TOO_LARGE |
| 503 | Database initialization/connectivity/pool timeout failure | SERVICE_UNAVAILABLE |
| 500 | Unexpected application, database, or required audit failure | INTERNAL_ERROR |

`DomainError` and `ValidationError` carry status/code explicitly. Existing `RequestActionError` inherits that contract. The shared mapper handles Prisma failures; route catch blocks use it instead of interpreting message text. Calendar and status-transition failures are typed. Unexpected errors do not expose SQL, stack traces, credentials, or driver messages, including in development. Server diagnostics log the safe category.

Invalid tokens now consistently return 401. Database failures during authentication return 503 (or 500 for unexpected failures), never SESSION_INVALID. Both room and equipment conflict checks propagate failures; they do not report successful availability after failed lookups. These protections already existed in part and now have explicit regression coverage.

Prisma client validation errors remain 500 because they can indicate invalid server query construction. Known input validation is handled before queries. A foreign-key failure on a request referencing missing equipment is 409, rather than the former 400. Account email duplicates and invalid request states also use 409.

## Audit policy

Required audit records commit in the same transaction as:

- Equipment creation, stock edits, retirement and restoration.
- Request approval through either endpoint, rejection, borrowing, return and cancellation (including owner/adjustment cancellation).
- Equipment adjustments and adjustment responses.
- Schedule creation, editing (including linked requests), and deletion.
- Administrator account creation/editing, role/status changes, account retirement, explicit session revocation, password changes, and self-service email changes that revoke sessions.
- Active academic-period changes, which already had transactional auditing.

Failure of a required audit write aborts the transaction. The API cannot report success while these business changes commit without their required record. Approval is audited once in the shared service; duplicate attempts add no second audit. Email and notification delivery remain separate post-commit side effects, not guaranteed delivery.

Directory CRUD audit records (buildings, rooms, programs, subjects, departments) are explicitly optional descriptive records, through `recordOptionalAuditLog`. Their failure is logged and does not fail a completed directory edit. Ordinary reads, notification read flags, initial request submission/editing, login attempts, and ordinary self-service profile edits are outside this required-audit policy. This is a defined application policy, not a claim of comprehensive compliance logging.

The required audit helper propagates failures and applies the existing sensitive-key redaction and size/depth limits. Password hashes, tokens and secrets are not added to audit details. Retirement/restoration and academic-period activation retain their existing direct transactional audit inserts with limited fields.

## Verification

- Backend and frontend builds passed. Backend was rebuilt again after the final source changes. The existing frontend large-bundle warning remains.
- 300 tests passed across 17 suites in the full focused regression run.
- A final focused run passed 53 tests, adding three checks for report failures, exactly-once approval auditing, and optional-audit failure behavior. Together the runs cover 303 distinct tests.
- Database rollback tests inject required-audit failures and verify persisted stock, request state, account role/status, password hash, and session version remain unchanged. They use disposable fixtures in local `smartlab_test` and clean them up.
- Route failure tests inject database errors into the actual route modules. Authentication tests exercise the actual authentication middleware. Error responses are checked for status, shape and redaction. Report failure is tested before PDF generation.

Evidence: `SmartLab-Fix-12-Test-Results.txt`, `SmartLab-Fix-12-Fault-Tests.txt`, and `SmartLab-Fix-12-Build.txt`.

The new suites are `backend/tests/errorContract.test.js`, `authErrorContract.test.js`, and `auditGuarantees.test.js`. From `backend`, after building, run:

```powershell
node node_modules/jest/bin/jest.js tests/errorContract.test.js tests/authErrorContract.test.js tests/auditGuarantees.test.js --runInBand
```

The audit integration suite requires the existing local `smartlab_test` configuration; it refuses other database hosts/names. The older API regression suites additionally require a running test API via `TEST_API_URL`.

## Rollout and recovery

Restart the backend to use the rebuilt code. No schema change is needed for step 12. Clients should accept 401 for invalid sessions and 409 for conflicts. The existing frontend consumes the retained `error` string and SESSION_INVALID code.

`SmartLab-Before-Fix-12.zip` contains the pre-step source, tests and docs, excluding environment files and dependencies. It is not a database backup. Reverting requires restoring changed files and removing the new domain-error/middleware/test files; do not overwrite later work blindly.

Browser click-through and a real-host deployment were not performed. Step 11's real-host setup and earlier outstanding verification items remain outstanding. Next checklist item: step 13, data exposure and perimeter controls.
