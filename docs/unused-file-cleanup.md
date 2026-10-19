# Step 18 — confirmed-unused file cleanup

Completed 2026-10-01 in E:\BSIT 3 - DBA\smartlab-v2.

Removed five files after checking incoming imports, re-exports, dynamic imports, glob loaders, package entry points, startup/deployment scripts and repository references:

- frontend/src/components/accounts/AddAccountModal.tsx — account creation uses AccountDrawer.
- frontend/src/components/admin/ComputerLabReport.tsx — current reports use ReportDetailViews.
- frontend/src/components/equipment/AvailabilityProgressBar.tsx — no external consumers of either default AvailabilityProgressBar or the named AvailabilityProgressBars wrapper.
- frontend/src/components/shared/DatePickerWithRestrictions.tsx — no incoming consumers; active date pickers remain in place.
- main.py — greeting-only placeholder, not invoked by npm or the previous hosted development environment workflows.

Backup: SmartLab-Before-Fix-18.zip, with original paths and SHA-256 checksums in SmartLab-Fix-18-Backup-Manifest.json. This includes the original versions of all five files, including earlier remediation edits, and the two updated documentation files. No environment files or dependencies are included.

Python tooling follow-up (2026-10-04): removed pyproject.toml and uv.lock after confirming there are no active Python application scripts or startup dependencies. PDF exports use Chromium through Playwright. The earlier decision to retain these files is superseded.

Updated PROJECT_HANDOFF.md to remove the deleted Python entry and annotated the historical table plan's ComputerLabReport inventory. Other historical descriptions remain clearly historical.

Validation:

- Root build: backend TypeScript and frontend TypeScript/Vite passed. Existing frontend bundle warning remains.
- TypeScript-based relative import resolution: no unresolved frontend source imports.
- No remaining candidate references in application source, tests, runtime scripts, package manifests or the previous hosted development environment startup configuration. Historical documentation mentions are intentional.
- Full frontend/src ESLint ran on the remaining 83 files: 57 errors and 15 warnings, all unchanged in the diagnostic comparison. This is existing project lint debt, not a clean lint result. No rule was disabled and no retained application source was modified.
- No new behavior tests were added for unreachable-file deletion; the build and import audit validate the affected scope. Earlier browser and domain test results were not represented as fresh runs.

Evidence: SmartLab-Fix-18-Build.log, SmartLab-Fix-18-Import-Audit.json, SmartLab-Fix-18-Lint-Comparison.json and the backup manifest/archive. No dependency changes, database changes, commit, push or production deployment.

Next: step 19, duplicated UI and domain-code consolidation.

Follow-up cleanup (2026-10-04): removed five standalone backend browser verification scripts (dashboard width, mobile scroll, report width, responsive workspace, and ribbon rollback) and the conflict, detail, and request manual preview HTML/TSX pairs. A reference scan found only the preview files referencing their own entry points. Retained frontend/tests/table-harness.* and backend/scripts verification/regression tools used by the automated checks. The email-preview artifacts were already absent.

## Handover cleanup — 2026-10-19

Removed six tracked files after checking source, scripts, package commands, workflows and references:

- `frontend/src/components/equipment/ConflictWarningList.tsx`: neither exported component has a caller; active conflict UI remains.
- `backend/scripts/checkUser.ts`: unreferenced debug helper that printed a complete user record.
- `backend/scripts/apply-local-equipment-lifecycle.cjs` and `apply-local-session-version.cjs`: superseded by Prisma migrations.
- `backend/prisma/equipment-lifecycle.sql` and `session-version.sql`: identical copies of migrations 0004 and 0003 respectively. The migrations are retained unchanged.

Updated the lifecycle and session guides to use the supported migration workflow. Historical implementation inventories remain as historical records. Tests, test harnesses, baseline adoption schema, seeds and operational diagnostics are retained. Existing untracked local maintenance tools and documents were not deleted or added. No database cleanup, Git history rewrite or deployment was performed.

Validation: backend and frontend production builds passed; strict lint passed with zero errors and warnings; git diff --check passed. Vite still reports its existing large-bundle warning. Database and browser suites were not rerun for these unused-file deletions.
