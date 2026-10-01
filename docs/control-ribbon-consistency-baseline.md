> Historical review/proposal. See README.md and reproducible-verification.md for implemented status and current checks.

# Control Ribbon Consistency Fix — Phase 0 Baseline

**Checkpoint:** `CP0 — Before ribbon consistency fix`  
**Captured:** 26 September 2026  
**Branch:** `main`  
**Baseline commit:** `615b5fd` (`Update control ribbon consistency fix plan`)

## Working-tree and runtime state

- The working tree was clean before baseline capture.
- Frontend workflow is running on Vite port 5000.
- Backend workflow is running on port 3001.
- Prisma schema is synchronized and the seed command completed successfully.
- The frontend API uses the relative `/api` base path.
- SMTP is not configured, so email notifications are disabled; this is unrelated to ribbon behavior.
- The baseline captures added by this phase are:
  - `screenshots/phase0-admin-requests-unauthenticated.jpg`
  - `screenshots/phase0-student-panel-unauthenticated.jpg`

## Protected route inventory

The routes below are defined in `frontend/src/main.tsx` and protected by role:

| Route | Required role | Baseline status |
|---|---|---|
| `/admin/schedule` | Admin | Route exists; authenticated visual check blocked |
| `/admin/requests` | Admin | Route exists; unauthenticated capture redirects to `/` |
| `/admin/equipment` | Admin | Route exists; authenticated visual check blocked |
| `/admin/reports` | Admin | Route exists; authenticated visual check blocked |
| `/admin/users` | Admin | Route exists; authenticated visual check blocked |
| `/admin/academic-directory` | Admin | Route exists; authenticated visual check blocked |
| `/admin/audit-logs` | Admin | Route exists; authenticated visual check blocked |
| `/faculty/panel` | Faculty | Route exists; authenticated visual check blocked |
| `/student/panel` | Student | Route exists; unauthenticated capture redirects to `/` |

The two browser captures taken at 1280px show the public landing page after the protected-route redirect. They are evidence of the authentication prerequisite, not ribbon screenshots.

## Shared-component and caller inventory

### Shared components

| Component or selector | Current locations | Baseline finding |
|---|---|---|
| `FilterToolbar` | Admin Lab Schedule, Admin Requests, Admin Equipment, Admin Reports, Admin Audit Logs, Manage Accounts, Faculty Panel, Student Panel | Shared outer toolbar path |
| `ControlRibbon` | `FilterToolbar`, `CompactFilterPanel` when `collapsible`, and custom Admin Academic Directory ribbon | Shared ribbon surface and whole-ribbon disclosure |
| `CompactFilterPanel` | Manage Accounts, Academic Directory, and six report-detail call sites | Owns advanced-filter state and content |
| `ribbonToggle` | Manage Accounts, Academic Directory, and the Requests/Schedule/Equipment report-detail filter panels | Advanced-filter handle enabled |
| `ribbonToggleVariant="bottomControl"` | Every current explicit `ribbonToggle` caller | Uses the shared bottom-control class |
| `ribbonToggleVariant="legacy"` | No explicit caller; remains the `CompactFilterPanel` default | Legacy fallback remains available |
| `.ribbon-bottom-control` | Three direct page handles plus the `CompactFilterPanel` bottom-control variant | Same class is used across different DOM hierarchies |
| `.ribbon-advanced-toggle` | Legacy `CompactFilterPanel` fallback and CSS | No active explicit caller; cleanup belongs to a later phase |

### Current placement hierarchies

**Direct page consumers — intended outer-ribbon placement**

```text
FilterToolbar
└── ControlRibbon
    ├── ribbon content
    └── bottomControl
        └── .ribbon-bottom-control
```

Current direct consumers:

- Admin Lab Schedule
- Admin Requests
- Admin Equipment

**Nested panel consumers — current split placement**

```text
FilterToolbar or custom ControlRibbon
└── ribbon content
    └── CompactFilterPanel
        └── advancedContent
            └── .ribbon-bottom-control
```

Current nested consumers:

- Manage Accounts
- Admin Academic Directory

**Report portal consumers — current portal variation**

```text
AdminReports FilterToolbar
├── primary-filter portal target
├── advanced-filter portal target
└── action portal target
    └── ReportDetailViews CompactFilterPanel
        └── portaled advancedContent
            └── .ribbon-bottom-control
```

The Requests, Schedule, and Equipment report-detail panels enable the advanced handle. Their section-level demand panels use `CompactFilterPanel` without `ribbonToggle`.

## Current spacing and legacy CSS findings

- `.page-control-ribbon` is already `position: relative`, and `.ribbon-bottom-control` is absolutely positioned against its nearest positioned ancestor.
- Date-range bottom padding is currently page-specific on:
  - `.lab-schedule-filter-toolbar .page-control-ribbon__content`
  - `.reports-filter-toolbar .page-control-ribbon__content`
  - `.request-filter-toolbar .page-control-ribbon__content`
- A separate `:has()` selector in `index.css` checks for `.ribbon-advanced-toggle` while adjusting date-range spacing.
- Audit Logs uses `DateRangeFilter` without one of the three page-specific wrapper classes.
- No new advanced-filter handle should be introduced for Audit Logs, Faculty, or Student during this fix.

## Baseline observations and blockers

### Structurally confirmed

- Every protected route in the Phase 0 matrix is present.
- Direct pages pass `bottomControl` through `FilterToolbar` to `ControlRibbon`.
- Manage Accounts and Academic Directory render the advanced handle from `CompactFilterPanel` content.
- Reports portals primary and advanced filter content separately and has no dedicated bottom-control portal target yet.
- The legacy placement variant is not used explicitly, but its default and CSS still exist.
- No application code was changed during Phase 0.

### Runtime verification blocked

An authenticated browser session for Admin, Faculty, and Student roles was not available to the baseline capture. Requests and Student Panel therefore redirected to the public landing page. The following remain **blocked**, not passed:

- Current DOM and pixel measurements for every protected page.
- Desktop, tablet, and mobile ribbon alignment observations.
- Advanced-filter open/close, whole-ribbon collapse/expand, tab switching, sticky behavior, keyboard focus, and print checks.
- Date-range comparison states and active-filter states.
- Confirmation that no runtime-only duplicate handle appears after portal target mounting.

Phase 1 must retain the direct-page behavior and resolve the target lifecycle without relying on assumptions from the unauthenticated captures.