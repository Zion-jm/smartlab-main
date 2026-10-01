# SmartLab production preparation — step 11

Prepared locally on 2026-10-01. Nothing was deployed, and no hosting provider was selected.

## Deployment design

One Node web service serves the compiled React app and Express API. PostgreSQL is configured separately. Leave VITE_API_BASE_URL unset so the browser uses the same-origin /api path. The eventual provider supplies HTTPS and forwards traffic to PORT.

Production uses compiled files only. Startup does not install packages, migrate, push schema changes or seed demo data. It checks configuration, database access, required columns and frontend index.html before listening. /health is liveness; /ready checks database connectivity without exposing user counts or database diagnostics. The old /api/test-db endpoint was removed.

React deep links serve index.html. Unknown API paths return JSON 404. Hashed assets use long-lived immutable caching, while index.html is revalidated. Production CORS allows the exact configured FRONTEND_URL; it does not replace authentication.

## Runtime requirements

- Compatible Node runtime (rehearsed with Node 22.13.0).
- PostgreSQL and a migration role allowed to create/alter tables, types and constraints.
- Chromium/Chrome for PDF exports, its OS libraries/fonts, and a writable temporary directory. Set CHROMIUM_PATH to the executable. A Node runtime alone is insufficient for reports.
- Keep backend/dist, frontend/dist, frontend/public (PDF images), Prisma migrations and generated Prisma Client/runtime dependencies in the workspace layout.
- Never package real .env files or local test data. Supply secrets through deployment configuration.

No container or provider-specific manifest was added. The local Windows rehearsal does not validate a future Linux host's system libraries, TLS or proxy settings.

## Production environment

DATABASE_URL is the private PostgreSQL connection URL. JWT_SECRET must be randomly generated and at least 32 characters. FRONTEND_URL must be the exact HTTPS origin without a trailing slash or path. PORT comes from the provider or your configuration. NODE_ENV is set to production by start:production. CHROMIUM_PATH identifies the PDF browser.

SMTP settings are optional; empty SMTP_PASS disables delivery. Configure real mail separately before relying on notifications. HTTP origins are allowed only for localhost/127.0.0.1 production rehearsals. Secret length is not a substitute for randomness.

## Empty database deployment

From the repository root, with the intended environment configured:

1. Run `npm ci`.
2. Run `npm run db:generate`.
3. Run `npm run build`.
4. Run `npm run db:deploy` and `npm run db:status`.
5. Explicitly initialize the administrator as described below.
6. Run `npm run start:production`.

Build tools require development dependencies. Do not install production-only dependencies before building. Keep the Prisma CLI available for the release migration operation, and Chromium/PDF assets in the runtime. Run migration deployment once before replacing API instances.

Migration order: 0001_baseline, 0002_inventory_constraints, 0003_session_version, 0004_equipment_lifecycle. Track migrations in Git; do not edit migrations after applying them to shared databases. Add new migrations instead. db:migrate now invokes Prisma migrate dev for development; production uses db:deploy, never migrate dev, db push, reset or demo seed.

## Existing database without migration history

Do not reset the database or blindly mark all migrations applied.

1. Back up the database and rehearse on a restored copy. Coordinate a pause in old application writes for rollout.
2. Review the actual tables, types, columns, indexes and foreign keys against backend/prisma/baseline-schema.prisma. Already applied sessionVersion/retiredAt additions and inventory constraints are expected differences.
3. From backend, inspect with `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/baseline-schema.prisma --script`.
4. This is diagnostic output, not SQL to execute blindly. It may propose dropping newer columns to match the old baseline; do not execute those removals. Investigate unexpected differences separately.
5. Only after confirming that the baseline schema already exists, run `npx prisma migrate resolve --applied 0001_baseline` from backend.
6. From the root, run db:deploy and db:status. Later migrations tolerate the earlier manual column/constraint additions. Invalid historical inventory blocks constraint validation and must be investigated.
7. Compare the result with current schema.prisma, then start the compiled app and smoke-test it.

The existing local application's public schema was NOT automatically baselined. Adoption was tested in a separate disposable schema. A database with its own migration history needs reconciliation rather than blind resolve commands.

The lifecycle migration backfills old UNAVAILABLE records only when introducing retiredAt. If somebody previously added that column without its backfill, review the data separately. Users must sign in again after the session-version rollout. Prisma diff does not represent all PostgreSQL features; inspect inventory CHECK constraints separately. Diagnose and repair failed migrations before making a documented resolve decision.

## Initial administrator

backend/scripts/create-initial-admin.cjs is an explicit initialization tool, never called at startup. Set temporary environment values CONFIRM_INITIAL_ADMIN=CREATE, INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (at least 12 characters), then run `npm run admin:initialize --workspace=backend`.

Remove those temporary values afterward. Passwords and database URLs are not printed. The script refuses if any administrator already exists; use account management instead. Concurrent bootstrap attempts are serialized using a database table lock. No demo accounts are seeded.

## Verification

Both builds passed; 250 regression tests passed across 14 suites. The existing frontend large-bundle warning remains.

- Fresh schema: four migrations deployed; repeated deployment and status passed; no automatic seed data appeared.
- Administrator initialization: missing confirmation refused, initialization succeeded, duplicate initialization refused.
- Production: readiness, built frontend/assets, deep links, API and asset 404 behavior, CORS, login, /auth/me and equipment API passed.
- Authenticated equipment PDF generated: 269,246 bytes with a PDF signature.
- The migrated schema matched the current Prisma model.
- Existing-baseline upgrade retained stock and legacy archive restrictions, preserved restoration on repeated deployment, and enforced the inventory constraint.
- Rehearsal schemas were removed. Existing local application data was not reset.

Logs: SmartLab-Fix-11-Production-Smoke.txt, SmartLab-Fix-11-Upgrade-Smoke.txt and SmartLab-Fix-11-Test-Results.txt. The checklist records the regression total.

For repeat verification after building, run `npm run test:production --workspace=backend`, or `node backend/scripts/smoke-migration-upgrade.cjs`. Both require local smartlab_test, create uniquely named schemas, and remove them. They are not production deployment scripts.

## Remaining launch work

Select a host supporting persistent Node processes, PostgreSQL and headless Chromium. Configure domain/TLS, secrets, backups, migration permissions and email. Rehearse adoption on a copy of the actual database, then verify real browser flows and reports on the selected host. These HTTP smoke tests did not execute React in a browser or validate a real HTTPS proxy.

SmartLab-Before-Fix-11.zip preserves the pre-change source/configuration snapshot; it is not a database backup. Changes remain local and uncommitted. No remote launch was performed.
