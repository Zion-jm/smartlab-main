# SmartLab lint remediation

Date: 1 October 2026.

## Baseline and changes

The captured source baseline contained 49 errors and 14 warnings: 35 state-in-effect findings, 14 dependency warnings, eight explicit-any findings, five unsafe finally returns, and one render/ref finding.

- Replaced explicit any types with equipment availability, user role, schedule metadata, and narrowed Axios error types.
- Reset form, filter, and pagination state when its defining inputs change, before rendering children. User refreshes explicitly reset loading/error state; automatic loads publish results through promise callbacks.
- Preserved latest-request guards and removed returns from finally blocks. Extracted the request row to keep event callbacks out of render-time helper invocation.
- Added missing request exclusion dependencies; equipment conflict checks sort a copy and ignore results after effect cleanup. Request drawer availability checks also ignore obsolete responses.
- Kept output menu measurements in a layout effect so positioning occurs before paint.
- Replaced the temporary lint ratchet and baseline with full frontend strict lint, including the test harness. No ESLint rule was disabled or weakened. The existing CI lint:ci step now invokes the strict runner.

## Verification

- Full frontend strict lint: zero errors, zero warnings (SmartLab-Lint-Strict.log and lint-validation/lint-results.json).
- Backend and frontend builds passed (SmartLab-Lint-Build.log); existing bundle-size warnings remain.
- 474 regression tests across 25 suites passed in an isolated local database schema (SmartLab-Lint-Regression.log).
- All 58 existing browser/component cases passed (SmartLab-Lint-UI.log and lint-validation browser matrices).
- Five focused behavior checks passed with zero browser runtime errors: search pagination reset, drawer reset, create/edit values, archive/restore refresh, and invalid-date retry. Results are recorded separately in SmartLab-Lint-Behavior.log and lint-validation/SmartLab-Lint-Behavior.json.

No hosted CI or deployment occurred. Section 3 (hosted CI) remains next. Migration/PDF rehearsals from section 1 remain historical evidence; this frontend/CI change does not modify migrations or backend domain code.

Final application verification: all 32 changed/deleted files matched the reviewed package. Strict lint passed in the working project across 100 frontend files, and the working-project backend/frontend build passed. See SmartLab-Lint-Project-Strict.log and SmartLab-Lint-Project-Build.log.
