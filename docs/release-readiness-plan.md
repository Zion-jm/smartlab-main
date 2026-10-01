# SmartLab release-readiness plan

Started: 1 October 2026. Status: local remediation in progress; no staging or production release approved or performed.

Check an item only after recording its evidence. A clean local run does not substitute for hosted CI, staging verification, or a tested recovery procedure.

## 1. Resolve dependency vulnerabilities — first priority

- [x] Record the step 20 baseline: 15 total findings (10 high, 5 moderate), including 10 production findings (6 high, 4 moderate).
- [x] Refresh full and production-only audits; record affected versions and available fixes.
- [x] Back up manifests and the root lockfile before upgrades.
- [x] Apply compatible patched releases; review required major upgrades individually.
- [x] Verify a clean install, both builds, lint regression gate, all 474 regression tests, and browser checks.
- [x] Rehearse migrations and actual PDF generation after upgrades.
- [x] Record final audits. Resolve remaining findings or document a specific risk decision; do not label unresolved findings “clean.”
- [x] Make dependency audit enforcement in CI match the verified result.

Acceptance: no known unresolved high/critical findings in the release dependency tree; any lower-severity exception has an owner, rationale, review date, and approval.

## 2. Resolve lint debt

- [x] Capture full ESLint output and group the 49 errors/14 warnings by cause.
- [x] Replace unsafe types and unused code without changing API contracts.
- [x] Refactor effect/state handling and dependencies while preserving loading, retry, filter, and pagination behavior.
- [x] Verify role-specific forms, schedule views, reports, and equipment actions after each affected group.
- [x] Run full lint with zero errors and warnings; remove the temporary debt baseline and switch CI to strict lint.
- [x] Re-run builds and relevant regression/browser checks.

Acceptance: strict lint passes without blanket rule suppression or unreviewed baseline increases.

## 3. Run hosted CI

- [ ] Review the final diff and ensure no credentials or generated dependencies are included.
- [ ] Identify the GitHub repository and target branch; prepare the change for review.
- [ ] Publish the change when authorized and run the verification workflow.
- [ ] Resolve Linux/clean-runner differences and verify build, lint, audit, tests, migrations, and browser checks are green.
- [ ] Save the workflow URL and artifact links in this plan.
- [ ] Configure required checks/branch protection with repository-owner authorization.

Acceptance: hosted checks pass on the exact commit intended for staging. A locally parsed workflow file is not a hosted CI pass.

## 4. Prepare and verify staging

- [ ] Choose the host, staging domain, database, deployment method, and operator.
- [ ] Provision staging separately from production; configure TLS, secrets, exact CORS origins, trusted proxy addresses, and Chromium.
- [ ] Configure email with a test mailbox or mail sink; avoid sending test messages to real users.
- [ ] Apply reviewed migrations and initialize the administrator explicitly; never auto-seed on startup.
- [ ] Deploy the CI-verified commit after the environment and deployment are authorized.
- [ ] Verify admin/faculty/student login, registration restrictions, account deactivation, and session invalidation.
- [ ] Verify request submission, conflicts, approvals, checkout, return, cancellation, equipment archive/restore, and audit history.
- [ ] Verify Manila dates, weekly schedules, filters/pagination, reports/PDFs, and narrow-screen layouts.
- [ ] Check logs, readiness, restart/shutdown, error handling, and expected email behavior.
- [ ] Record the staging URL, commit, results, and remaining defects.

Acceptance: realistic staging journeys pass with no unresolved release-blocking defects.

## 5. Release and recovery

- [ ] Assign an owner and target date for every remaining risk.
- [ ] Configure backups and demonstrate a restore into an isolated database.
- [ ] Document and rehearse rollback for application code and database changes, including irreversible migration limits.
- [ ] Confirm monitoring, health alerts, retention, operational contacts, and incident procedures.
- [ ] Complete the remediation checklist's release-acceptance section from evidence.
- [ ] Obtain explicit approval for the final production target, commit, migration plan, and release window.
- [ ] Deploy, run post-release smoke checks, and record the release and rollback decision.

Acceptance: production approval is based on the concrete staging result, verified recovery procedure, and recorded residual risks.

## Current evidence and outstanding decisions

- Step 20: clean install/build, 474 tests, 58 browser/component checks, migration/PDF rehearsals passed locally.
- Hosted CI and real deployment have not run.
- GitHub publication target, staging/production host, domains, operational owners, and release date are not yet specified.
- Never place passwords, signing keys, or database credentials in this document.

## Progress log

- 1 October 2026: plan created; dependency remediation started. Subsequent outcomes and evidence will be recorded here.

- 1 October 2026: section 1 completed locally. Nodemailer upgraded to 10.0.13 and compatible dependency patches applied. Full and production audits: zero known vulnerabilities. Clean install/generation, both clean and working-project builds, lint baseline, 474 tests, 58 browser/component checks, fresh/upgrade migrations, and actual PDF export passed. CI audit is now enforced. Working-project Prisma regeneration hit Windows EPERM; fresh generation passed and Prisma version/schema were unchanged. See SmartLab-Dependency-Remediation-Report.md. Next: section 2, lint cleanup.

- 1 October 2026: section 2 verified in the isolated workspace copy: full strict lint 0 errors/0 warnings, both builds, 474 regression tests, 58 existing browser/component checks, and five focused behavior checks passed. Debt baseline removed; CI lint:ci now invokes strict ESLint. The reviewed changes were applied to the working project after verifying all original file hashes. See lint-remediation.md. Next: section 3, hosted CI.
