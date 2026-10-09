> Historical review/proposal. See README.md and reproducible-verification.md for implemented status and current checks.

# SmartLab Collapsible Control Ribbon Implementation Plan

## Goal

Create a consistent, collapsible control ribbon below the page header on operational pages so filters, search, view switches, and related controls are available without making the page feel crowded.

The design should be inspired by the Microsoft Word ribbon: grouped controls, clear section boundaries, compact command presentation, and an obvious expand/collapse affordance. It should not attempt to reproduce Word's full multi-level feature set.

## Follow-up — shared sticky ribbon shell

The original rollout kept the ribbon in normal document flow. The current follow-up changes that behavior for every page-level shared ribbon:

- Keep the outer ribbon container, its action area, toggle, summary, and expanded control body together while it is pinned.
- Pin it at the top of the scrolling portal content area, immediately below the persistent `PortalLayout` page header.
- Do not make secondary filter panels nested inside another ribbon sticky; avoid stacked sticky controls.
- Preserve existing ribbon contents, control dimensions, filter state, API calls, and responsive wrapping in this pass.
- Defer reducing ribbon height, padding, or control sizes to a separate space-optimization pass.

The shared page-level ribbons covered by this follow-up are Admin Reports, Equipment, Lab Schedule, Requests, Academic Directory, Audit Logs, Manage Accounts, and the Faculty and Student schedule explorers. Dashboard, profile, and landing layouts remain out of scope.

## Required page structure

Every adopted operational page should follow this hierarchy:

```text
PortalLayout main header
  Breadcrumb/title
  Description
Collapsible control ribbon
  Ribbon toggle, collapsed-state summary, and always-visible page-action area
  Grouped search, filter, period, view, and page-related controls
Optional in-content tabs
Status/error message
Main content
```

The PortalLayout header and control ribbon are separate visual and semantic regions. Page identity stays in the PortalLayout header. Page-level action buttons may use the ribbon's always-visible action area; do not put primary actions in the collapsible control body.

### Portal header title and description ownership

For pages rendered inside `PortalLayout`, its sticky main header is the single source of truth for the current page title and description. Do not repeat those strings in a second page-content heading. On pages that already have a control ribbon, put page-level actions in the ribbon's always-visible action slot so they remain available when controls are collapsed. Retain contextual headings such as the selected entity inside Academic Directory. Do not add an action-only ribbon to pages that intentionally have no ribbon, such as Academic Period.

### Ribbon states and behavior

- The ribbon is expanded by default unless a page has a documented reason to start collapsed.
- A single, clearly labeled toggle expands or collapses the whole ribbon.
- The toggle exposes matching `aria-expanded` and `aria-controls` values and remains usable by keyboard and touch.
- When collapsed, the ribbon keeps the toggle visible and shows a compact summary of relevant state, such as active filter count, selected period, selected view, or a non-empty search indicator.
- Actions rendered in the ribbon's header action slot remain visible while the control body is collapsed.
- Collapsing the ribbon hides controls only; it does not clear search, filters, selected tabs, or other page state.
- Expanding the ribbon restores the same control values and focused page behavior.
- Advanced filters may have their own disclosure inside the expanded ribbon, but that disclosure must not be confused with the whole-ribbon toggle.
- Controls are arranged in labeled groups, such as Search, Filters, Academic period, View, and Actions. Groups may wrap on smaller screens rather than forcing one horizontal row.

### Visual direction

Use a restrained Word-inspired treatment rather than a large card:

- A distinct ribbon surface below the header
- Subtle group separators or labels
- Consistent compact control heights and visible focus states
- Clear active and selected states
- A compact chevron/toggle affordance
- No unnecessary nested cards or heavy shadows
- Existing SmartLab colors and page-specific actions remain intact

## Repository snapshot

This status reflects a code review on September 25, 2026. Recheck the affected pages before implementation; this inventory is a starting point, not a substitute for reviewing the current branch.

The shared foundation exists in:

- `frontend/src/index.css`
- `frontend/src/components/FilterToolbar.tsx`
- `frontend/src/components/shared/CompactFilterPanel.tsx`
- `frontend/src/components/shared/PageTabGroup.tsx`
- `frontend/src/components/shared/AcademicPeriodFilter.tsx`

The foundation is not yet a complete accessibility, sizing, or whole-ribbon state standard. For example, compact inputs are currently styled at 36px while other controls are 40px; disclosure controls do not all expose `aria-controls`; the current `FilterToolbar` can render the page title and description inside the ribbon; and `PageTabGroup` has keyboard tab behavior but relies on each page to provide a valid tab panel.

| Page | Current implementation | Remaining plan scope |
|---|---|---|
| `AdminReports` | Uses `CompactFilterPanel`, compact `AcademicPeriodFilter`, and `PageTabGroup`. | Separate the page header from the ribbon; verify date-range controls, collapsed summary, visible active-range summary, and tab/panel labeling. |
| `AdminEquipment` | Uses `PageTabGroup`, compact `AcademicPeriodFilter`, and `CompactFilterPanel`. | Review the stacked bordered wrappers and keep header actions and summary counts visually distinct from filters. |
| `AdminLabSchedule` | Uses `FilterToolbar`, `PageTabGroup`, and compact academic-period/filter controls. | Separate the page header from the ribbon, check for duplicate or nested control groups, and preserve the existing schedule behavior. |
| `AdminRequests` | Uses `CompactFilterPanel` and compact `AcademicPeriodFilter`; status counts remain custom button/tile controls. | Make status counts compact, clearly selected filters; review the surrounding bordered groups and collapsed summary. |
| `AdminAcademicDirectory` | Uses `CompactFilterPanel`; entity tabs and summary counts are custom controls. | Give entity switching shared, accessible tab behavior or document a deliberate non-tab pattern; keep counts secondary. |
| `AdminAuditLogs` | Applies the ribbon CSS to a custom section; search and filters are page-local controls. | Align the control treatment with the shared pattern without adding a duplicate wrapper; keep refresh as a page action and add the whole-ribbon state. |
| `AdminAcademicPeriod` | Applies ribbon styling to its title/refresh area; settings remain separate. | Keep settings outside the ribbon and clarify that refresh is a page-level action. |
| `ManageAccounts` | Already uses `FilterToolbar` and `CompactFilterPanel`; the table scrolls independently. | Review for visual consistency and regressions; do not repeat adoption work without a specific gap. |
| `FacultyPanel` | Uses `FilterToolbar` for the schedule explorer; schedule-view selectors are custom buttons. | Keep the portal header separate, align the schedule controls with the shared ribbon behavior, and keep portal navigation and request/detail flows unchanged. |
| `StudentPanel` | Uses `FilterToolbar` for the schedule explorer; schedule-view selectors are custom buttons. | Keep the portal header separate, align the schedule controls with the shared ribbon behavior, and keep portal navigation and request/detail flows unchanged. |

Pagination is intentionally separate from this work. Changing pages should preserve the user's current scroll position. The faculty, student, and admin schedule views contain duplicated schedule UI; extracting or redesigning that shared UI is outside this plan.

---

## Phased delivery and checkpoint gates

Use each checkpoint as a recovery boundary. Save it only after the phase's gate passes, and avoid including unrelated in-progress edits. The detailed requirements remain in Workstreams 1–5 below.

Track completion in the [rollout checklist](control-ribbon-checklist.md); use this plan as the source of requirements and dependencies.

| Phase | Scope | Depends on | Gate before checkpoint |
|---|---|---|---|
| 0. Baseline | Recheck the repository snapshot, working-tree changes, and required development data/services. | None | Page inventory reflects the branch; save `CP0 — Before control-ribbon implementation` before the first application-code change. |
| 1. Shared foundation | Workstream 1: shared components, sizing, focus, disclosure, and tab semantics. | Phase 0 | Frontend build, focused lint, and `git diff --check` pass; save `CP1 — Shared ribbon foundation stable`. Do not start page adoption if this gate fails. |
| 2A. Admin core pages | Workstream 2: Reports, Equipment, and Lab Schedule. | Phase 1 | Changed-page smoke checks pass and existing filters/views still work; save `CP2A — Reports, equipment, and schedule complete`. |
| 2B. Admin requests and directory | Workstream 2: Requests and Academic Directory. | Phase 1 | Status filters, advanced filters, entity switching, and their result panels work; save `CP2B — Requests and directory complete`. |
| 2C. Admin supporting pages | Workstream 2: Audit Logs, Academic Period, and the review-only Manage Accounts pass. | Phase 1 | Search/refresh/settings behavior remains intact and any Manage Accounts changes are justified; save `CP2C — Admin supporting pages complete`. |
| 3A. Faculty | Workstream 3: faculty schedule controls only. | Phase 1 | Schedule-view controls work and portal navigation, requests, and details remain unchanged; save `CP3A — Faculty schedule controls complete`. |
| 3B. Student | Workstream 3: student schedule controls only. | Phase 1 | Schedule-view controls work and portal navigation, requests, and details remain unchanged; save `CP3B — Student schedule controls complete`. |
| 4A. Admin Reports review | Workstream 4: responsive, accessibility, and interaction checks for Reports only. | Phase 2A | Every applicable check and the Reports matrix row has a pass/fail/blocked result; record findings and blockers; save `CP4A — Reports review complete`. |
| 4B. Admin Equipment and Lab Schedule review | Workstream 4: responsive, accessibility, and interaction checks for Equipment and Lab Schedule. | Phase 2A | Both pages' applicable checks and matrix rows have pass/fail/blocked results; record findings and blockers; save `CP4B — Equipment and lab schedule review complete`. |
| 4C. Admin Requests and Academic Directory review | Workstream 4: responsive, accessibility, and interaction checks for Requests and Academic Directory. | Phase 2B | Both pages' applicable checks and matrix rows have pass/fail/blocked results; capture Requests at 1280px and 390px; save `CP4C — Requests and directory review complete`. |
| 4D. Admin supporting-pages review | Workstream 4: responsive, accessibility, and interaction checks for Audit Logs, Academic Period, and Manage Accounts. | Phase 2C | All three pages' applicable checks and matrix rows have pass/fail/blocked results; record findings and blockers; save `CP4D — Admin supporting-pages review complete`. |
| 4E. Faculty review | Workstream 4: responsive, accessibility, and interaction checks for the Faculty schedule. | Phase 3A | Faculty checks and matrix row have a pass/fail/blocked result; capture at 1280px and 390px; save `CP4E — Faculty review complete`. |
| 4F. Student review | Workstream 4: responsive, accessibility, and interaction checks for the Student schedule. | Phase 3B | Student checks and matrix row have a pass/fail/blocked result; capture at 1280px and 390px; save `CP4F — Student review complete`. |
| 4. Review consolidation | Workstream 4: confirm the six review records cover the full interaction matrix and carry forward any findings or blockers. No page-by-page retest. | Phases 4A–4F | Every matrix row has a pass/fail/blocked result; blockers identify the missing prerequisite; save `CP4 — Responsive and accessibility review complete`. |
| 5. Final verification | Workstream 5: build, lint, diff, workflow/browser logs, and final visual checks. | Phase 4 | Final quality gate below passes and every matrix row has a pass/block result; save `CP5 — Control-ribbon rollout verified`. |

For clean checkpoint boundaries, complete Phases 2A–2C and 3A–3B serially by default. They may run in parallel after Phase 1 only when edits are isolated and do not touch the same page files. If work is parallelized, wait until all edits included in the workspace have passed their gates before saving a checkpoint.

---

## Workstream 1: Stabilize the shared ribbon foundation

**Owner:** Agent A  
**Dependency:** None

### Files

- `frontend/src/index.css`
- `frontend/src/components/FilterToolbar.tsx`
- `frontend/src/components/shared/CompactFilterPanel.tsx`
- `frontend/src/components/shared/PageTabGroup.tsx`
- `frontend/src/components/shared/AcademicPeriodFilter.tsx`
- `frontend/src/components/shared/DropdownField.tsx`
- `frontend/src/components/shared/pageTabGroupUtils.ts`

### Tasks

1. Review the shared component behavior and `.page-control-ribbon` styles against the repository snapshot above.
2. Set and apply one interactive-control sizing rule. Resolve the current 36px compact-input versus 40px button mismatch; retain a documented exception only when it remains usable on touch screens.
3. Ensure controls have consistent:
   - Border radius
   - Background color
   - Spacing
   - Visible keyboard focus states
   - Active states
   - Mobile wrapping or horizontal scrolling, as appropriate to the control
4. Make sure nested ribbon components do not create unnecessary double borders.
5. Define and implement the whole-ribbon expanded/collapsed state. Give the ribbon and its toggle stable IDs and matching `aria-controls`/`aria-expanded` values.
6. Keep the page header outside the ribbon. Refine `FilterToolbar` or its callers so the title/description are not rendered inside the ribbon when the page already provides a header.
7. Add a collapsed-state summary that reflects current search, filters, period, and view without changing their state.
8. Give expandable controls inside the ribbon (`FilterToolbar`, `CompactFilterPanel`, and compact `AcademicPeriodFilter`) stable panel IDs and matching `aria-controls`/`aria-expanded` values.
9. Preserve `PageTabGroup` roving focus and Arrow/Home/End behavior. For every use, connect tabs to a real panel and label the active panel from its active tab; do not use tab roles for ordinary page navigation.
10. Review `DropdownField` wherever it is used by operational filters. Prefer native controls when suitable; if a custom popup remains, define and implement its keyboard operation and accessible expanded state.
11. Verify `AcademicPeriodFilter` with `compact` enabled in standalone and nested contexts.
12. Preserve existing component APIs and filter state behavior where possible; identify any necessary API change before page adoption begins.

### Phase 1 shared API decisions

- `PageTabGroup.panelId` is required. Tab IDs are derived from that panel ID with `getPageTabId(panelId, tabId)` so the active tab and its tab panel can be linked without relying on generated IDs.
- Each panel using `PageTabGroup` must set `aria-labelledby` to the ID of its active tab. The current Reports, Equipment, and Lab Schedule panels follow this relationship.
- `DropdownField` keeps its existing props and value-change contract but uses a native `<select>` so keyboard operation and expanded/selected semantics come from the browser rather than a custom popup.
- Ribbon controls use a 40px minimum interactive target; compact filter fields and tab controls are normalized to 40px.
- The whole ribbon has one stable content ID and one visible toggle. The toggle controls only visibility and never resets page state.
- The collapsed summary is derived from existing page state; it does not introduce new API calls or duplicate filter state.
- `PortalLayout` owns page identity and description. A ribbon's `actions` slot owns page-level actions that should remain visible while the ribbon is collapsed; its collapsible body owns search, filters, period, and view controls.

### Constraints

- Do not change API calls.
- Do not change filter state behavior.
- The original rollout deferred global stickiness; that constraint is superseded by the follow-up scope above.
- Do not move page identity into the ribbon.
- Do not hide primary page actions inside the collapsible control body. Use the always-visible ribbon action slot on pages that already have a ribbon; do not add a ribbon solely to host an action.
- Do not modify dashboard, profile, or landing page layouts in this workstream.

### Done looks like

- The page header is visually and semantically separate from the ribbon.
- The ribbon is expanded/collapsed as one region with an accessible toggle.
- The collapsed state communicates active search/filter/view context without clearing it.
- Shared controls use one Word-inspired visual language with labeled groups.
- No nested “card inside card” appearance.
- Mobile controls wrap cleanly.
- Keyboard focus remains visible.
- Expand/collapse state and tab-to-panel relationships are exposed correctly to assistive technology.
- The agreed control-height rule is applied or exceptions are documented.
- Focused ESLint passes for every changed shared component.

---

## Workstream 2: Finish admin page adoption

**Owner:** Agent B  
**Dependency:** Workstream 1

### Files

- `frontend/src/pages/AdminReports.tsx`
- `frontend/src/pages/AdminEquipment.tsx`
- `frontend/src/pages/AdminLabSchedule.tsx`
- `frontend/src/pages/AdminRequests.tsx`
- `frontend/src/pages/AdminAcademicDirectory.tsx`
- `frontend/src/pages/AdminAuditLogs.tsx`
- `frontend/src/pages/AdminAcademicPeriod.tsx`
- `frontend/src/pages/ManageAccounts.tsx`

### Tasks

#### Reports

- Keep the page title and description in the PortalLayout header; place Overview export actions in the ribbon's always-visible action slot.
- Keep academic period and date range controls inside one compact ribbon.
- Keep report categories as a compact tab row.
- Do not show long descriptions for every report category at once.
- Keep the active date range visible in a small summary line.
- Ensure collapsing the ribbon does not hide the active-range summary or clear the selected range.
- Ensure each tab's `aria-controls` points to the actual report panel and the panel is labeled by the active tab.

#### Equipment and schedule

- Keep search and filter controls in the shared toolbar.
- Keep table, chart, and calendar controls compact.
- Avoid stacking a full filter card, a full tab card, and another bordered container directly on top of each other.
- Keep schedule filters and academic-period context in one understandable control group rather than repeating the same context in nested panels.
- Keep page identity in the PortalLayout header, place page-level actions in the ribbon's always-visible action slot, and preserve a compact summary when the ribbon is collapsed.

#### Requests

- Treat status counts as filter controls, not large dashboard cards.
- Keep the status summary compact and make the selected status apparent without relying on color alone.
- Keep advanced filters behind the existing “More filters” behavior.
- Preserve existing status counts and filter state transitions.

#### Academic directory

- Keep summary counts visually secondary.
- Use the tab row for switching between directory entities.
- Keep the context-sensitive Add action in the ribbon's always-visible action slot for the selected entity.
- Replace the current custom entity buttons with `PageTabGroup`, or document a specific reason to keep a different accessible control pattern.
- Avoid making both summary cards and entity tabs look like primary navigation.

#### Audit logs

- Use the ribbon for search, action, entity, and date filters.
- Adopt the shared toolbar/filter-panel pattern where it fits the existing controls; if native controls remain, document the exception and keep their sizing, focus, and spacing consistent.
- Keep Refresh as a page action in the ribbon's always-visible action slot.
- Keep the log table visually separate from the controls.

#### Academic period

- Keep the page title and description in the PortalLayout header and Refresh with the settings content.
- Do not add a ribbon solely to host Refresh; this settings page intentionally keeps its form and refresh action outside a ribbon.
- Do not force the entire settings content into a ribbon.

#### Manage Accounts

- Review the existing shared toolbar and compact filter panel for consistency with the agreed sizing and focus rules.
- Do not redesign the account table or change its independent horizontal scrolling.
- Do not count this page as a new adoption unless the review finds a specific gap.

### Done looks like

Every admin operational page follows this hierarchy:

```text
Page title and primary actions
Control ribbon
Optional tabs
Status/error message
Main content
```

Additional requirements:

- No page has more than two consecutive bordered control containers.
- Important actions remain easy to find.
- Existing filters and navigation continue to work.
- Collapsing and expanding the ribbon preserves all existing search, filter, period, view, and tab state.
- The two-container limit applies to wrappers around the same control group; separate summary data and main content are not counted as ribbon wrappers.

---

## Workstream 3: Apply the pattern to faculty and student operational pages

**Owner:** Agent C  
**Dependency:** Workstream 1

### Files

- `frontend/src/pages/FacultyPanel.tsx`
- `frontend/src/pages/StudentPanel.tsx`
- Shared schedule sections inside those files
- Any shared components imported by those sections

### Tasks

1. Audit schedule, request, equipment, and calendar controls.
2. Reuse `FilterToolbar` and `PageTabGroup` where available.
3. Replace the custom in-content schedule view selectors with `PageTabGroup`, or document a reason to retain a different accessible pattern.
4. Keep `PortalLayout` sidebar navigation as navigation; do not convert it into an in-page tab group.
5. Keep student and faculty workflows distinct where their actions differ.
6. Avoid changing:
   - Borrow request behavior
   - Schedule conflict behavior
   - Equipment availability logic
   - API contracts
7. Keep action buttons near the relevant content instead of moving every action into a global ribbon.
8. Do not extract or redesign the duplicated schedule chart/list implementation in this workstream. If a schedule behavior change is necessary, identify its impact on the admin, faculty, and student copies before making it.
9. Keep the portal page header separate from the collapsible ribbon and verify that collapsing the ribbon preserves schedule search, filters, view, and tab state.

### Done looks like

- Faculty and student operational sections visually match admin pages.
- Faculty and student portal headers remain separate from the control ribbon.
- Search and view controls are compact.
- The whole ribbon can be expanded and collapsed without clearing schedule state.
- In-content schedule tabs have the same keyboard, focus, and tab/panel behavior as admin tabs.
- Request forms and detail panels retain their existing structure.
- No new duplication of filter logic is introduced.

---

## Workstream 4: Responsive and accessibility review

**Owner:** Agent D  
**Dependency:** Workstreams 1–3

### Bounded review tasks

Run these as separate, serial parent phases with the smaller subtasks below. Each subtask should load and inspect only its assigned page, record its results, and stop at its gate before the next subtask begins. This keeps the review context and effort bounded while retaining one checkpoint per parent phase.

| Task | Pages in scope | Prior phase |
|---|---|---|
| 4A | Admin Reports | 2A |
| 4B | Admin Equipment and Admin Lab Schedule | 2A |
| 4C | Admin Requests and Admin Academic Directory | 2B |
| 4D | Admin Audit Logs, Admin Academic Period, and Manage Accounts | 2C |
| 4E | Faculty schedule | 3A |
| 4F | Student schedule | 3B |

### Smaller serial subtasks for Phases 4B–4F

Complete the subtasks in order within each parent phase. Do not open the next page until the current page's responsive and interaction observations have been recorded. A subtask may be marked blocked when its runtime prerequisite is unavailable; do not convert a blocked result into a pass during the parent-phase gate.

| Parent phase | Subtask | Scope | Required output |
|---|---|---|---|
| 4B | 4B.1 — AdminEquipment responsive | AdminEquipment at 1280px, 1024px, and 390px; apply the shared checks. | Responsive/accessibility results and reproduction details for failures or blockers. |
| 4B | 4B.2 — AdminEquipment interactions | View switching, search, filters, ribbon disclosure, and applicable empty/error states. | Interaction result confirming selected view, controls, and results stay in sync. |
| 4B | 4B.3 — AdminLabSchedule responsive | AdminLabSchedule at 1280px, 1024px, and 390px; apply the shared checks. | Responsive/accessibility results and reproduction details for failures or blockers. |
| 4B | 4B.4 — AdminLabSchedule interactions | View switching, search, filters, ribbon disclosure, and applicable empty/error states. | Interaction result confirming selected view, controls, and schedule results stay in sync. |
| 4B | 4B.5 — Record and gate | Both 4B pages only. | Both matrix rows recorded; failures/blockers documented; parent gate and checkpoint status recorded. |
| 4C | 4C.1 — AdminRequests responsive | AdminRequests at 1280px, 1024px, and 390px; apply the shared checks. | Responsive/accessibility results and reproduction details for failures or blockers. |
| 4C | 4C.2 — AdminRequests interactions | Status filters, advanced filters, reset, counts, results, ribbon disclosure, and applicable empty/error states. | Interaction result for every status and filter transition. |
| 4C | 4C.3 — AdminRequests captures | AdminRequests at 1280px and 390px. | Two captures showing the ribbon and main results area. |
| 4C | 4C.4 — AdminAcademicDirectory responsive | AdminAcademicDirectory at 1280px, 1024px, and 390px; apply the shared checks. | Responsive/accessibility results and reproduction details for failures or blockers. |
| 4C | 4C.5 — AdminAcademicDirectory interactions | Every entity tab, matching panel, keyboard behavior, and secondary summary counts. | Interaction result for every entity tab and its panel relationship. |
| 4C | 4C.6 — Record and gate | Both 4C pages only. | Both matrix rows recorded; failures/blockers documented; CP4C saved after the parent gate. |
| 4D | 4D.1 — AdminAuditLogs | AdminAuditLogs at all three widths; search, action/entity/date filters, ribbon disclosure, refresh, and applicable states. | Page review result and reproduction details for failures or blockers. |
| 4D | 4D.2 — AdminAcademicPeriod | AdminAcademicPeriod at all three widths; refresh and settings/edit controls. | Page review result confirming settings remain outside the ribbon. |
| 4D | 4D.3 — ManageAccounts | ManageAccounts at all three widths; search/filters and independent account-table scrolling. | Page review result confirming table scrolling remains independent. |
| 4D | 4D.4 — Record and gate | All three 4D pages only. | Three matrix rows recorded; failures/blockers documented; CP4D saved after the parent gate. |
| 4E | 4E.1 — Faculty responsive | Faculty schedule at 1280px, 1024px, and 390px; apply the shared checks. | Responsive/accessibility results and reproduction details for failures or blockers. |
| 4E | 4E.2 — Faculty interactions | Schedule views, search, date/filter controls, ribbon disclosure, and applicable states; verify portal navigation, requests, and details are unchanged. | Interaction result plus unchanged-workflow result. |
| 4E | 4E.3 — Captures and gate | Faculty schedule at 1280px and 390px. | Two captures, matrix row, documented failures/blockers, and CP4E after the parent gate. |
| 4F | 4F.1 — Student responsive | Student schedule at 1280px, 1024px, and 390px; apply the shared checks. | Responsive/accessibility results and reproduction details for failures or blockers. |
| 4F | 4F.2 — Student interactions | Schedule views, search, date/filter controls, ribbon disclosure, and applicable states; verify portal navigation, requests, and details are unchanged. | Interaction result plus unchanged-workflow result. |
| 4F | 4F.3 — Captures and gate | Student schedule at 1280px and 390px. | Two captures, matrix row, documented failures/blockers, and CP4F after the parent gate. |

The parent-phase checkpoint remains the only checkpoint for each group. The record-and-gate subtask is administrative consolidation of the subtasks' results, not a second page-by-page review.

For each subtask, apply the applicable viewport, accessibility, and interaction checks below only to its assigned page. Use representative widths of 1280px (desktop), 1024px (tablet), and 390px (mobile). Check advanced-filter, error, empty, and dropdown states when the assigned page has those controls or states. Record each applicable check as **pass**, **fail**, or **blocked**; explain **not applicable** checks. For a failure, include the page, viewport, reproduction steps, and observed result; for a blocked check, name the missing prerequisite. Do not repeat a completed subtask's checks during parent-phase recording or final consolidation.

These are review-only tasks: keep application-code changes and unrelated cleanup out of scope. If a defect requires a code change, record the page, viewport, reproduction steps, and observed result, then track that fix separately rather than expanding the review task.

Save the task checkpoint only after its scoped checks and interaction-matrix rows are recorded:

- 4A: `CP4A — Reports review complete`
- 4B: `CP4B — Equipment and lab schedule review complete`
- 4C: `CP4C — Requests and directory review complete`
- 4D: `CP4D — Admin supporting-pages review complete`
- 4E: `CP4E — Faculty review complete`
- 4F: `CP4F — Student review complete`

After all six task records are complete, consolidate their results without rerunning the page checks. Save `CP4 — Responsive and accessibility review complete` only when every interaction-matrix row has a pass/fail/blocked result and every finding or blocker is documented. A review checkpoint records the review outcome; it does not mean failed checks have been fixed or that the final quality gate passes.

### Viewports

- Desktop: 1280px and wider
- Tablet: 768px–1279px
- Mobile: below 768px, including a narrow 390px viewport

### Checks

1. At each viewport, pages have no unintended horizontal overflow; tables and tab rows may scroll within their own containers where required.
2. Tabs remain usable on narrow screens, including long labels and counts; horizontal scrolling must not hide the focused tab.
3. Search fields retain enough width to enter and review a useful query.
4. Buttons retain readable labels and usable touch targets; selected status filters are distinguishable without color alone.
5. Focus outlines remain visible in resting, expanded, selected, and hover states.
6. Tabs expose a valid `tablist`/`tab`/`tabpanel` relationship, selected state, and keyboard behavior; ordinary navigation is not given tab semantics.
7. Every disclosure's `aria-expanded` state matches its visibility, and `aria-controls` points to its content.
8. Custom dropdowns can be operated by keyboard and announce their open state; use native controls where custom behavior is unnecessary.
9. Advanced filters do not push the main content excessively far down; their open/closed state is clear to keyboard and screen-reader users.
10. The whole ribbon can be expanded and collapsed at each viewport; the toggle remains visible and its accessible state matches the content.
11. Collapsed summaries communicate relevant active state without exposing stale values or clearing controls.
12. Error and empty states do not break the ribbon layout; errors are announced appropriately.
13. Tables remain horizontally scrollable where required.
14. Pagination remains independent of the ribbon and preserves scroll position.

### Page interaction matrix

Exercise the real controls, not only their appearance:

- Reports: switch report tabs, change date range, and confirm the active range and report panel agree.
- Equipment and schedules: change view, search/filter, and confirm the selected view and results stay in sync.
- Requests: switch each status filter, open/close advanced filters, reset filters, and confirm the result set and counts remain correct.
- Academic directory: switch every entity tab and verify its matching panel; confirm summary counts remain secondary.
- Audit logs: search and change filters; confirm refresh remains available as a page action.
- Academic period: use refresh and edit settings without pulling the settings form into the ribbon.
- Manage Accounts: search/filter and verify the table remains independently scrollable.
- Faculty and student: switch schedule views and verify the schedule controls; confirm portal navigation and request/detail flows are unchanged.
- Every adopted page: expand and collapse the whole ribbon, confirm its summary is accurate, and verify that no search/filter/view state is lost.

### Recorded result — Reports (Phase 4A)

- **Overall: FAIL.** Report-tab and date-range interactions passed: switching to Requests updated the selected panel and `reportTab`; applying and clearing a range updated the displayed range; collapsing and expanding preserved the selected category and dates. See the dated Phase 4A notes in the rollout checklist for detailed observations.
- **Responsive: FAIL at 390px; PASS at 1024px and 1280px.** At 390px the document is 573px wide because the report category tab row also causes page-level overflow. Hiding that tab group removed the document overflow; check other report content while fixing it.
- **Accessibility: FAIL.** Reversed date ranges show a validation message, but it has no `role="alert"` or `aria-live` announcement.
- Tab/panel relationships and keyboard navigation: **PASS**. Ribbon disclosure and state summary: **PASS** at all three widths. Academic-period controls, advanced-filter disclosure, and the tested empty state: **PASS**.
- The current preview session is unauthenticated, so this follow-up did not replay the protected page interactions. These results reflect the recorded 25 September 2026 review; the two failures remain follow-up fixes, not reasons to report the review as passed.

### Recorded result — AdminEquipment responsive review (Phase 4B.1)

- **Overall: BLOCKED/FAIL.** The authenticated visual review could not run because the available preview session had no admin authentication; `/admin/equipment` redirected to the landing page at the available 1280px preview. The missing prerequisite is an authenticated admin browser session, so runtime results for 1280px, 1024px, and 390px remain blocked.
- **Static responsive containment: PASS.** The ribbon summary wraps below 640px; academic-period and primary filter groups become single-column layouts on narrow screens; view tabs scroll horizontally; the inventory table scrolls inside its table container; and the usage calendar scrolls inside its own 720px minimum-width container.
- **Touch-target check: FAIL for Usage Calendar controls.** The equipment selector and `Today`/previous/next controls use padding-only sizing rather than the shared 40px minimum target. This is a separate implementation fix, not a change to the review-only subtask.
- **Source-level accessibility checks: PASS.** Academic-period and calendar equipment selects have labels; the view group exposes `tablist`/`tab` semantics with selected state and keyboard handlers; and the ribbon and academic-period disclosures expose matching `aria-expanded`/`aria-controls` state.
- **Matrix result:** AdminEquipment responsive row = **FAIL overall** because the runtime review is blocked and the static touch-target check failed. The finding and blocker are carried forward to Phase 4B consolidation.

### Recorded result — AdminEquipment interaction review (Phase 4B.2)

- **Overall: BLOCKED for browser interaction, PASS for source/API interaction paths.** The authenticated browser session prerequisite is still unavailable, so rendered clicks and post-update state changes could not be replayed in the UI. The available preview redirects the protected route to the landing page.
- **Source-level state review: PASS.** `viewMode` synchronizes with the `tab` URL parameter; search, status, and low-stock filters update shared state and URL parameters; reset and active-filter chip removal target only their corresponding state; whole-ribbon and advanced-filter disclosures are independent; and the empty state is rendered when the filtered result set is empty.
- **Development API checks: PASS.** Authenticated seeded-admin requests returned successful equipment, status, search, low-stock, stats, and academic-period responses. Every status-filtered response matched its requested status, the projector search matched the requested term, the no-match query returned zero rows, and low-stock results matched the server predicate.
- **Runtime blocker:** Opening `/admin/equipment` in the current unauthenticated preview redirects to `/`. The missing prerequisite is an authenticated admin browser session for post-render view switching, filter changes, disclosure toggles, and result-sync assertions.
- **Matrix result:** AdminEquipment interaction row = **BLOCKED overall** because the source/API paths pass but the required browser interaction replay is unavailable. Carry this blocker into Phase 4B consolidation.

### Recorded result — AdminLabSchedule responsive review (Phase 4B.3)

- **Overall: BLOCKED/FAIL.** The authenticated visual review could not run because the available preview session had no admin authentication; `/admin/schedule` redirected to the landing page at the available 1280px preview. The missing prerequisite is an authenticated admin browser session, so runtime results for 1280px, 1024px, and 390px remain blocked.
- **Static responsive containment: PASS for primary layout.** Ribbon filter groups collapse to one column on narrow screens; advanced filters use responsive one-/two-/four-column layouts; view tabs scroll horizontally; the schedule table scrolls inside its table container; Chart View scrolls inside its own 700px minimum-width container; and Calendar View keeps its seven-column grid within the page width.
- **Touch-target check: FAIL.** Chart View's lab selector and Calendar View's `Today`/previous/next controls use padding-only sizing rather than the shared 40px minimum target. This is a separate implementation fix, not a change to the review-only subtask.
- **Accessibility label check: FAIL.** Chart View's `Lab` label is not programmatically associated with its `<select>` through `htmlFor`/`id` or an explicit `aria-label`. Ribbon filters use labeled wrappers, and compact academic-period controls expose labels.
- **Source-level disclosure/tab checks: PASS.** The ribbon and advanced-filter disclosures expose matching `aria-expanded`/`aria-controls`; the three view tabs use a linked `tablist`/`tabpanel` relationship and visible focus styles.
- **Matrix result:** AdminLabSchedule responsive row = **FAIL overall** because the runtime review is blocked and the static touch-target and label checks failed. Carry these findings and the browser prerequisite into Phase 4B consolidation.

### Recorded result — AdminLabSchedule interaction review (Phase 4B.4)

- **Overall: BLOCKED for browser interaction, PASS for source/API interaction paths.** The authenticated browser session prerequisite is still unavailable, so rendered view switching, filter changes, disclosure toggles, and post-update result assertions could not be replayed in the UI. The available preview redirects `/admin/schedule` to the landing page.
- **Source-level state review: PASS.** `viewMode` synchronizes with the `tab` URL parameter; search, date, academic-period, source, schedule-type, room, program, and faculty state synchronize to URL parameters; advanced-filter disclosure is independently controlled; reset clears filters and returns to the table view; active-filter chips remove only their own filter; and loading/error/empty result branches are present.
- **Development API and predicate checks: PASS.** Authenticated seeded-admin requests returned 25 schedules and all required resource collections. Client-side source/type/search predicates produced matching subsets, and an impossible search term produced zero rows for the empty-state path.
- **Runtime blocker:** Opening `/admin/schedule` in the current unauthenticated preview redirects to `/`. The missing prerequisite is an authenticated admin browser session for post-render view switching, filter changes, disclosure toggles, and result-sync assertions.
- **Matrix result:** AdminLabSchedule interaction row = **BLOCKED overall** because the source/API paths pass but the required browser interaction replay is unavailable. Carry this blocker into Phase 4B consolidation.

### Recorded result — Phase 4B consolidation

- **Parent gate: COMPLETE as a review record; overall outcome FAIL/BLOCKED.** Both assigned pages have recorded results. No page-by-page checks were repeated during consolidation.
- **Interaction-matrix status:**

  | Page | Responsive row | Interaction row |
  |---|---|---|
  | `AdminEquipment` | **FAIL** | **BLOCKED** |
  | `AdminLabSchedule` | **FAIL** | **BLOCKED** |

- **Carried findings:** Equipment Usage Calendar touch targets; AdminLabSchedule Chart/Calendar touch targets; AdminLabSchedule Chart View lab-label association; and the missing authenticated admin browser prerequisite. Each finding and blocker is documented in the page-specific results above.
- **Checkpoint:** The suggested `CP4B — Equipment and lab schedule review complete` label is not manually saved here; the previous hosted development environment manages checkpoints automatically. This review record contains FAIL/BLOCKED outcomes and must not be treated as a passed quality gate.

### Recorded result — AdminRequests responsive review (Phase 4C.1)

- **Overall: PASS for the 4C.1 responsive review.** `AdminRequests` was reviewed in an authenticated seeded-admin development session at 1280px, 1024px, and 390px. Runtime checks were completed at all three widths; the unauthenticated shared preview still redirects protected routes to `/`, so the authenticated review used a separate local browser session.
- **Responsive containment: PASS at 1280px, 1024px, and 390px.** The document and body scroll widths matched the viewport at each tested width. The status-control group reflowed from six columns on desktop to three columns at tablet width and one column on mobile. Search and date controls reflowed to a single column at 390px. No page-level horizontal overflow was observed; the request table remains inside its `TableContainer` overflow region.
- **Responsive/accessibility checks: PASS.** The page header remains outside the ribbon. Status controls are grouped under `Request status filters` and expose `aria-pressed` with count-bearing accessible names. Search, date, academic-period, and advanced filters remain in labeled groups. Shared visible-focus styling and 40px minimum sizing apply to the ribbon toggle, inputs, selects, and disclosure buttons.
- **Ribbon semantics: PASS.** The whole-ribbon toggle remained visible at each width with matching `aria-expanded` and `aria-controls` values, and the controlled content resolved the referenced stable ID. The collapsed summary is present in the ribbon bar and wraps at mobile width. The advanced-filter and academic-period disclosures have independent matching control/panel relationships in source.
- **Long labels and dropdowns: PASS for the responsive scope.** Status labels and counts fit within the reflowed cards without clipping or page overflow. Native academic-period and advanced-filter selects have visible labels and 40px styling when their disclosures are open; keyboard behavior is deferred to 4C.2.
- **Deferred scope:** Status transitions, advanced-filter open/close, reset, result/count synchronization, empty/error states, and the required 1280px/390px captures remain for 4C.2 and 4C.3. No failure or code-change request was created from 4C.1.

### Recorded result — AdminRequests interaction review (Phase 4C.2)

- **Overall: FAIL.** The authenticated seeded-admin development session exercised every AdminRequests interaction listed for 4C.2. Status filtering, advanced-filter disclosure, reset, result/count synchronization, whole-ribbon disclosure, and the tested empty state passed. The applicable reversed-date error state rendered its message but failed the live-announcement check.
- **Status filters and counts: PASS.** All requests, Pending, Approved, Borrowed, Returned, Declined, and Cancelled each became the selected `aria-pressed` filter. Result totals matched the status-card counts: 26, 5, 5, 4, 4, 4, and 4 respectively, and every visible result row matched the selected status for the filtered cases.
- **Advanced filters and reset: PASS.** “More filters” opened and closed its controlled panel with matching `aria-expanded`/`aria-controls` state. Reset filters returned the selected status to All requests, cleared the active filter state, and restored the 26-request result summary.
- **Whole-ribbon disclosure: PASS.** At 390px, collapsing the ribbon set its toggle to `aria-expanded="false"`, hid the controlled content, and retained the Pending selection and summary. Expanding restored the controls without losing that state. The inner advanced-filter disclosure remained independently closed.
- **Empty state: PASS.** Searching for `zzzz-no-match-4c2` rendered “No requests found,” removed the table rows, and updated the ribbon summary to show zero matching requests. Clearing the search restored the normal results path.
- **Error-state accessibility: FAIL.** Setting From date to `2099-12-31` and To date to `2020-01-01` displayed “The from date cannot be later than the to date.”, but the message and its ancestors exposed neither `role="alert"` nor `aria-live`. Reproduction: open `/admin/requests`, enter the reversed date range, and inspect the rendered error message. This is a separate accessibility fix, not a change to the review-only item.
- **Matrix result:** AdminRequests interaction row = **FAIL overall** because the status, filter, reset, disclosure, count/result, and empty-state paths passed but the applicable error message was not announced to assistive technology. Carry the finding into Phase 4C consolidation.
- **Deferred scope:** The 4C.3 captures and all Academic Directory review items remain outside this subtask. No request mutation actions were invoked.

### Recorded result — AdminRequests captures (Phase 4C.3)

- **Overall: PASS.** Captures were taken from an authenticated seeded-admin development session with the Requests page in its default All requests state. Both captures include the page header, control ribbon, and main results area.
- **Desktop capture:** `screenshots/phase-4c-admin-requests-1280.jpg` — 1280×1100 full-page capture.
- **Mobile capture:** `screenshots/phase-4c-admin-requests-390.jpg` — 390×1600 full-page capture showing the wrapped ribbon controls and the beginning of the horizontally contained results table.
- **Scope boundary:** No Academic Directory review work, error-state fix, or other application-code change was included.

### Recorded result — AdminAcademicDirectory responsive review (Phase 4C.4)

- **Overall: FAIL.** The authenticated seeded-admin development session reviewed `AdminAcademicDirectory` at 1280px, 1024px, and 390px. Desktop and tablet containment passed; the mobile check found document-level horizontal overflow from the entity tab row.
- **Responsive containment: PASS at 1280px and 1024px; FAIL at 390px.** At 1280px and 1024px, document and body scroll widths matched the viewport. At 390px, the document scroll width reached 528px while the viewport was 390px. The tablist has an intended internal scroller (`clientWidth` 326px, `scrollWidth` 578px), but the offscreen `Subjects`/`Departments` tab content still extends the page-level scroll area; the farthest tab reached approximately x=591px. Reproduction: open `/admin/academic-directory` at 390px and scroll the page horizontally. This is a separate responsive fix, not a change to the review-only item.
- **Tabs and focus structure: PASS by runtime/source review, interaction deferred.** The entity tablist is labeled `Academic directory entities`; tabs use 40px controls, `aria-selected`, `aria-controls`, roving `tabIndex`, and visible focus styles. The initial Buildings tab was linked to `academic-directory-tabpanel`, whose `aria-labelledby` matched the active tab. Switching every entity and exercising Arrow/Home/End remains 4C.5 scope.
- **Ribbon and page hierarchy: PASS.** The page header and context-sensitive Add action remain outside the ribbon. The Directory filters ribbon was present at all three widths with a visible 40px toggle, matching `aria-expanded`/`aria-controls`, and the labeled `Directory search and filters` group. The collapsed summary and ribbon interaction remain outside this responsive-only item.
- **Summary and table containment: PASS for the tested default Buildings view.** Summary counts wrapped into a two-column grid at 390px and five columns at wider widths without page-level overflow. The table container stayed within the content width and retained `overflow-x: auto`.
- **Dropdowns and states: PASS by source review; interaction deferred.** The Buildings filter is labeled and uses the native select path with visible focus styling and a 40px compact-ribbon target when opened. Advanced-filter, entity-switching, empty/error-state, and keyboard interaction checks remain 4C.5 scope.
- **Matrix result:** AdminAcademicDirectory responsive row = **FAIL overall** because the 390px tablist overflow leaks into the document scroll area. Carry the finding into Phase 4C consolidation.
- **Scope boundary:** No code change, entity-tab switch, or 4C.5 interaction review was performed.

### Recorded result — AdminAcademicDirectory interaction review (Phase 4C.5)

- **Overall: PASS.** An authenticated seeded-admin development browser session exercised all five entity tabs: Buildings, Rooms, Programs, Subjects, and Departments.
- **Tab/panel synchronization: PASS.** Each click selected the requested tab, rendered the matching panel heading, kept the tab's `aria-controls` pointed at `academic-directory-tabpanel`, and updated the panel's `aria-labelledby` to the selected tab ID.
- **Keyboard behavior: PASS.** At the narrow 390px device viewport, ArrowRight wrapped from Departments to Buildings; Home selected Buildings; End selected Departments. Focus followed selection and each resulting panel matched its selected tab.
- **Summary counts: PASS.** The five count summaries remain a separate, non-interactive list after the entity tabs and before the tab panel; their compact white rows and small labels/counts remain visually secondary to the selected tab.
- **Matrix result:** AdminAcademicDirectory interaction row = **PASS**. The separate 390px responsive overflow recorded in Phase 4C.4 remains an open failure for the Phase 4C gate.
- **Scope boundary:** No directory records were changed, and no application-code changes or 4C.6 consolidation/checkpoint work were performed.

### Recorded result — Phase 4C consolidation (Phase 4C.6)

- **Parent gate: COMPLETE as a review record; overall outcome FAIL.** The four scoped page-review records and the Requests captures are present. No page-by-page checks were repeated during consolidation.
- **Interaction matrix:**

  | Page | Responsive row | Interaction row |
  |---|---|---|
  | `AdminRequests` | **PASS** | **FAIL** |
  | `AdminAcademicDirectory` | **FAIL** | **PASS** |

- **Carried findings:** The Requests date-range error has no live announcement (see 4C.2); the Academic Directory tab row leaks horizontal overflow to the document at 390px (see 4C.4). Both remain unresolved; neither failed row is converted to a pass.
- **Blockers and captures:** No 4C checks were blocked for lack of an authenticated admin session. The required captures exist at `screenshots/phase-4c-admin-requests-1280.jpg` and `screenshots/phase-4c-admin-requests-390.jpg`.
- **Checkpoint:** the previous hosted development environment manages checkpoints automatically; no manually named `CP4C` checkpoint is claimed. This review record is complete, but the overall Phase 4C outcome is FAIL.
- **Scope boundary:** Consolidation only. No page-by-page checks were repeated and no application code was changed.

### Recorded result — AdminAuditLogs review (Phase 4D.1)

- **Overall: FAIL/BLOCKED.** The authenticated seeded-admin review completed at 1280px, 1024px, and 390px. The page has no document-level horizontal overflow, but Reset filters is only 28px high. Data-dependent filter/result matching, table scrolling, and row details could not be verified because the development audit log returned no entries.
- **Responsive containment: PASS at 1280px, 1024px, and 390px.** Document and body widths matched the viewport at each width. At 390px, the search field remains 313px wide and the filters stack into one column. Runtime table-scroll verification is blocked because the empty state replaces the table.
- **Touch targets: FAIL for Reset filters.** Reproduction: open `/admin/audit-logs` with the ribbon expanded at 1280px, 1024px, or 390px and inspect Reset filters; its rendered height is 28px, below the 40px interactive target. The page-header Refresh action, ribbon toggle, search field, date inputs, and native selects are 40px high. The row-level View details target could not be measured because no audit rows render.
- **Labels, focus, and dropdowns: PASS.** Search, Action, Entity type, From, and To have wrapping labels. The native Action select responds to ArrowDown and exposes a visible 2px focus outline. Tabs and advanced filters are not applicable.
- **Ribbon disclosure: PASS at all three widths.** `aria-expanded` matched content visibility, and `aria-controls` referenced the controlled panel. With search and action filters active, collapse retained the values and “Search and filters active” summary; expanding restored the controls without clearing state.
- **Interactions: PARTIAL/BLOCKED.** Search, action, entity, and date control changes invoked the audit-log query path; Refresh remained available in the page header outside the ribbon and completed without an error. The development endpoint returned zero logs for default, broad-date, and filtered views, so matching/non-matching results could not be verified. The default empty state is contained. A reversed range (From 2099-12-31; To 2020-01-01) displayed “The from date must be before the to date.” in `role="alert"`.
- **Matrix result:** AdminAuditLogs responsive row = **FAIL** for the 28px Reset filters target; interaction row = **BLOCKED overall** for data-dependent result matching and table/row-detail checks. Missing prerequisite: at least one development audit-log entry. No audit entries were created during this review.
- **Scope boundary:** Review only; no application code or audit data was changed.

Use the normal development backend and non-production data for authenticated page checks. If required services or seeded role accounts are unavailable, mark runtime/visual checks as blocked rather than treating them as passed.

### Recommended mobile behavior

```text
Page title
Primary action

[Control ribbon: expanded or collapsed]
Ribbon toggle
Search
More filters
Active filter summary

[Horizontally scrollable tabs]
```

Do not force every filter into a single horizontal row on mobile. The ribbon may wrap its groups, and the entire ribbon may collapse to its summary when the user chooses.

---

## Workstream 5: Verification and regression checks

**Owner:** Agent E  
**Dependency:** Workstreams 1–4

### Commands

```bash
cd frontend
npm run build
```

Run focused lint checks on changed shared components:

```bash
npx eslint \
  src/components/FilterToolbar.tsx \
  src/components/shared/CompactFilterPanel.tsx \
  src/components/shared/PageTabGroup.tsx \
  src/components/shared/AcademicPeriodFilter.tsx \
  src/components/shared/DropdownField.tsx
```

Run:

```bash
git diff --check
```

### Workflow checks

1. Start or restart the `Backend API` and `Start application` workflows as needed after the final batch of changes.
2. Confirm Vite starts normally.
3. Refresh workflow and browser logs.
4. Confirm there are no new:
   - Module import errors
   - CSS parsing errors
   - React runtime errors
   - Fast Refresh failures

### Visual checks

Review each page in the page interaction matrix at representative desktop and mobile widths. Capture the pages with the densest/most-nested control groups at both widths so the container and overflow criteria can be checked directly.

At minimum, capture `AdminRequests` and the faculty/student schedule views at 1280px and 390px, then inspect the remaining pages in the matrix for page-specific control behavior and errors.

### Existing lint note

The repository currently contains pre-existing ESLint issues related to effect-driven state updates and `any` types in several pages. Agents should not expand this scope unless specifically assigned.

The required quality gate for this work is:

- Production build passes.
- Changed shared components pass focused lint.
- No new runtime or module errors appear.
- `git diff --check` passes.
- Every row in the page interaction matrix has a pass/fail/blocked result; failed or blocked checks are not reported as passed.

---

## Recommended agent order

The arrows within the page-batch branches show the checkpoint-friendly default sequence. The batches are independent after Phase 1 and may run in parallel only under the isolation rule above.

```text
Phase 0: baseline / CP0
          ↓
Phase 1: shared foundation / CP1
   ├── Phases 2A → 2B → 2C: admin page batches / CP2A–CP2C
   └── Phases 3A → 3B: faculty and student / CP3A–CP3B
                         ↓
Phase 4A–4F: scoped responsive and accessibility reviews / CP4A–CP4F
                          ↓
Phase 4: consolidate review results / CP4
                          ↓
Phase 5: final verification / CP5
```

Phases 2A–2C and 3A–3B all depend on Phase 1 and can be run in parallel under the isolation rule above. Phase 4A–4F start only after their corresponding page-adoption batch is complete. Run the six review tasks serially; Phase 4 consolidation starts after all six task records are complete and must not repeat their page-by-page checks.

Workstream 1 owns only the shared component and stylesheet files listed in its scope. Workstream 2 owns admin pages and `ManageAccounts`; Workstream 3 owns `FacultyPanel` and `StudentPanel`. Freeze shared component APIs at the end of Workstream 1. If a later page change requires an API adjustment, pause page adoption and coordinate that change before parallel work continues.

## Final definition of done

The implementation is complete when:

- Operational pages share the same control ribbon treatment.
- Each adopted operational page has a separate page header followed by a collapsible ribbon.
- The ribbon uses grouped, Word-inspired controls and communicates useful state when collapsed.
- Reports no longer dominates the layout with large category cards.
- Filters, search, tabs, and actions have clear hierarchy.
- Existing pages are either using the shared behavior or have a documented, accessible exception.
- Dashboard, profile, and landing pages retain their more suitable layouts.
- Mobile layouts remain usable.
- Disclosures and tabs expose correct accessible state and keyboard behavior.
- Existing behavior and API integrations are unchanged.
- The build passes, required pages have been exercised, and the preview starts without new errors.
