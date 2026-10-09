# Equipment validation

Equipment names are required (150 characters maximum), whitespace-normalized, and unique regardless of case or repeated whitespace, including archived records. Different variants need distinct names. Descriptions are optional text (1000 characters maximum). Zero stock remains valid.

The existing stock consistency, approved-reservation checks, checkout/return rules, archive/restore behavior and transaction history are preserved. Total or damaged stock edits require a reason (500 characters maximum), recorded with before/after values in the audit log. The editor no longer silently changes damaged stock when total stock is lowered.

PUT /equipment/:id requires expectedUpdatedAt from the equipment record. An outdated or missing value returns 409; refresh and reopen the editor. This also affects external API clients. Deploy frontend and backend together.

## Local verification

From backend, after building:

```powershell
node scripts/test-equipment-validation-local.cjs
node scripts/test-request-types-local.cjs
```

The new test requires local PostgreSQL and uses a randomly named isolated schema in smartlab_test. It tests actual HTTP routes, concurrent writes, audits, reservation rollback, archive with outstanding loans, return and restoration. It never uses the public schema for its fixtures.

## Deployment

Before applying the migration, set DATABASE_URL securely for the intended database, then run:

```powershell
node scripts/check-equipment-validation.cjs
```

This is read-only and includes archived equipment. Resolve any duplicate names deliberately; do not delete or automatically merge equipment linked to requests. Review invalid names/descriptions too. When the check passes:

```powershell
npx.cmd prisma migrate deploy
npx.cmd prisma migrate status
```

Deploy the matching frontend/backend release and refresh existing browser tabs. The new migration adds a normalized name unique index; it does not delete or modify existing equipment. Report calculations and existing equipment IDs are unchanged.
