# SmartLab 2.0 — current handoff

Updated 1 October 2026 following remediation steps 1–20. Implemented behavior and remaining limitations are distinguished below. The previous extensive inventory is retained as a labeled historical snapshot in docs/historical/PROJECT_HANDOFF-2026-09-29.md.

## Runtime and installation

Node 22.13.0, npm 10.9.2, PostgreSQL, React/Vite frontend, Express/Prisma backend. Use the root npm workspace and package-lock.json. Run npm ci, npm run db:generate, and npm run build from the repository root. Competing JavaScript lockfiles and unused Python tooling manifests have been retired.

Development: copy backend/.env.example to backend/.env and configure DATABASE_URL and a private JWT_SECRET. Run reviewed migrations with npm run db:deploy, then npm run dev. Frontend listens on loopback port 5000; backend uses 3001. Vite caches are separated by project and OS user to avoid Windows sandbox cache ownership conflicts.

Production: configure a private 32+ character JWT_SECRET, PostgreSQL DATABASE_URL, exact HTTPS FRONTEND_URL, optional exact CORS_ORIGINS, and explicit trusted proxy addresses where applicable. Build both workspaces, run reviewed migrations once, initialize the first admin with backend/scripts/create-initial-admin.cjs and its explicit confirmation, then npm run start:production. Read docs/production-deployment.md before adopting migrations on an existing database. Startup does not seed or push schemas. Configure CHROMIUM_PATH for PDF export; SMTP_PASS is optional and absent credentials disable email delivery. /health is liveness; /ready checks database readiness. Production serves the built SPA and API together.

## Implemented remediation

Public registration cannot create administrators. Authorization, current account status, session invalidation, and resource visibility are enforced on the server. Inventory and approval writes use transactions with required audit records; retirement preserves history. Calendar dates use the shared Manila contract. Lists are bounded/paginated and report exports have size and concurrency limits. Prisma uses one process-scoped client with controlled shutdown.

Control ribbons and tables have shared foundations and browser regression checks. Faculty/student request loading and conflict UI are shared; their form rules remain explicit. Admin/faculty/student schedules share tables, charts, calendars, and normalization. Report domain screens, output controls, and data preparation are separated; print rendering remains separate. One Chromium service handles bounded PDF execution and cleanup. Both backend unused-code compiler checks are enabled.

## Current inventory

Counts exclude generated dependencies/build output and were computed from the filesystem on this revision, including uncommitted remediation files.

| Area | Files |
| --- | ---: |
| frontend/src | 97 |
| backend/src | 48 |
| backend Jest test files | 31 |
| selected managed regression suites | 25 |
| Prisma migrations | 5 |

## Verification and limits

Read docs/reproducible-verification.md for exact commands and safety guards. npm run test:regression uses an explicit TEST_DATABASE_URL, a generated schema, seeded disposable fixtures, and its own server. npm run test:ui runs ribbon, table, chart/calendar, and controlled component checks. node scripts/test-ui.cjs --deployment runs fresh/upgrade migration and PDF rehearsals. CI is defined in .github/workflows/verification.yml; hosted execution was not triggered from this task.

Validated locally: clean npm ci and both builds; 474 tests across 25 suites; 39 ribbon cases, 17 consolidation cases, and two controlled-table cases; fresh and upgrade migration rehearsals and actual production PDF generation. Build bundle-size warnings remain.

Lint remediation: full frontend ESLint reports zero errors and warnings. npm run lint:ci now enforces --max-warnings 0 without a debt baseline. See docs/lint-remediation.md. Dependency remediation on 1 October 2026 produced zero known findings in both full and production-only audits. CI now fails on moderate-or-higher findings. See docs/dependency-remediation.md. No deployment or claim of production readiness is implied by a passing regression run.

Historical exploratory test files outside the managed manifest: academicDirectory.test.js, borrowRequests.test.js, conflicts.test.js, labSchedules.test.js, notifications.test.js, realistic-user-journey.test.js. These are not counted as passing. Screenshots and review plans from earlier phases are historical evidence, not a current UI specification.
