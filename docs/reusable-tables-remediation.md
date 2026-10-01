# Step 17 — reusable interactive tables

Completed 2026-10-01 in E:\BSIT 3 - DBA\smartlab-v2. Builds and targeted verification pass. No production deployment.

## Implementation

- Added controlled DataTable and TablePanel in frontend/src/components/shared/DataTable.tsx. Callers supply rows, stable keys, typed columns, loading/error/retry state and pagination callbacks. Fetching, filtering and mutations remain in the pages.
- Shared density, alignment, action-cell spacing, empty/loading/error states, caption and keyboard-focusable horizontal viewport. Actions and pagination targets have a 40px minimum.
- PortalLayout explicitly provides the vertical scroll root through TableScrollContext. ControlRibbon observes its height to reserve header space, including its bottom handle. Standalone tables fall back to window scrolling.
- The semantic table remains inside its horizontal viewport. A visual-only, aria-hidden and inert copy of the heading sits outside that overflow wrapper, with measured column widths and synchronized horizontal position. This prevents horizontal scrolling from defeating page-level sticky headers. ResizeObserver and scroll listeners attach/detach with current rows and state, including zero-to-populated transitions.
- Pagination uses context instead of previous-sibling, parent-table and scroll-parent DOM searches. In a DataTable it pins while the table is active. Legacy TablePagination consumers retain CSS sticky-bottom pagination; their old table primitives remain available for incremental adoption.
- Audit Logs, faculty/student personal requests and all three schedule tables use the foundation. Audit and personal-request pagination remain server-driven. ScheduleDataTable owns one shared column configuration, with optional source and action renderers supplied by the admin page. Faculty/student schedules retain read-only behavior.
- Out-of-range controlled pages are clamped after loading finishes. Pages still own filter resets and page-size changes. No scrolling to the top is forced by page changes.
- Printable report documents and export data/rendering remain separate. Existing legacy screen tables elsewhere were not wholesale rewritten in this step; their future adoption can reuse this foundation.

## Verification

- Full root build passed: backend TypeScript and frontend TypeScript/Vite. Existing large-bundle warning remains.
- New/shared table components lint cleanly. PortalLayout and ControlRibbon lint cleanly. Compared modified pages with the prechange snapshot: exactly the same 20 pre-existing lint errors and eight warnings remain across Audit Logs, admin Schedule, Faculty and Student; no new lint diagnostics. See SmartLab-Fix-17-Lint-Comparison.json.
- Live Chromium against a freshly migrated isolated database: 14 checks passed, no browser console or runtime errors. Audit Logs, admin Schedule and faculty/student personal requests passed at 1280/1024/390px; both user schedule views also mounted successfully. Checks cover server page navigation, narrow horizontal scrolling, sticky header/pagination, semantic caption, keyboard audit-details action and audit filtering from populated to empty and back.
- Controlled browser fixture passed in both explicit-root and window-scroll modes. Covers loading, error/retry, empty-to-populated, last-page selection, total shrink/clamping, row keyboard action, sticky header/pagination and horizontally synchronized column widths.
- Five existing frontend pagination unit tests passed, including exact page requests, bounded aggregation and rejection of partial/drifting results.
- Desktop/mobile screenshots visually inspected. The production header and pagination stay visible while the table body scrolls. Expanded mobile ribbons consume substantial height; users can collapse them without resetting filters.
- Step 16's full 39-case ribbon suite passed again after the final table integration, with zero findings and zero browser/API errors.

These are targeted local Chromium checks, not a claim of zero possible defects or cross-browser/screen-reader certification. Existing lint debt is recorded rather than suppressed. Backend domain logic was not changed in this step; the previous 461-test backend/regression result is historical, not a new full-suite run.

## Evidence and reproduction

Evidence beside this guide: SmartLab-Fix-17-Browser-Matrix.json, SmartLab-Fix-17-Browser.log, SmartLab-Fix-17-Component-Tests.json, SmartLab-Fix-17-Component-Tests.log, SmartLab-Fix-17-Pagination-Tests.log, SmartLab-Fix-17-Build.log, SmartLab-Fix-17-Shared-Lint.log, SmartLab-Fix-17-Lint-Comparison.json and page-width PNGs. Recovery snapshot: SmartLab-Before-Fix-17.zip. Step 16 has its own guide and snapshot.

Run backend/scripts/verify-tables.cjs with SMARTLAB_EVIDENCE_DIR and PLAYWRIGHT_MODULE configured, local smartlab_test and Chrome installed. The script builds synthetic data only in a uniquely generated schema and drops it on completion. It expects current frontend/backend builds. For the component checks, start the frontend Vite development server at 127.0.0.1:5174 and run backend/scripts/verify-table-component.cjs. The fixture is frontend/tests/table-harness.html and is excluded from the production build entry points. No dependency or lockfile changes were required; the local bundled Playwright runtime was used.

Next checklist item: step 18, confirmed-unreferenced component cleanup.
