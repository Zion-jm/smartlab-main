> Update 1 October 2026: subsequent dependency remediation reports zero known vulnerabilities; CI now enforces a moderate-or-higher audit gate. Audit counts below describe the historical step 20 snapshot. See dependency-remediation.md and release-readiness-plan.md.

# SmartLab step 20 — reproducible verification

Updated 1 October 2026.

## Install and build

Use Node 22.13.0 and npm 10.9.2. The root `package-lock.json` is the sole JavaScript lockfile; install from the repository root with `npm ci`. Nested npm locks and the pnpm lock were retired. `uv.lock` remains for optional Python/PDF tooling, not the web application.

```text
npm ci
npm run db:generate
npm run build
npm run lint:ci
```

`lint:ci` runs full frontend ESLint with the existing rules and --max-warnings 0. It saves lint-results.json under SMARTLAB_EVIDENCE_DIR (default artifacts/lint), fails on any error or warning, and has no debt baseline. npm run lint --workspace=frontend enforces the same zero-warning threshold.

## Isolated regression tests

Create an empty local PostgreSQL database named `smartlab_test`. Set `TEST_DATABASE_URL` explicitly, using a role that can create/drop schemas in this test database. Do not include a `schema` query parameter. The runner does not fall back to the application's saved database URL.

PowerShell example (replace the placeholder locally):

```powershell
$env:TEST_DATABASE_URL='postgresql://postgres:REPLACE_WITH_URL_ENCODED_PASSWORD@localhost:5432/smartlab_test'
npm run test:regression
```

The runner rejects non-PostgreSQL URLs, remote hosts, other database names, supplied schemas, and production mode. It generates a unique schema, deploys migrations twice, seeds disposable fixtures, starts its own server on a free port, and passes explicit API/database settings to Jest. The schema and server are removed after success or failure. Existing schemas are not reset. Direct Jest execution without the matching managed schema/API environment is rejected.

The authoritative regression selection is `backend/tests/regression-suites.json`: 25 suites, 474 tests at this revision. Older exploratory suites outside that manifest remain historical coverage candidates; they are not counted as passing or included in `npm test`. Their contracts need review before admission. The runner replaces the former commands that assumed an already-running seeded server.

## Browser and deployment checks

```text
npx playwright install chromium
npm run test:ui
node scripts/test-ui.cjs --deployment
```

These commands use the same explicit `TEST_DATABASE_URL`. Set `CHROMIUM_PATH` to use an installed compatible browser. The UI command starts/stops its own fixture servers and checks 39 ribbon cases, 17 table/chart/calendar cases, and two controlled-table scroll-root cases. Reserve ports 3123 and 5174 for these checks; deployment rehearsal uses 3121. Run one browser verification command at a time. Artifacts default to the ignored `artifacts/` directory; `SMARTLAB_EVIDENCE_DIR` overrides it.

The deployment command tests fresh and adopted-baseline migrations in separate disposable schemas, repeated deployment, initial admin bootstrap guards, production startup/readiness, SPA routes, CORS, and actual PDF generation. No existing application schema is migrated by these test commands.

## Regression coverage for remediation steps 1–11

| Step | Repeatable coverage |
| --- | --- |
| 1 Public administrator registration | auth and privacy authorization suites |
| 2 Adjustment authorization | equipmentAdjustments and privacyAuthorization |
| 3 Secrets/startup seeding | configuration, seed safety guards, production bootstrap smoke |
| 4 Atomic inventory and retries | inventoryTransaction, inventoryConcurrency, inventoryCapacity |
| 5 Approval/conflict rules | approvalConcurrency and scheduleRules |
| 6 Manila date/time | manilaTime, manilaApi, scheduleRules |
| 7 Quantity validation | inventoryCapacity, equipment, equipmentAdjustments |
| 8 Deactivation/session invalidation | sessionSecurity, authErrorContract |
| 9 History-preserving retirement | retirement |
| 10 Equipment archive behavior | retirement/equipment API contracts; browser ribbon checks exercise the equipment screen, but do not claim a full archive-action browser journey |
| 11 Deployment/migrations | fresh production smoke and migration upgrade rehearsal |

The step 1–11 regression suites predate step 19's consolidation and are now part of the managed runner.

## CI and known limitations

`.github/workflows/verification.yml` provisions PostgreSQL 16, uses the pinned Node/npm setup and root lockfile, builds both packages, enforces strict zero-warning lint, runs regressions/browser contracts/migration rehearsals, and uploads evidence. The workflow is added locally; no hosted GitHub run or deployment was triggered.

The initial audit reported 75 findings. After refreshing the authoritative root lockfile while adding pinned Playwright, the final audit on 1 October 2026 reports 15 vulnerabilities: 10 high and 5 moderate, with no critical findings. The production-only audit found 10: 6 high and 4 moderate. Findings include direct and transitive packages; audit package counts are not distinct exploit counts. No blanket forced upgrades were applied. CI records the audit as advisory while this known debt remains; it does not represent a clean security gate. Review the JSON audit reports before deployment and plan targeted dependency upgrades with regression tests.

Historical plans and screenshots are explicitly labeled in `docs/README.md`, `screenshots/README.md`, and the archived original handoff. The current `PROJECT_HANDOFF.md` describes implemented behavior; historical proposals are not evidence of current completion.
