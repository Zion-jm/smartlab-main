# SmartLab step 19 — code consolidation

The faculty and student pages now use shared conflict components, request/resource hooks, typed request normalization, and request previews. Their form validation and role-specific defaults remain in their respective pages.

All three roles use the same schedule table, chart, calendar, date helpers, and schedule normalizer. Admin retains its detail callback, abbreviated day labels, and empty chart grid; faculty and student retain read-only chart details.

`ReportDetailViews.tsx` now delegates to request, schedule, and equipment domain views. Report output controls and pure data preparation have separate modules. The existing shared filter controls remain in use. Screen and printable document rendering remain separate.

All four backend PDF exports use `chromiumPdfService.ts`, with a 60-second execution limit, an isolated browser profile, encoded file URLs, and temporary-directory cleanup on success or failure. Existing export size and concurrency limits remain intact.

Backend unused-local and unused-parameter checks are enabled after resolving existing compiler findings.

## Verification

- Backend and frontend production builds pass. Existing bundle-size warnings remain.
- 23 focused tests pass, including PDF cleanup failures, report limits, pagination, and Prisma lifecycle.
- Production smoke test passes, including actual authenticated PDF generation and isolated migration rehearsal.
- 39 ribbon browser checks and 17 consolidation browser checks pass with zero recorded browser errors. Admin, faculty, and student chart detail actions and calendar navigation were exercised.
- Frontend lint: 49 errors and 14 warnings remain, down from 57 errors and 15 warnings before consolidation. This is not a clean lint result.

Backup: `SmartLab-Before-Fix-19.zip`, with separate frontend/backend paths. Build, test, lint, and browser evidence are in this output folder.
