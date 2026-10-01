# SmartLab step 15 — shared Prisma access and measured indexes

Completed 2026-10-01 in E:\BSIT 3 - DBA\smartlab-v2. No production deployment or changes to the existing application's database indexes were performed.

## Application changes

All 17 application-source PrismaClient constructions now resolve to backend/src/db/prisma.ts, which owns one pool per API process. Separate CLI scripts and isolated tests retain their own lifecycle. Environment loading precedes client construction in the server entry point.

Transaction owners (approval, retirement, inventory and route mutations) retain the root client only to start transactions. Inventory movement/capacity, cancellation, required audit writes and conflict checks use the supplied transaction client. Academic-period readers now accept Prisma.TransactionClient too. Do not substitute the shared root inside a transaction or open nested transactions. Existing Serializable retry behavior remains intact.

SIGINT/SIGTERM stop HTTP acceptance, close idle connections, wait for active handlers, drain tracked post-commit notifications, then disconnect the shared pool. Shutdown is idempotent and has a 65-second deadline, allowing the existing 60-second PDF operation timeout. Configure the deployment supervisor's termination grace above 65 seconds. Startup/shutdown coordination prevents listening after shutdown starts. Failed shutdown or grace expiry exits with failure. Notification failures log a safe message; admin notifications now use one createMany after the recipient lookup. These remain best-effort notifications, not a durable outbox. Abrupt process termination can still lose them.

## Index decisions

Migration: backend/prisma/migrations/0005_measured_query_indexes/migration.sql. Matching @@index declarations are in prisma/schema.prisma.

- Add BorrowRequestItem(equipmentId): equipment-centric item reads otherwise scan 100,000 rows.
- Add BorrowRequest(academicYearId, termId, status, dateNeeded): supports selective period/status/date filters. It does not replace every sort or status-group query.
- Defer BorrowRequest(requestedBy, createdAt): the tested personal endpoint includes academic-period filters and an id tie-breaker; PostgreSQL still chose the existing requester and period indexes plus a small sort even with the candidate installed. No demonstrated benefit justifies its write/storage cost.
- Replace the proposed four-column schedule candidate with LabSchedule(academicYearId, termId, roomId). The actual conflict SQL filters these three columns and resolves recurring/day semantics in application code. dayOfWeek adds no predicate benefit here.
- Add LabSchedule(borrowRequestId): direct lookup of request-derived schedules.
- Add Notification(userId, createdAt): recent 30 notifications for a user.
- Add AuditLog(actorUserId, createdAt): recent actor-specific audit history.
- Preserve existing indexes; removing overlapping indexes needs a broader workload study.

## Query-plan evidence

Reproducible script: backend/scripts/benchmark-indexes.cjs. It requires local localhost/127.0.0.1 smartlab_test and SMARTLAB_EVIDENCE_DIR, creates a uniquely named schema, deploys migrations, measures baseline/candidates/final selection, and drops only its generated schema in finally. It never resets or seeds the existing application schema. Re-running with migration 0005 present explicitly removes the candidate indexes inside the isolated schema before the baseline.

Fixture: 100,000 requests, request items, notifications and audit logs each; 50,000 schedules; 100 users, 100 rooms, five academic years, two terms and 1,000 equipment records. SQL mirrors the relevant base-table predicates and ordering, rather than claiming end-to-end API timings or including every Prisma relation query. Plans use EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON), ANALYZE statistics and five repeated samples. The last run was performed after builds, tests and smoke processes finished. Full plans and buffer statistics are in SmartLab-Fix-15-Query-Plans.json.

| Query | Baseline median ms | Selected-index median ms |
| --- | ---: | ---: |
| Equipment request items | 8.276 | 0.223 |
| Period/status/date requests | 1.890 | 0.131 |
| Personal request history | 0.781 | 0.661 |
| Room conflicts | 0.628 | 0.114 |
| Request-derived schedules | 11.286 | 0.038 |
| Recent notifications | 0.862 | 0.069 |
| Actor audit history | 0.718 | 0.055 |
| Equipment substring search | 0.926 | 0.506 |

All six selected indexes appear in their respective final query plans. The personal-history plan uses the existing indexes. The substring plan still uses a sequential scan with an ILIKE filter: timing variation does not establish an index improvement. No text-search index or extension was added. The equipment fixture is only 1,000 rows; broader multi-field and relation substring searches need production-shaped measurements before considering trigram/full-text approaches.

## Write/storage tradeoff

Each sample performs 1,000 inserts or updates under EXPLAIN ANALYZE inside a rolled-back transaction; three samples per operation, with foreign-key checks enabled. These medians are directional local observations, not a controlled production overhead percentage: cache, WAL, rollback-created dead tuples and fixed measurement order can affect them.

| Operation (1,000 rows) | Baseline median ms | Selected-index median ms |
| --- | ---: | ---: |
| requests | 55.336 | 128.749 |
| items | 62.603 | 73.687 |
| schedules | 116.942 | 137.402 |
| notifications | 34.938 | 65.373 |
| audit | 31.449 | 57.230 |
| requestStatusUpdates | 53.131 | 89.121 |
| notificationReadUpdates | 45.748 | 105.292 |

The six indexes occupied 10.48 MiB on this fixture after write probes. Writes became slower in this run; the migration trades that cost for observed reductions in scans and recent-history reads. Recheck actual read/write volume, table sizes, pool pressure and plans after deployment; these measurements are not production p95 or a guarantee at other cardinalities.

## Verification

- Backend and frontend builds passed. Existing frontend bundle-size warning remains; Vite also reported plugin timing warnings.
- 461 tests passed across 23 suites, including nine lifecycle/transaction tests and existing authorization, inventory concurrency, audit rollback, paging and report-limit regressions.
- Fresh migrations, repeated deployment and schema diff passed in an isolated schema.
- Existing-baseline adoption and upgrade passed; legacy stock/archive intent survived, repeat deployment preserved restored data, and inventory constraints still reject invalid counters.
- Production rehearsal passed readiness, built SPA/deep links, assets, CORS, authentication/API calls and actual PDF generation (269,246 bytes).
- Source review finds exactly one new PrismaClient in backend/src.
- Shutdown ordering/deadline are unit-tested with injected dependencies. Windows child-process termination in the smoke harness does not establish POSIX signal delivery on the deployment host; verify supervisor SIGTERM/grace handling there.

Evidence: SmartLab-Fix-15-Tests.log, SmartLab-Fix-15-Build.log, SmartLab-Fix-15-Production-Smoke.log, SmartLab-Fix-15-Migration-Upgrade.log, SmartLab-Fix-15-Benchmark.log and SmartLab-Fix-15-Query-Plans.json. Prechange source/schema/test snapshot: SmartLab-Before-Fix-15.zip (no environment secrets or dependencies).

## Deployment and reproduction

Use the existing production-deployment guide and approved migration process. This new migration uses ordinary CREATE INDEX and can block writes while building: schedule a maintenance window appropriate to real table size. Do not run it automatically at API startup. For an existing untracked database, follow the documented baseline-adoption process rather than blindly deploying all migrations. No public-schema migration was applied during this step.

From backend, after installing dependencies and building:

```powershell
$env:SMARTLAB_EVIDENCE_DIR = 'C:\path\to\evidence'
node scripts/benchmark-indexes.cjs
node scripts/smoke-migration-upgrade.cjs
node scripts/smoke-production.cjs
node node_modules/jest/bin/jest.js tests/prismaLifecycle.test.js --runInBand
```

The smoke scripts require the local test database, configured environment and Chromium for PDF checks. The broader 23-suite regression also requires the existing test-server setup; see the previous remediation guides. Step 20 remains responsible for consolidating test setup/CI. Next checklist item: step 16, control-ribbon compliance.
