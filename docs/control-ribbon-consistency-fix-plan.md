> Historical review/proposal. See README.md and reproducible-verification.md for implemented status and current checks.

# Control Ribbon Consistency Fix — Phased Implementation Plan

Admin Credential:
admin@smartlab.local
SmartLab123!

## Status

**Phase 0 baseline recorded.** This document records the fix strategy and execution status for the remaining cross-page ribbon inconsistency. Phase 0 is documentation-only; application-code changes begin in Phase 1.

## Objective

Make the finalized control-ribbon treatment structurally consistent across the operational pages that use shared filters, advanced filters, date ranges, and view controls.

The fix must:

- Put every advanced-filter handle in the owning outer ribbon's bottom-control slot.
- Use one positioning context and one clearance rule for the handle.
- Preserve existing filter state, URL state, API calls, tab behavior, refresh behavior, and page actions.
- Remove the current split between direct `FilterToolbar.bottomControl` usage and nested `CompactFilterPanel` placement.
- Verify the result at desktop, tablet, and mobile widths with an authenticated session.

## Findings from the current implementation

### Finding 1 — There are two different placement architectures

The direct pages use the intended hierarchy:

```text
FilterToolbar
└── ControlRibbon
    ├── ribbon content
    └── bottomControl
```

Current direct consumers:

- `AdminLabSchedule`
- `AdminRequests`
- `AdminEquipment`

The remaining nested pages use a visually similar class from inside the filter panel:

```text
FilterToolbar or ControlRibbon
└── CompactFilterPanel
    └── advancedContent
        └── ribbon-bottom-control
```

Current nested consumers:

- `AdminReports`
- `ManageAccounts`
- `AdminAcademicDirectory`

The CSS class is shared, but the DOM placement is not. This means the handle's containing block, available clearance, and overlap behavior can change between pages.

### Finding 2 — Reports adds portal-specific variation

The three detail views in `ReportDetailViews.tsx` portal primary and advanced filter content into targets created by `AdminReports.tsx`. Their advanced-filter handles are currently rendered as part of the portaled advanced content.

This makes Reports different from both:

- direct `FilterToolbar.bottomControl` pages, and
- non-portal nested `CompactFilterPanel` pages.

The Reports implementation needs an explicit bottom-control portal target in addition to its existing primary, advanced, and action targets.

### Finding 3 — Academic Directory adds another nested ribbon boundary

`AdminAcademicDirectory` owns a custom `ControlRibbon` and renders `CompactFilterPanel` inside it. The handle is therefore positioned through nested content rather than through the parent ribbon API.

The page must keep its context-sensitive Add action and entity controls unchanged while moving only the advanced-filter handle to the parent ribbon's bottom-control slot.

### Finding 4 — Date-range clearance is page-specific

The current stylesheet adds bottom padding only for these page classes:

- `.lab-schedule-filter-toolbar`
- `.reports-filter-toolbar`
- `.request-filter-toolbar`

`AdminAuditLogs` also contains a `DateRangeFilter`, but does not use one of those wrappers. Pages without date controls use a different apparent bottom clearance.

This makes the handle position look dependent on whether the page happens to have a date range, even though the handle belongs to the ribbon itself.

### Finding 5 — Legacy behavior remains available

`CompactFilterPanel` still supports the `legacy` ribbon-toggle variant and defaults to it. The `.ribbon-advanced-toggle` CSS remains in `index.css`.

Current callers that render a ribbon toggle explicitly opt into `bottomControl`, but the legacy default remains a future regression path and the CSS contains a stale selector tied to the old class.

### Finding 6 — Not every filter page should receive a More Filters handle

`AdminAuditLogs` has all of its filters in the expanded panel and has no separate advanced-filter disclosure. Faculty and Student schedule explorers use the shared toolbar but have a distinct schedule-explorer layout.

The fix should standardize placement where a handle exists. It should not add a new disclosure control to pages that do not currently need one.

## Target architecture

### Single placement contract

`ControlRibbon` remains the only component responsible for the ribbon surface and its bottom-control placement:

```text
ControlRibbon
├── bar
├── content
└── bottom-control slot
```

`FilterToolbar` continues to forward `bottomControl` directly to `ControlRibbon`.

`CompactFilterPanel` remains responsible for:

- primary filters,
- advanced filter content,
- advanced filter state,
- active-filter summaries and reset behavior.

It must no longer depend on the advanced filter content's nearest positioned ancestor to place a ribbon handle.

### Explicit portal target for nested panels

For pages where `CompactFilterPanel` owns the advanced-filter state, add an explicit target prop for the handle, for example:

```text
advancedTogglePortalTarget?: HTMLDivElement | null
```

When supplied, `CompactFilterPanel` should portal only the advanced-filter handle into that target. The advanced filter fields remain in their existing content location.

The page-level owner supplies the target through the outer ribbon's `bottomControl` slot:

```text
ControlRibbon
└── bottomControl slot
    └── target element
        └── portaled advanced-filter handle
```

This preserves each page's local filter state while giving every handle the same DOM and positioning context.

### Explicit target behavior

- The target is rendered by the outer ribbon, not by the nested filter panel.
- The target must not be absolutely positioned itself; `.ribbon-bottom-control` remains responsible for handle placement.
- The panel must not render a second copy of the handle inside `advancedContent`.
- If the target is temporarily unavailable during the first render, the implementation must avoid duplicate handles and must settle into the target after the next React commit.
- Browser interaction verification must wait for that commit before reading `aria-expanded` or `hidden`.

### Shared clearance rule

Replace page-specific date-range padding with one shared ribbon clearance rule. The rule must reserve the same bottom space for all adopted ribbons, whether or not a date-range control is present.

The final CSS should not use a `:has()` expression to decide bottom clearance based on the legacy `.ribbon-advanced-toggle` class.

The shared rule must account for:

- the handle's transformed visual position,
- collapsed and expanded ribbon states,
- pages with no advanced-filter handle,
- mobile wrapping,
- print mode.

If the visual review shows that pages without a handle do not need the reserved space, use an explicit ribbon modifier based on the presence of the bottom-control slot—not date-range content or DOM inference.

## Scope and affected files

### Shared implementation

- `frontend/src/components/shared/ControlRibbon.tsx`
  - Preserve the existing `bottomControl` API.
  - Add only the minimal structural hook needed to identify the bottom-control target or its clearance modifier.
  - Keep the ribbon as the absolute-positioning context.

- `frontend/src/components/FilterToolbar.tsx`
  - Continue forwarding `bottomControl`.
  - Do not change search, filter disclosure, summary, refresh, or primary-action behavior.

- `frontend/src/components/shared/CompactFilterPanel.tsx`
  - Add the explicit advanced-toggle target contract.
  - Remove the need for the nested panel to position the handle against an arbitrary ancestor.
  - Remove or deprecate the legacy placement variant only after all callers are migrated.
  - Keep advanced filter state and active-filter behavior unchanged.

- `frontend/src/index.css`
  - Consolidate handle placement and clearance styles.
  - Remove page-specific date-range clearance selectors after migration.
  - Remove legacy `.ribbon-advanced-toggle` styles after the caller audit confirms they are unused.
  - Remove the stale selector that checks for `.ribbon-advanced-toggle`.
  - Preserve focus, hover, sticky, print, and mobile behavior.

### Page-level migration

- `frontend/src/pages/AdminReports.tsx`
  - Create and pass a bottom-control portal target through the outer `FilterToolbar`.
  - Pass that target to the active report detail view.
  - Keep report tabs, date-range state, academic-period state, report actions, and active summaries unchanged.

- `frontend/src/components/admin/ReportDetailViews.tsx`
  - Thread the bottom-control target through the shared report-detail props.
  - Update all three `CompactFilterPanel` instances consistently.
  - Preserve each report's existing advanced-filter state and count.

- `frontend/src/pages/ManageAccounts.tsx`
  - Add an outer-ribbon bottom-control target.
  - Pass it to the existing `CompactFilterPanel`.
  - Preserve account search, role/status filters, reset behavior, Add Account, and independent table scrolling.

- `frontend/src/pages/AdminAcademicDirectory.tsx`
  - Add the bottom-control target to the custom `ControlRibbon`.
  - Pass it to the existing `CompactFilterPanel`.
  - Preserve entity tabs, entity-specific filters, Add action, active chips, reset behavior, and summary counts.

- `frontend/src/pages/AdminAuditLogs.tsx`
  - Normalize the shared ribbon clearance for its existing date-range controls.
  - Do not add a More Filters handle unless a separate product decision requires one.

- `frontend/src/pages/AdminLabSchedule.tsx`
- `frontend/src/pages/AdminRequests.tsx`
- `frontend/src/pages/AdminEquipment.tsx`
  - Keep their direct `bottomControl` implementations as reference consumers.
  - Remove only page-specific spacing workarounds once the shared rule is verified.

- `frontend/src/pages/FacultyPanel.tsx`
- `frontend/src/pages/StudentPanel.tsx`
  - Include in the verification matrix because they use the shared toolbar.
  - Do not change their schedule-explorer behavior in this fix unless the shared CSS change causes a real regression.

## Phased implementation

## Phase 0 — Baseline and invariant capture

**Dependency:** None  
**Checkpoint:** `CP0 — Before ribbon consistency fix`

### Tasks

- [x] Reconfirm the current branch and working-tree state.
- [x] Inventory every `FilterToolbar`, `ControlRibbon`, `CompactFilterPanel`, `ribbonToggle`, `ribbonToggleVariant`, `ribbon-bottom-control`, and `ribbon-advanced-toggle` usage.
- Record the current DOM/visual behavior for:
  - Admin Reports overview and each detail tab
  - Admin Equipment table and calendar views
  - Admin Lab Schedule table, chart, and calendar views
  - Admin Requests with and without date filters
  - Manage Accounts with and without active role/status filters
  - Academic Directory for rooms, buildings, and a tab without advanced filters
  - Audit Logs with no date range and with a date range
  - Faculty and Student schedule explorers
- [x] Confirm the protected routes; the authenticated browser prerequisite remains blocked.
- Do not modify application code in this phase.

### Gate

- The page inventory identifies every active and fallback ribbon-toggle path.
- Baseline observations identify which differences are structural, spacing-related, or intentional.
- No implementation begins with an unresolved caller.

### Phase 0 verification notes — 26 September 2026

- **Working tree:** clean before baseline capture on `main` at `615b5fd`.
- **Static inventory:** complete. Direct consumers are Admin Lab Schedule, Admin Requests, and Admin Equipment. Nested consumers are Manage Accounts and Admin Academic Directory. Reports has three portal-based detail filter callers.
- **Routes:** all nine protected routes in the Phase 0 matrix are defined in `frontend/src/main.tsx` with the expected role guards.
- **Runtime:** frontend, backend, database synchronization, and seed completed successfully.
- **Authenticated visual verification:** **BLOCKED**. No authenticated Admin, Faculty, or Student browser session was available; protected route screenshots redirected to the landing page. The captures are retained as authentication-prerequisite evidence, not as ribbon behavior evidence.
- **Baseline record:** [Phase 0 baseline](control-ribbon-consistency-baseline.md).

## Phase 1 — Finalize the shared placement contract

**Dependency:** Phase 0  
**Checkpoint:** `CP1 — Shared bottom-control contract stable`

### Tasks

- [x] Define the bottom-control target API for `CompactFilterPanel`.
- [x] Define the target lifecycle behavior when the portal target is initially `null`.
- [x] Ensure the advanced-toggle button renders in exactly one location for an explicitly supplied target.
- [x] Keep `ControlRibbon` as the positioning context for `.ribbon-bottom-control`.
- [x] Decide the migration compatibility path: an omitted target preserves existing inline placement; an explicit `null` or element uses portal-only placement.
- [x] Keep the whole-ribbon toggle and advanced-filter toggle semantically separate.
- [x] Preserve:
  - `aria-expanded`,
  - `aria-controls`,
  - active-filter count announcements in the accessible label,
  - keyboard focus behavior,
  - existing controlled panel IDs.

### Gate

- [x] Shared components type-check and build.
- [ ] **Blocked:** A focused component test or authenticated browser probe confirms one handle, one target, and correct disclosure state.
- [x] The direct pages remain behaviorally unchanged by the shared API change; their existing callers omit the new target.
- [x] No legacy CSS was removed before all callers were accounted for.

### Phase 1 implementation notes — 26 September 2026

- Added `advancedTogglePortalTarget?: HTMLDivElement | null` to `CompactFilterPanel`.
- When the prop is explicitly supplied, the advanced-filter handle is rendered only through `createPortal`; an initial `null` target renders no inline fallback, preventing duplicate handles before the target ref commits.
- When the prop is omitted, existing callers retain their current inline placement as a temporary migration compatibility path.
- The advanced-filter button keeps its existing `aria-expanded`, `aria-controls`, accessible active-count label, focus behavior, and generated controlled-panel ID.
- `cd frontend && npm run build` passed.
- Focused ESLint for `CompactFilterPanel.tsx` passed.
- `git diff --check` passed.
- The frontend workflow was restarted successfully and Vite is serving on port 5000.
- Authenticated runtime confirmation and the actual `CP1 — Shared bottom-control contract stable` checkpoint remain pending.

## Phase 2 — Migrate nested and portal-based pages

**Dependency:** Phase 1  
**Checkpoint:** `CP2 — All advanced handles use outer ribbon targets`

### Task 2A — Reports

- Add the outer bottom-control target beside the existing action, primary-filter, and advanced-filter targets.
- Thread it through the report detail-view props.
- Update all three report detail filter panels.
- Verify that switching between Overview, Requests, Schedule, and Equipment does not leave a stale handle mounted.
- Verify that the handle's open/closed state remains tied to the active report's existing advanced-filter panel.

### Task 2B — Manage Accounts

- Add the target to the `FilterToolbar` bottom-control slot.
- Pass it to the compact filter panel.
- Verify search and role/status filter state remain unchanged when the ribbon or advanced filters are toggled.

### Task 2C — Academic Directory

- Add the target to the custom `ControlRibbon` bottom-control slot.
- Pass it to the compact filter panel.
- Verify rooms/buildings advanced filters still disclose correctly and tabs without advanced filters do not render an orphan handle.

### Gate

- No migrated page positions the new handle from inside `advancedContent`.
- Every migrated handle has the same outer-ribbon containing block.
- Report portal targets remain valid across tab changes.
- Page actions and summaries remain visible in the same places.

## Phase 3 — Consolidate spacing and retire legacy styling

**Dependency:** Phase 2  
**Checkpoint:** `CP3 — Shared spacing and legacy cleanup complete`

### Tasks

- Introduce the shared bottom-clearance rule.
- Remove `.lab-schedule-filter-toolbar`, `.reports-filter-toolbar`, and `.request-filter-toolbar` as spacing mechanisms.
- Normalize Audit Logs without introducing an unnecessary advanced-filter handle.
- Review whether the shared clearance should apply to all ribbons or only ribbons with an explicit bottom-control slot.
- Remove the stale date-range/legacy-toggle `:has()` rule.
- Remove `.ribbon-advanced-toggle` styles after the usage audit is empty.
- Remove `ribbonToggleVariant="legacy"` and the legacy default if no compatibility caller remains.
- Keep print mode static and ensure the handle does not create unwanted print output or extra whitespace.

### Gate

- Static search finds no active legacy toggle caller.
- Static search finds no page-specific date-range bottom-padding workaround.
- No duplicate advanced-filter handles exist in rendered markup.
- CSS remains understandable without selector coupling to a removed class.

## Phase 4 — Responsive, accessibility, and interaction verification

**Dependency:** Phase 3  
**Checkpoint:** `CP4 — Ribbon consistency review complete`

Use an authenticated browser session and test at:

- 1280px desktop
- 1024px tablet
- 390px mobile

### Shared checks

- The handle is centered on the same ribbon boundary on every applicable page.
- The handle does not move when date filters are added or removed.
- The handle does not jump when advanced filters open or close.
- The whole-ribbon toggle and advanced-filter toggle remain distinct.
- The handle is keyboard reachable with visible focus.
- `aria-expanded` changes only after the React commit.
- `aria-controls` resolves to the correct advanced-filter panel.
- There is no duplicate handle in the advanced content.
- There is no page-level horizontal overflow introduced by the ribbon.
- Sticky behavior remains stable while scrolling.
- Print output remains usable.

### Page matrix

| Page/state | Handle applicable | Date range | Portal/nested path | Required checks |
|---|---:|---:|---:|---|
| Lab Schedule, all views | Yes | Yes | Direct | Handle, advanced filters, view tabs, collapse |
| Requests, default | Yes | Yes | Direct | Handle, status filters, date spacing |
| Requests, active date range | Yes | Yes | Direct | Same position before/after date selection |
| Equipment, table/calendar | Yes | No | Direct | Handle, view tabs, active filters |
| Reports, Overview | No advanced handle | Yes | Outer only | Shared clearance, date controls, collapse |
| Reports, Requests/Schedule/Equipment | Yes | Yes | Portal | Target lifecycle, tab changes, advanced panel |
| Manage Accounts | Yes | No | Nested panel | Target placement, role/status filters |
| Academic Directory, rooms/buildings | Yes | No | Nested custom ribbon | Target placement, tab-specific filters |
| Academic Directory, other entities | No advanced handle | No | Nested custom ribbon | No orphan handle, shared spacing |
| Audit Logs | No | Yes | Direct | Date spacing, collapse, no new disclosure |
| Faculty schedule | No new handle | Date input | Shared toolbar | No regression from shared CSS |
| Student schedule | No new handle | Date input | Shared toolbar | No regression from shared CSS |

### Gate

- Every applicable matrix row is marked pass, fail, or blocked.
- Failures include reproduction steps and the affected viewport.
- Blocked rows identify the missing authentication or runtime prerequisite.
- No visual pass is claimed for an unauthenticated redirect.

## Phase 5 — Final verification and handoff

**Dependency:** Phase 4  
**Checkpoint:** `CP5 — Ribbon consistency fix verified`

### Tasks

- Run:
  - `cd frontend && npm run build`
  - `git diff --check`
- Run focused lint or diagnostics for every changed shared component and page.
- Refresh the frontend workflow once after the final code batch.
- Check workflow and browser logs for runtime errors.
- Review the final diff for:
  - accidental API or state changes,
  - duplicate portal mounts,
  - leftover legacy selectors,
  - unrelated page changes,
  - changes to dashboard, profile, landing, or Academic Period layouts.
- Update this plan's verification notes with exact pass/fail/blocked results.
- If authenticated visual verification remains unavailable, record it as a blocker rather than inferring success from the build.

### Final acceptance criteria

- All advanced-filter handles use the outer ribbon bottom-control placement contract.
- Reports, Manage Accounts, and Academic Directory no longer rely on nested absolute positioning.
- Date-range presence does not change handle alignment.
- Legacy toggle placement is removed or explicitly isolated to a documented compatibility caller.
- Existing filter state, URL synchronization, API calls, tab behavior, refresh behavior, page actions, and table scrolling are unchanged.
- Build, diff, diagnostics, workflow logs, and the applicable responsive matrix are complete.

## Explicit non-goals

- Do not redesign the ribbon's colors, typography, or overall visual language.
- Do not add new filter capabilities.
- Do not change backend APIs, database schema, or authentication.
- Do not refactor duplicated schedule chart implementations.
- Do not redesign report print/export documents.
- Do not move page actions out of their current always-visible ribbon action areas.
- Do not add a More Filters disclosure to Audit Logs, Faculty, or Student pages solely to make the page count uniform.
- Do not change the Academic Period settings layout.

## Rollback and risk controls

- Save a checkpoint before changing shared components.
- Keep Phase 1 limited to the shared target contract before migrating pages.
- Migrate Reports separately because it has the most portal targets and tab transitions.
- If a portal target causes an initial-render flicker or stale handle, stop the page migration and resolve the target lifecycle before continuing.
- If shared spacing creates unwanted whitespace on ribbons without a handle, use an explicit bottom-control modifier rather than restoring date-range detection.
- If an authenticated browser session is unavailable, complete static/build verification but leave responsive interaction results blocked.

## Implementation checklist

Use this checklist while executing the phases above. Do not mark an item complete from static inspection when it requires authenticated browser verification.

### Phase 0 — Baseline

- [x] Confirm the working tree and record unrelated changes.
- [x] Inventory all `FilterToolbar`, `ControlRibbon`, and `CompactFilterPanel` callers.
- [x] Inventory all `ribbonToggle`, `ribbonToggleVariant`, `ribbon-bottom-control`, and `ribbon-advanced-toggle` references.
- [x] Record the current direct, nested, and portal-based ribbon hierarchies.
- [x] Confirm the correct protected routes:
  - [x] `/admin/schedule`
  - [x] `/admin/requests`
  - [x] `/admin/equipment`
  - [x] `/admin/reports`
  - [x] `/admin/users`
  - [x] `/admin/academic-directory`
  - [x] `/admin/audit-logs`
  - [x] `/faculty/panel`
  - [x] `/student/panel`
- [ ] **Blocked:** Confirm an authenticated admin, faculty, and student browser session is available for runtime checks.
- [ ] **Blocked:** Record authenticated baseline screenshots or measurements for the affected desktop and mobile states. Unauthenticated redirect captures are retained in the baseline record.
- [ ] **Not yet saved:** Save the actual `CP0 — Before ribbon consistency fix` checkpoint.

**Phase 0 noteworthy findings — 26 September 2026**

- The working tree was clean before baseline capture on `main` at `615b5fd`; only the baseline documentation and redirect captures were added afterward.
- Direct bottom-control consumers are Admin Lab Schedule, Admin Requests, and Admin Equipment.
- Manage Accounts and Admin Academic Directory place their advanced-filter handle through nested `CompactFilterPanel` content.
- Reports has three portal-based detail filter callers and does not yet have a dedicated bottom-control portal target.
- `ribbonToggleVariant="legacy"` has no explicit active caller, but remains the `CompactFilterPanel` default and its CSS remains active.
- Date-range clearance is currently page-specific for Lab Schedule, Reports, and Requests; Audit Logs uses `DateRangeFilter` without those wrapper classes.
- All protected route screenshots redirected to the public landing page because no authenticated browser session was available. No protected-page visual or interaction result is being marked as passed.
- Full evidence is recorded in [control-ribbon-consistency-baseline.md](control-ribbon-consistency-baseline.md).

### Phase 1 — Shared bottom-control contract

- [x] Define the explicit `CompactFilterPanel` bottom-control target API.
- [x] Define behavior when the target is `null` during the first render.
- [x] Ensure the advanced-filter handle can render in only one location when an explicit target is supplied.
- [x] Keep `ControlRibbon` as the handle's positioning context.
- [x] Preserve the advanced panel's existing ID and disclosure state.
- [x] Preserve `aria-expanded`, `aria-controls`, accessible labels, and keyboard focus behavior.
- [x] Keep the whole-ribbon toggle separate from the advanced-filter toggle.
- [x] Confirm the direct Lab Schedule, Requests, and Equipment pages still use the direct bottom-control path.
- [x] Run the frontend build.
- [x] Run focused diagnostics or lint for changed shared components.
- [x] Run `git diff --check`.
- [ ] **Not yet saved:** Save `CP1 — Shared bottom-control contract stable`.

**Phase 1 noteworthy findings — 26 September 2026**

- `CompactFilterPanel` now distinguishes an omitted target from an explicit `null` target. Omitted preserves the existing inline placement for migration; explicit `null` or an element uses portal-only placement.
- The explicit-target path never renders an inline fallback, so the initial null-ref render cannot create duplicate advanced-filter handles.
- No current page passes the new target yet; this is intentional and leaves direct and nested callers behaviorally unchanged until Phase 2 migration.
- The legacy variant and CSS remain in place because the caller migration is not complete.
- Build, focused ESLint, and `git diff --check` pass. Authenticated runtime probing of one-handle/disclosure behavior remains blocked by the unavailable browser session.

### Phase 2 — Nested and portal-based migration

#### Reports

- [x] Add an outer-ribbon bottom-control target in `AdminReports.tsx`.
- [x] Thread the target through the report detail-view props.
- [x] Migrate the Requests report filter panel.
- [x] Migrate the Schedule report filter panel.
- [x] Migrate the Equipment report filter panel.
- [ ] **Blocked:** Confirm Overview does not render an orphan advanced-filter handle in an authenticated browser session.
- [ ] **Blocked:** Confirm switching report tabs does not leave a stale handle or stale portal target in an authenticated browser session.

#### Manage Accounts

- [x] Add the bottom-control target to the outer `FilterToolbar`.
- [x] Pass the target to `CompactFilterPanel`.
- [ ] **Blocked:** Confirm search, role filters, status filters, reset, and collapsed summary remain unchanged in an authenticated browser session.
- [ ] **Blocked:** Confirm Add Account remains visible while the ribbon body is collapsed in an authenticated browser session.
- [ ] **Blocked:** Confirm independent account-table scrolling remains unchanged in an authenticated browser session.

#### Academic Directory

- [x] Add the bottom-control target to the custom `ControlRibbon`.
- [x] Pass the target to `CompactFilterPanel`.
- [x] Route Rooms advanced filters through the explicit target.
- [x] Route Buildings advanced filters through the explicit target.
- [ ] **Blocked:** Confirm entity tabs without advanced filters do not render an orphan handle in an authenticated browser session.
- [ ] **Blocked:** Confirm Add action, active chips, reset behavior, and summary counts remain unchanged in an authenticated browser session.

#### Phase 2 gate

- [ ] **Blocked:** Confirm each migrated page has one rendered advanced-filter handle at most in an authenticated browser session.
- [x] No migrated page places the new handle inline inside `advancedContent`; each migrated handle uses the explicit target API.
- [x] All migrated handles use the outer ribbon bottom-control target by static call-site inspection.
- [ ] **Blocked:** Confirm page actions and collapsed summaries remain visible in an authenticated browser session.
- [x] Run the frontend build.
- [x] Run `git diff --check`.
- [ ] **Not yet saved:** Save `CP2 — All advanced handles use outer ribbon targets`.

**Phase 2 noteworthy findings — 26 September 2026**

- Reports now owns a fourth portal target beside the existing primary-filter, advanced-filter, and action targets. The same target is threaded into the Requests, Schedule, and Equipment report detail panels.
- Manage Accounts and Academic Directory each render their target in the outer ribbon’s `bottomControl` slot and pass it explicitly to `CompactFilterPanel`.
- The report target remains mounted at the outer ribbon while report tabs change, so the active detail view can replace the single portaled handle without creating page-specific targets.
- Tabs without advanced filters receive the target but render no handle because `CompactFilterPanel` still gates the control on `advanced`.
- Build passed and `git diff --check` passed. Authenticated interaction checks remain blocked because protected routes redirect to the landing page without a browser session.

### Phase 3 — Shared spacing and legacy cleanup

- [x] Define one shared ribbon bottom-clearance rule.
- [x] Verify the rule is independent of date-range presence.
- [x] Remove page-specific date-range padding selectors.
- [x] Normalize Audit Logs date-range spacing.
- [x] Verify ribbons without advanced handles do not receive unacceptable extra whitespace through static modifier inspection.
- [x] Remove the stale `:has()` selector tied to `.ribbon-advanced-toggle`.
- [x] Confirm no active caller still uses the legacy toggle class.
- [x] Remove `ribbonToggleVariant` and the legacy placement path after the caller audit was empty.
- [x] Confirm print mode remains static and usable through static stylesheet inspection.
- [x] Confirm hover and focus styling remains visible through static stylesheet inspection.
- [x] Run the frontend build.
- [x] Run focused diagnostics or lint for changed CSS and components.
- [x] Run `git diff --check`.
- [ ] Save `CP3 — Shared spacing and legacy cleanup complete`.

### Phase 3 implementation notes — 26 September 2026

- Added the `page-control-ribbon--has-bottom-control` modifier in `ControlRibbon`; only ribbons that own a bottom-control slot reserve the shared `1.5rem` content clearance.
- Removed the Lab Schedule, Reports, and Requests date-range wrapper spacing selectors. Audit Logs, Faculty, Student, and report Overview now use the normal ribbon content spacing when no handle is present.
- Removed the legacy `.ribbon-advanced-toggle` styles, the date-range/legacy-toggle `:has()` workaround, and the `ribbonToggleVariant` prop. Advanced handles now use the explicit outer-ribbon portal target path only.
- Directory tabs without advanced filters and the Reports Overview tab no longer mount an empty bottom-control slot, avoiding handle clearance when no handle can render.
- Static audit found no active source caller for the legacy toggle class or variant. Authenticated responsive and interaction verification remains reserved for Phase 4 because no authenticated browser session is available.

### Phase 4 — Responsive and interaction review

Record **Pass**, **Fail**, or **Blocked** for every applicable check at 1280px, 1024px, and 390px.

- [ ] Lab Schedule:
  - [ ] Table view
  - [ ] Chart view
  - [ ] Calendar view
  - [ ] Advanced-filter open/close
  - [ ] Whole-ribbon collapse/expand
- [ ] Requests:
  - [ ] Default state
  - [ ] Active date range
  - [ ] Status filtering
  - [ ] Advanced-filter open/close
  - [ ] Reset and active chips
  - [ ] Whole-ribbon collapse/expand
- [ ] Equipment:
  - [ ] Table view
  - [ ] Calendar view
  - [ ] Advanced-filter open/close
  - [ ] Whole-ribbon collapse/expand
- [ ] Reports:
  - [ ] Overview
  - [ ] Requests detail tab
  - [ ] Schedule detail tab
  - [ ] Equipment detail tab
  - [ ] Date-range changes
  - [ ] Advanced-filter open/close
  - [ ] Tab switching without stale handles
- [ ] Manage Accounts:
  - [ ] Search
  - [ ] Role/status filters
  - [ ] Reset
  - [ ] Advanced-filter open/close
  - [ ] Independent table scrolling
- [ ] Academic Directory:
  - [ ] Rooms
  - [ ] Buildings
  - [ ] Programs/subjects/departments or other no-advanced-filter entities
  - [ ] Entity tab switching
  - [ ] Advanced-filter open/close where applicable
- [ ] Audit Logs:
  - [ ] Search
  - [ ] Action/entity filters
  - [ ] Date range
  - [ ] Whole-ribbon collapse/expand
  - [ ] Refresh
  - [ ] Confirm no new More Filters handle is required
- [ ] Faculty schedule:
  - [ ] Search and date filter
  - [ ] Table/chart/calendar view switching
  - [ ] No regression from shared ribbon CSS
- [ ] Student schedule:
  - [ ] Search and date filter
  - [ ] Table/chart/calendar view switching
  - [ ] No regression from shared ribbon CSS
- [ ] Confirm the handle remains aligned when dates or advanced filters change.
- [ ] Confirm the handle remains keyboard reachable with visible focus.
- [ ] Confirm `aria-expanded` and `hidden` values after waiting for the React commit.
- [ ] Confirm `aria-controls` points to the correct advanced-filter panel.
- [ ] Confirm there is no page-level horizontal overflow.
- [ ] Confirm sticky behavior while scrolling.
- [ ] Confirm print output does not include broken handle positioning.
- [ ] Record all failures with viewport, route, state, and reproduction steps.
- [ ] Record all blockers with the missing prerequisite.
- [ ] Save `CP4 — Ribbon consistency review complete`.

### Phase 5 — Final verification

- [ ] Run `cd frontend && npm run build`.
- [ ] Run `git diff --check`.
- [ ] Run focused diagnostics or lint for every changed shared component and page.
- [ ] Restart the frontend workflow once after the final code batch.
- [ ] Review workflow logs.
- [ ] Review browser console logs.
- [ ] Review the final diff for unrelated changes.
- [ ] Confirm no API, database, authentication, or filter-state changes were introduced.
- [ ] Confirm no legacy placement selectors remain without a documented compatibility reason.
- [ ] Update the plan with final Pass/Fail/Blocked results.
- [ ] Save `CP5 — Ribbon consistency fix verified`.