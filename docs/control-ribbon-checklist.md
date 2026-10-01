> Historical review/proposal. See README.md and reproducible-verification.md for implemented status and current checks.

# SmartLab Collapsible Control Ribbon Rollout Checklist

Use this checklist alongside the [implementation plan](control-ribbon-implementation-plan.md). Recheck the plan's repository snapshot before starting. Leave boxes unchecked until the item is verified on the implementation branch.

**Current progress:** Phases 1–3, 4A–4B, and 4C are recorded (4C FAIL); 4D.1 is recorded as FAIL/BLOCKED; sticky-shell code is in place, with authenticated scrolling verification blocked.
**Checkpoint labels:** Suggested names only. Save the actual Replit checkpoint after its gate passes; this document does not create checkpoints.

## Phase 0 — Baseline

- [x] Reconcile the plan's page inventory with the current branch.
- [x] Record any existing working-tree changes before application-code edits.
- [x] Confirm the development backend, database, and role accounts needed for page checks are available.
- [ ] Save `CP0 — Before control-ribbon implementation`.

**Gate:** The page inventory and test prerequisites are understood; the pre-change state is recoverable.

## Phase 1 — Shared foundation

- [x] Review the shared ribbon styles and components against the repository snapshot.
- [x] Resolve the 36px compact-input versus 40px button sizing mismatch; apply a 40px minimum interactive target.
- [x] Align spacing, borders, active states, focus states, and mobile wrapping/scrolling.
- [x] Remove unnecessary nested borders.
- [x] Add matching IDs, `aria-expanded`, and `aria-controls` to expandable controls.
- [x] Verify each `PageTabGroup` has a real, correctly labeled tab panel and keeps arrow/Home/End keyboard behavior.
- [x] Replace the custom `DropdownField` popup with a native select, retaining its value-change API and browser keyboard semantics.
- [x] Check `AcademicPeriodFilter` compact styles in standalone and nested contexts.
- [x] Confirm existing API calls and filter-state behavior are unchanged.
- [x] Run `cd frontend && npm run build`.
- [x] From `frontend`, run focused ESLint on every changed shared component and tab-ID helper.
- [x] Run `git diff --check`.
- [x] Define the page-header/ribbon boundary so page identity and primary actions remain outside the ribbon.
- [x] Add one accessible toggle for the whole ribbon, separate from any advanced-filter disclosure.
- [x] Show a useful collapsed-state summary for active search, filters, period, and view without clearing state.
- [x] Use labeled ribbon groups and restrained Word-inspired separators without adding nested card wrappers.
- [ ] Save `CP1 — Shared ribbon foundation stable`.

**Gate:** Build, focused lint, and diff checks pass; the page-header/ribbon boundary, whole-ribbon disclosure, collapsed summary, shared control behavior, and accessibility are consistent. Do not begin page adoption if this gate fails.

## Phase 2A — Admin Reports, Equipment, and Lab Schedule

- [x] Reports: verify date-range controls, active-range summary, whole-ribbon collapse/expand behavior, and tab/panel labeling.
- [x] Equipment: review stacked borders; keep actions and summary counts distinct from filters.
- [x] Lab Schedule: keep the page header separate; check for duplicate/nested controls; confirm search, filters, view switching, and whole-ribbon collapse still work.
- [x] Confirm existing filters and API behavior are unchanged.
- [x] Run the frontend build and `git diff --check`.
- [ ] Save `CP2A — Reports, equipment, and schedule complete`.

**Gate:** Passed: the changed pages pass interaction checks and the build/diff checks pass. No CP2A checkpoint was saved.

**Verification notes (25 September 2026):**
- Reports: applied date range remains after collapse; the collapsed summary reflects it; the selected tab remains linked to its panel.
- Equipment: search remains after collapse; view tabs remain linked to their panel; header actions and summary data remain outside the filter ribbon.
- Lab Schedule: search and advanced-filter disclosure state remain after collapse; “More filters” controls its panel; view tabs remain linked to their panel.
- Measured ribbon controls meet the 40px target: Reports date actions, filter reset controls, and Phase 2A chip-removal buttons.
- Arrow navigation (including wrap), Home, and End passed on all three tab groups at 390px. The ribbon itself fits at that width. The full Reports page has horizontal overflow from content outside the ribbon; leave that for the later responsive-review phase.

## Phase 2B — Admin Requests and Academic Directory

- [x] Requests: make status counts compact filter controls with a clear selected state.
- [x] Requests: verify each status, advanced-filter open/close, whole-ribbon collapse/expand, reset, counts, and results.
- [x] Directory: verify every entity tab selects the correct panel and has accessible tab behavior.
- [x] Directory: keep summary counts secondary to the entity navigation.
- [x] Confirm existing filter state and API behavior are unchanged.
- [x] Run the frontend build and `git diff --check`.
- [ ] Save `CP2B — Requests and directory complete`.

**Gate:** Status filters and entity switching work; the build/diff checks pass.

**Verification notes (25 September 2026):**
- Requests: status counts are compact `aria-pressed` filter buttons, including an All requests option; the selected state is communicated by text and focus styling. Advanced filters remain behind “More filters,” while the whole ribbon has its own disclosure.
- Requests: the page header and request table remain outside the ribbon; reset, active-filter chips, academic period, counts, and result totals continue to use the existing state/API paths.
- Academic Directory: entity navigation uses `PageTabGroup` with roving keyboard focus and a linked `tabpanel`; switching an entity continues to clear the existing entity-specific filters.
- Academic Directory: summary counts are compact secondary content below the entity tabs, and the context-sensitive add action remains in the page header.
- `cd frontend && npm run build` and `git diff --check` pass. Protected admin routes redirect to sign-in without an authenticated browser session, so authenticated visual interaction checks remain blocked.
- Focused ESLint on the two changed page files still reports the repository's documented pre-existing page issues (`react-hooks/set-state-in-effect` and one `no-explicit-any`); no new ribbon-specific lint category was introduced.

## Phase 2C — Audit Logs, Academic Period, and Manage Accounts

- [x] Audit Logs: align search/entity/date controls with the shared treatment or document an accessible exception; verify whole-ribbon collapse/expand.
- [x] Audit Logs: keep refresh as a page action and the log table visually separate.
- [x] Academic Period: keep settings outside the ribbon and refresh in the page heading.
- [x] Manage Accounts: review the existing toolbar/filter panel; change only if a specific gap is found.
- [x] Confirm account-table horizontal scrolling remains independent.
- [x] Run the frontend build and `git diff --check`.
- [ ] Save `CP2C — Admin supporting pages complete`.

**Gate:** Search, refresh, settings, and account-table behavior remain intact; the build/diff checks pass.

**Verification notes (25 September 2026):**
- Audit Logs: search, action, entity, and date controls remain in the shared collapsible ribbon with native labeled inputs/selects and a labeled filter group. Refresh is now a page-header action, while the log history table remains a separate content section.
- Academic Period: the page heading and Refresh action are together; the current-period summary, settings form, available periods, and history remain outside any ribbon.
- Manage Accounts: the existing shared toolbar keeps its compact filter panel and independent table scrolling. The Add Account action is now in the page header, and the collapsed ribbon summary includes the result count.
- `cd frontend && npm run build` and `git diff --check` pass. Workflow HMR logs are clean after the final syntax correction.
- Focused ESLint on the three changed page files still reports the repository's documented pre-existing page issues (`react-hooks/set-state-in-effect`) and the existing Audit Logs `no-explicit-any`; these are outside Phase 2c's scope.

## Phase 3A — Faculty schedule controls

- [x] Keep the portal header separate from the collapsible ribbon; use the shared tab behavior for in-content schedule views, or document an accessible exception.
- [x] Keep `PortalLayout` sidebar navigation as navigation, not tabs.
- [x] Verify schedule controls without changing requests, details, or scheduling behavior.
- [x] Run the frontend build and `git diff --check`.
- [ ] Save `CP3A — Faculty schedule controls complete`.

**Gate:** Faculty schedule controls work and unrelated faculty workflows remain unchanged.

**Verification notes (25 September 2026):**
- Faculty: the existing `PortalLayout` header and sidebar navigation remain unchanged; only the schedule explorer’s in-content view selector was updated.
- Faculty schedule views now use `PageTabGroup` with a linked `tabpanel` for Table View, Chart View, and Calendar.
- The schedule ribbon summary preserves the selected view and date filter when collapsed; the existing search, date filter, reload, schedule rendering, and duplicated chart/list implementations remain intact.
- Request forms, request lists, cancellation flows, details, and portal navigation were not changed.
- `cd frontend && npm run build` and `git diff --check` pass. Focused ESLint still reports pre-existing `FacultyPanel` issues (`no-explicit-any`, `react-hooks/set-state-in-effect`, and dependency warnings); these are outside Phase 3A.

## Phase 3B — Student schedule controls

- [x] Keep the portal header separate from the collapsible ribbon; use the shared tab behavior for in-content schedule views, or document an accessible exception.
- [x] Keep `PortalLayout` sidebar navigation as navigation, not tabs.
- [x] Verify schedule controls without changing requests, details, or scheduling behavior.
- [x] Run the frontend build and `git diff --check`.
- [ ] Save `CP3B — Student schedule controls complete`.

**Gate:** Student schedule controls work and unrelated student workflows remain unchanged.

**Verification notes (25 September 2026):**
- Student: the existing `PortalLayout` header and sidebar navigation remain unchanged; only the schedule explorer’s in-content view selector was updated.
- Student schedule views now use `PageTabGroup` with a linked `tabpanel` for Table View, Chart View, and Calendar.
- The schedule ribbon summary preserves the selected view and date filter when collapsed; the existing search, date filter, reload, schedule rendering, and duplicated chart/list implementations remain intact.
- Request forms, request lists, cancellation flows, details, and portal navigation were not changed.
- `cd frontend && npm run build` and `git diff --check` pass. Focused ESLint still reports pre-existing `StudentPanel` issues (`no-explicit-any`, `react-hooks/set-state-in-effect`, and dependency warnings); these are outside Phase 3B.

## Portal header deduplication

- [x] Confirm that `PortalLayout` supplies the active page title and description in its sticky main header.
- [x] Remove duplicate page-content titles and descriptions from Lab Schedule, Requests, Equipment, Reports, Manage Accounts, Academic Directory, Academic Period, and Audit Logs.
- [x] Keep page identity in the PortalLayout header; use the always-visible ribbon action slot for page actions where a ribbon exists, and retain the contextual selected-entity heading in Academic Directory.
- [x] Run the frontend production build, `git diff --check`, and a targeted search for the removed duplicate headings and descriptions.

**Gate:** The shared portal header is the only page-level title/description on the eight listed pages; page actions remain available in the ribbon action slot where applicable, and contextual headings remain available; the frontend build and diff checks pass.

**Verification notes (25 September 2026):**
- `PortalLayout` derives the current admin page title and description from the active navigation item and renders them in the sticky main header.
- Removed the repeated page-content title/description blocks from the eight listed pages. Requests no longer has an empty title-only header. This follow-up changes the position of actions recorded in earlier phase notes: ribbon-page actions now use the ribbon's always-visible action slot.
- Academic Directory's selected entity title and description remain because they identify the active tab's content rather than repeat the overall page heading.
- `cd frontend && npm run build` passes. `git diff --check` and the targeted duplicate-heading/description search pass. Vite reports the pre-existing large-chunk advisory.

## Page actions in the ribbon

- [x] Move Lab Schedule, Equipment, Manage Accounts, and Academic Directory Add actions into their existing ribbon action slots.
- [x] Move Equipment export, Reports print/export, and Audit Logs refresh actions into the same always-visible ribbon action area.
- [x] Keep actions usable while the ribbon control body is collapsed and wrap the action area at mobile widths.
- [x] Leave Academic Period Refresh with its settings content because that page intentionally has no control ribbon; Requests has no page-header action.

**Gate:** Page actions appear in the ribbon bar without being hidden by its disclosure. Mobile ribbon headers wrap without page-level horizontal overflow. Academic Period remains outside the ribbon.

**Verification notes (25 September 2026):**
- Existing `ControlRibbon.actions`, `FilterToolbar.primaryAction`, and collapsible `CompactFilterPanel.actions` provide the action area. Add, export, print, and audit refresh buttons now use that area on pages with ribbons.
- `AdminRequests` has no page-header action to relocate. `AdminAcademicPeriod` remains a settings-only page and its Refresh action stays with the settings content rather than introducing an action-only ribbon.
- Mobile ribbon bars wrap the title/summary and action row so grouped page actions and the collapse toggle remain usable at narrow widths.

## Follow-up — shared sticky ribbon shell

- [x] Apply sticky positioning to every page-level shared ribbon below the persistent `PortalLayout` header; nested secondary filter panels remain in normal flow.
- [x] Keep each sticky ribbon's bar, actions, summary, and expanded controls together.
- [x] Preserve filter state, API behavior, responsive wrapping, spacing, and control sizes in this pass.
- [ ] Verify a representative long page at desktop and mobile widths, including scrolling past the original ribbon position.
- [x] Run the frontend production build and `git diff --check`.

**Gate:** The implementation and production build are complete. The runtime scroll check is blocked until an authenticated browser session is available; record this blocker rather than treating the gate as visually passed.

**Later scope:** Reduce ribbon height, padding, and control sizing only in a separate space-optimization pass.

**Verification notes (25 September 2026):**
- The top-level shared ribbon instances in Admin Reports, Equipment, Lab Schedule, Requests, Academic Directory, Audit Logs, Manage Accounts, and the Faculty and Student schedule explorers use sticky positioning. Nested filter panels remain non-sticky.
- `cd frontend && npm run build` and `git diff --check` pass. Control dimensions and filter/API behavior were not changed. Sticky positioning is reset for print output.
- Runtime scrolling could not be checked: the 1280px `/admin/schedule` preview redirected to the public landing page because the browser had no authenticated admin session. The 390px check is likewise blocked.

## Phase 4 — Responsive and accessibility review

Run the six scoped review tasks below serially. Each task covers only its listed pages; do not load or recheck other pages. These are review-only tasks: record any issue that needs code changes (page, viewport, reproduction steps, observed result) for separate follow-up instead of expanding the review.

### Shared checks for each review task

For each assigned page, use representative widths of 1280px (desktop), 1024px (tablet), and 390px (mobile). Record each applicable item as pass, fail, or blocked; explain items that do not apply. Include reproduction details for failures and the missing prerequisite for blocked checks. Checkboxes show whether a check was performed; they do not mean it passed.

- [ ] No unintended horizontal overflow; tables and tab rows scroll only within their intended containers.
- [ ] Long tab labels/counts remain usable, and keyboard focus stays visible while tabs scroll.
- [ ] Keyboard operation, selected state, `tablist`/`tab`/`tabpanel` relationships, and disclosure state are correct.
- [ ] The whole-ribbon toggle works at all three widths; its collapsed summary stays accurate and accessible.
- [ ] Ribbon group labels and separators do not create unnecessary nested cards or obscure the page header.
- [ ] Dropdowns have labels, visible focus, usable touch targets, and working keyboard operation.
- [ ] Applicable advanced-filter, error, and empty states remain usable and accessible.
- [ ] Exercise the assigned page's interaction-matrix row in the implementation plan; record a pass/fail/blocked result.

### Phase 4A — Admin Reports

- [x] Review only `AdminReports` using the shared checks above.
- [x] Exercise report-tab switching and date-range changes; confirm the active range and report panel agree.
- [x] Record all applicable results in the implementation plan's interaction matrix.
- [ ] Save `CP4A — Reports review complete`.

**Gate:** Every applicable Reports check and its interaction-matrix row has a pass/fail/blocked result; failures have reproduction details and blockers name the missing prerequisite.

**Phase 4A verification notes (25 September 2026):**

- **Shared-check outcomes:** page overflow **fail at 390px / pass at 1024px and 1280px**; tabs and visible focus while navigating **pass**; tab and panel semantics, keyboard operation, and disclosure state **pass**; whole-ribbon toggle and summary **pass at all three widths**; header separation, labeled control groups, and restrained separators **pass**; labeled native academic-period selects, keyboard operation, visible focus styling, and 40px controls **pass**; advanced-filter and tested empty states **pass**; date-error announcement **fail**. The Reports interaction-matrix row is **FAIL overall** (tab/date interactions passed, but the responsive and error-announcement checks failed); its result is recorded in the implementation plan.
- **Responsive — fail at 390px; pass at 1024px and 1280px.** At 390px, the document scroll width reaches 573px while the viewport is 390px. The category tabs have their own horizontal scroller, but they also produce a second page-level horizontal overflow. Temporarily hiding the tab group in the test browser removed that document overflow; the tab row is the reproduction area. Tables/other content should still be checked in the future fix. No document-level overflow was measured at 1024px or 1280px.
- **Tabs — pass.** The four category tabs expose one labeled `tablist`; each tab's `aria-controls` resolves to the report panel, whose `aria-labelledby` matches the selected tab. Clicking Requests updates the selected panel and `reportTab=requests`. ArrowRight, Home, and End changed selection and focus correctly at narrow width; the focused tab scrolled into view. ArrowRight was also checked at tablet and desktop widths.
- **Date range and ribbon — pass.** Applying 1–25 September 2026 updated the date inputs, URL, and ribbon summary. Collapsing at 390px, 1024px, and 1280px set `aria-expanded=false`, hid the controlled content, and retained the date range and selected category in the summary. Expanding restored the same date values. Clear returned the range to “All recorded dates.”
- **Academic period controls — pass.** The Change disclosure controls its panel; the visible year and term selects have labels, use native select controls, and respond to ArrowDown/ArrowUp. The ribbon buttons, date inputs, and visible selects measured 40px high.
- **Advanced and empty states — pass.** On the Requests report tab, More filters expanded and exposed its controlled panel. The inner disclosure remained expanded when the outer ribbon was collapsed. A future date range rendered “Showing 0 of 0 requests” without a reporting-data error.
- **Date error announcement — fail.** Reversed dates displayed “The start date must be before the end date,” but neither that message nor its ancestors exposed `role=alert` or `aria-live`, so the dynamic error has no live announcement for assistive technology.
- **Checkpoint:** Replit manages checkpoints automatically and does not support assigning a custom `CP4A` label; the suggested label remains unchecked. The review results are now recorded in the implementation plan's Reports interaction-matrix section. The page-wide mobile overflow and error-announcement findings remain open for their separate fixes.

### Phase 4B — Admin Equipment and Lab Schedule

- [x] **4B.1 — AdminEquipment responsive review:** Review only `AdminEquipment` at 1280px, 1024px, and 390px using the shared checks above.
- [x] **4B.2 — AdminEquipment interaction review:** Exercise view switching, search, filters, ribbon disclosure, and any applicable empty/error states; confirm the selected view and results stay in sync.
- [x] **4B.3 — AdminLabSchedule responsive review:** Review only `AdminLabSchedule` at 1280px, 1024px, and 390px using the shared checks above.
- [x] **4B.4 — AdminLabSchedule interaction review:** Exercise view switching, search, filters, ribbon disclosure, and any applicable empty/error states; confirm the selected view and schedule results stay in sync.
- [x] **4B.5 — 4B record and gate:** Record both pages' applicable results in the interaction matrix and document failures/blockers with reproduction details; checkpoint status is recorded below.

**Gate:** Both pages' checks and interaction-matrix rows have pass/fail/blocked results; failures are described and blockers name the missing prerequisite.

**Phase 4B.1 verification notes (25 September 2026):**

- **Overall: BLOCKED/FAIL.** The authenticated visual review could not run because the preview session had no admin authentication; `/admin/equipment` redirected to the landing page at the available 1280px preview. The missing prerequisite is an authenticated admin browser session, so the 1280px, 1024px, and 390px runtime outcomes remain blocked.
- **Static responsive review: PASS for containment structure.** The ribbon summary wraps below 640px, the academic-period and primary filter groups collapse to one column on narrow screens, the view tabs use an intended horizontal scroller, the inventory table scrolls inside its table container, and the usage calendar scrolls inside its own 720px minimum-width container.
- **Responsive touch-target failure identified.** In the Usage Calendar view, the equipment `<select>` and the `Today`/previous/next controls use padding-only sizing rather than the shared 40px minimum target. Record the page and control locations for a separate fix; do not expand this review-only subtask into code changes.
- **Focused source checks:** labels exist for the academic-period and calendar equipment selects; the view tabs expose `tablist`/`tab` semantics and visible focus classes; the ribbon and advanced academic-period disclosures expose `aria-expanded` and `aria-controls`.

**Phase 4B.2 verification notes (25 September 2026):**

- **Overall: BLOCKED for browser interaction, PASS for source/API interaction paths.** The authenticated browser session prerequisite is still unavailable, so clicks and rendered state changes could not be replayed in the UI. The available preview continues to redirect protected routes to the landing page.
- **Source-level state review: PASS.** View switching is represented by `viewMode` and synchronized to the `tab` URL parameter; search, status, and low-stock filters update shared filter state and URL parameters; reset and individual active-filter removal clear only their corresponding state; the whole-ribbon and advanced-filter disclosures have independent controlled state; and the empty state renders when the filtered result set is empty.
- **Development API checks: PASS.** With an authenticated seeded admin request, the equipment, status, search, low-stock, stats, and academic-period endpoints returned successful responses. Status-filtered rows matched their requested status; the search result matched “projector”; the no-match query returned zero rows for the empty-state path; and low-stock rows matched the server predicate.
- **Runtime blocker:** Reproduction is to open `/admin/equipment` in the current preview without an authenticated admin browser session; the route redirects to `/`. Missing prerequisite: an authenticated admin browser session for post-render view, filter, disclosure, and result-sync checks.

**Phase 4B.3 verification notes (25 September 2026):**

- **Overall: BLOCKED/FAIL.** The authenticated visual review could not run because the preview session had no admin authentication; `/admin/schedule` redirected to the landing page at the available 1280px preview. The missing prerequisite is an authenticated admin browser session, so the 1280px, 1024px, and 390px runtime outcomes remain blocked.
- **Static responsive review: PASS for primary containment.** The ribbon filter groups collapse to one column on narrow screens, advanced filters use responsive one-/two-/four-column layouts, the view tabs use an intended horizontal scroller, the schedule table scrolls inside its table container, the Chart View scrolls inside its 700px minimum-width container, and the Calendar View keeps its seven-column grid within the page width.
- **Responsive touch-target failure identified.** Chart View's lab selector and Calendar View's `Today`/previous/next controls use padding-only sizing rather than the shared 40px minimum target. Record these controls for a separate fix; do not expand this review-only subtask into code changes.
- **Accessibility labeling failure identified.** Chart View's `Lab` label is not associated with its `<select>` through `htmlFor`/`id` or an explicit `aria-label`. The other ribbon filters use labeled `FilterItem` wrappers and the compact academic-period controls expose labels.
- **Source checks:** the ribbon and advanced-filter disclosures expose matching `aria-expanded`/`aria-controls`; the three view tabs use a linked `tablist`/`tabpanel` relationship with visible focus styles. Runtime focus and overflow measurements remain blocked by the missing authenticated session.

**Phase 4B.4 verification notes (25 September 2026):**

- **Overall: BLOCKED for browser interaction, PASS for source/API interaction paths.** The authenticated browser session prerequisite is still unavailable, so rendered view switching, filter changes, disclosure toggles, and post-update result assertions could not be replayed in the UI. The available preview redirects `/admin/schedule` to the landing page.
- **Source-level state review: PASS.** `viewMode` synchronizes with the `tab` URL parameter; search, date, academic-period, source, schedule-type, room, program, and faculty state synchronize to URL parameters; advanced-filter disclosure is independently controlled; reset clears filters and returns to the table view; active-filter chips remove only their own filter; and loading/error/empty result branches are present.
- **Development API and predicate checks: PASS.** Authenticated seeded-admin requests returned 25 schedules and all required resource collections. Client-side source/type/search predicates produced matching subsets, and an impossible search term produced zero rows for the empty-state path.
- **Runtime blocker:** Reproduction is to open `/admin/schedule` in the current preview without an authenticated admin browser session; the route redirects to `/`. Missing prerequisite: an authenticated admin browser session for post-render view, filter, disclosure, and result-sync checks.

**Phase 4B gate result (25 September 2026):**

- **Parent gate: COMPLETE as a review record; overall outcome FAIL/BLOCKED.** Both assigned pages have recorded results, and no page-by-page checks were repeated during consolidation.
- **Interaction-matrix status:** `AdminEquipment` responsive = **FAIL**; `AdminEquipment` interactions = **BLOCKED**; `AdminLabSchedule` responsive = **FAIL**; `AdminLabSchedule` interactions = **BLOCKED**.
- **Carried findings:** Equipment Usage Calendar touch targets; AdminLabSchedule Chart/Calendar touch targets; AdminLabSchedule Chart View lab-label association; and the missing authenticated admin browser prerequisite. Each is documented above with its reproduction context.
- **Checkpoint:** The suggested `CP4B` label is not manually saved here; Replit manages checkpoints automatically, and this record must not be interpreted as a passed quality gate.

### Phase 4C — Admin Requests and Academic Directory

- [x] **4C.1 — AdminRequests responsive review:** Review only `AdminRequests` at 1280px, 1024px, and 390px using the shared checks above.
- [x] **4C.2 — AdminRequests interaction review:** Exercise every status filter, advanced-filter open/close, reset, counts, results, whole-ribbon disclosure, and applicable empty/error states.
- [x] **4C.3 — AdminRequests captures:** Capture the Requests page at 1280px and 390px, including the control ribbon and main results area.
- [x] **4C.4 — AdminAcademicDirectory responsive review:** Review only `AdminAcademicDirectory` at 1280px, 1024px, and 390px using the shared checks above.
- [x] **4C.5 — AdminAcademicDirectory interaction review:** Switch every directory entity tab, verify its matching panel and keyboard behavior, and confirm summary counts remain secondary.
- [x] **4C.6 — 4C record and gate:** Record both pages' applicable results in the interaction matrix, document failures/blockers with reproduction details, and record the checkpoint status for `CP4C — Requests and directory review complete`.

**Gate:** COMPLETE as a review record; overall outcome FAIL. Both pages' checks and interaction-matrix rows have pass/fail/blocked results, failures are described, the two required Requests captures exist, and no runtime blockers remain.

**Phase 4C.1 verification notes (25 September 2026):**

- **Overall: PASS for the 4C.1 responsive review.** `AdminRequests` was reviewed in an authenticated seeded-admin development session at 1280px, 1024px, and 390px. Runtime checks were completed at all three widths; the unauthenticated shared preview still redirects protected routes to `/`, so the authenticated review used a separate local browser session.
- **Responsive containment — PASS at all three widths.** The document and body scroll widths matched the viewport at 1280px, 1024px, and 390px. The status-control group reflowed from six columns on desktop to three columns at tablet width and one column on mobile. Search and date controls also reflowed to a single column at 390px. No page-level horizontal overflow was observed; the request table remains inside its `TableContainer` overflow region.
- **Labels, grouping, and focus treatment — PASS by runtime/source review.** The page header remains outside the ribbon. Status controls are in a labeled `Request status filters` group and expose `aria-pressed` plus count-bearing accessible names. Search, date, academic-period, and advanced filter controls remain in labeled groups. Shared ribbon focus styles and 40px minimum control sizing apply to the visible toggle, inputs, selects, and disclosure buttons.
- **Ribbon semantics — PASS.** The whole-ribbon toggle remained visible at each width with matching `aria-expanded` and `aria-controls` values, and the controlled ribbon content had the referenced stable ID. The collapsed summary is present in the ribbon bar and is allowed to wrap at mobile width. The advanced-filter and academic-period disclosures have their own matching control/panel relationships in source.
- **Long labels and dropdowns — PASS for the responsive scope.** Status labels and counts fit within the reflowed cards without clipping or page overflow. Native academic-period and advanced-filter selects have visible text labels and 40px styling when their disclosures are open; their keyboard behavior is deferred to the 4C.2 interaction review.
- **Deferred scope:** Status transitions, advanced-filter open/close, reset, result/count synchronization, empty/error states, and the required 1280px/390px captures remain for 4C.2 and 4C.3. No failure or code-change request was created from 4C.1.

**Phase 4C.2 verification notes (25 September 2026):**

- **Overall: FAIL.** The authenticated seeded-admin development session exercised every AdminRequests interaction listed for 4C.2. Status filtering, advanced-filter disclosure, reset, result/count synchronization, whole-ribbon disclosure, and the tested empty state passed. The applicable reversed-date error state rendered its message but failed the live-announcement check.
- **Status filters and counts — PASS.** All requests, Pending, Approved, Borrowed, Returned, Declined, and Cancelled each became the selected `aria-pressed` filter. The result totals matched the status-card counts: 26, 5, 5, 4, 4, 4, and 4 respectively, and every visible result row matched the selected status for the filtered cases.
- **Advanced filters and reset — PASS.** “More filters” opened and closed its controlled panel with matching `aria-expanded`/`aria-controls` state. Reset filters returned the selected status to All requests, cleared the active filter state, and restored the 26-request result summary.
- **Whole-ribbon disclosure — PASS.** At 390px, collapsing the ribbon set its toggle to `aria-expanded="false"`, hid the controlled content, and retained the Pending selection and summary. Expanding restored the controls without losing that state. The inner advanced-filter disclosure remained independently closed.
- **Empty state — PASS.** Searching for `zzzz-no-match-4c2` rendered “No requests found,” removed the table rows, and updated the ribbon summary to show zero matching requests. Clearing the search restored the normal results path.
- **Error-state accessibility — FAIL.** Setting From date to `2099-12-31` and To date to `2020-01-01` displayed “The from date cannot be later than the to date.”, but the message and its ancestors exposed neither `role="alert"` nor `aria-live`. Reproduction: open `/admin/requests`, enter the reversed date range, and inspect the rendered error message. Record as a separate accessibility fix; do not expand this review-only item into code changes.
- **Deferred scope:** The 4C.3 captures and all Academic Directory review items remain unchecked. No request mutation actions were invoked.

**Phase 4C.3 verification notes (25 September 2026):**

- **Overall: PASS.** Captures were taken from an authenticated seeded-admin development session with the Requests page in its default All requests state. Both captures include the page header, control ribbon, and main results area.
- **Desktop capture:** `screenshots/phase-4c-admin-requests-1280.jpg` — 1280×1100 full-page capture.
- **Mobile capture:** `screenshots/phase-4c-admin-requests-390.jpg` — 390×1600 full-page capture showing the wrapped ribbon controls and the beginning of the horizontally contained results table.
- **Scope boundary:** No Academic Directory review work, error-state fix, or other application-code change was included.

**Phase 4C.4 verification notes (25 September 2026):**

- **Overall: FAIL.** The authenticated seeded-admin development session reviewed `AdminAcademicDirectory` at 1280px, 1024px, and 390px. Desktop and tablet containment passed; the mobile check found document-level horizontal overflow from the entity tab row.
- **Responsive containment — PASS at 1280px and 1024px; FAIL at 390px.** At 1280px and 1024px, document and body scroll widths matched the viewport. At 390px, the document scroll width reached 528px while the viewport was 390px. The tablist has an intended internal scroller (`clientWidth` 326px, `scrollWidth` 578px), but the offscreen `Subjects`/`Departments` tab content still extends the page-level scroll area; the farthest tab reached approximately x=591px. Reproduction: open `/admin/academic-directory` at 390px and scroll the page horizontally. This is a separate responsive fix; do not expand this review-only item into code changes.
- **Tabs and focus structure — PASS by runtime/source review, interaction deferred.** The entity tablist is labeled `Academic directory entities`; tabs use 40px controls, `aria-selected`, `aria-controls`, roving `tabIndex`, and visible focus styles. The initial Buildings tab was linked to `academic-directory-tabpanel`, whose `aria-labelledby` matched the active tab. Switching every entity and exercising Arrow/Home/End remains 4C.5 scope.
- **Ribbon and page hierarchy — PASS.** The page header and context-sensitive Add action remain outside the ribbon. The Directory filters ribbon was present at all three widths with a visible 40px toggle, matching `aria-expanded`/`aria-controls`, and the labeled `Directory search and filters` group. The collapsed summary and ribbon interaction remain outside this responsive-only item.
- **Summary and table containment — PASS for the tested default Buildings view.** Summary counts wrapped into a two-column grid at 390px and five columns at wider widths without page-level overflow. The table container stayed within the content width and retained `overflow-x: auto`.
- **Dropdowns and states — PASS by source review; interaction deferred.** The Buildings filter is labeled and uses the native select path with visible focus styling and a 40px compact-ribbon target when opened. Advanced-filter, entity-switching, empty/error-state, and keyboard interaction checks remain 4C.5 scope.
- **Scope boundary:** No code change, entity-tab switch, or 4C.5 interaction review was performed.

**Phase 4C.5 verification notes (25 September 2026):**

- **Overall: PASS.** An authenticated seeded-admin development browser session exercised all five entity tabs: Buildings, Rooms, Programs, Subjects, and Departments.
- **Tab/panel synchronization: PASS.** Each click selected the requested tab, rendered the matching panel heading, kept the tab's `aria-controls` pointed at `academic-directory-tabpanel`, and updated the panel's `aria-labelledby` to the selected tab ID.
- **Keyboard behavior: PASS.** At the narrow 390px device viewport, ArrowRight wrapped from Departments to Buildings; Home selected Buildings; End selected Departments. Focus followed selection and each resulting panel matched its selected tab.
- **Summary counts: PASS.** The five count summaries remain a separate, non-interactive list after the entity tabs and before the tab panel; their compact white rows and small labels/counts remain visually secondary to the selected tab.
- **Scope boundary:** No directory records were changed, and no application-code changes or 4C.6 consolidation/checkpoint work were performed.

**Phase 4C.6 verification notes (25 September 2026):**

- **Parent gate: COMPLETE as a review record; overall outcome FAIL.** The 4C.1–4C.5 records cover both assigned pages. No page-by-page checks were repeated during consolidation.
- **Interaction-matrix status:**

  | Page | Responsive row | Interaction row |
  |---|---|---|
  | `AdminRequests` | **PASS** | **FAIL** |
  | `AdminAcademicDirectory` | **FAIL** | **PASS** |

- **Carried findings:** Requests date-range validation errors are not announced to assistive technology (reproduction is recorded in 4C.2); the Academic Directory entity tabs cause page-level horizontal overflow at 390px (reproduction is recorded in 4C.4). These findings remain unresolved and are not reported as passes.
- **Blockers and captures:** No checks were blocked for lack of an authenticated admin session. Both required Requests captures exist: `screenshots/phase-4c-admin-requests-1280.jpg` and `screenshots/phase-4c-admin-requests-390.jpg`.
- **Checkpoint:** Replit manages checkpoints automatically; no manually named `CP4C` checkpoint is claimed. This review record has failed rows and is not an overall quality pass.
- **Scope boundary:** Consolidation only; no page checks were repeated and no application-code changes were made.

### Phase 4D — Admin supporting pages

- [x] **4D.1 — AdminAuditLogs review:** Review only `AdminAuditLogs` at 1280px, 1024px, and 390px; exercise search, action/entity/date filters, ribbon disclosure, refresh, and applicable empty/error states.
- [ ] **4D.2 — AdminAcademicPeriod review:** Review only `AdminAcademicPeriod` at 1280px, 1024px, and 390px; exercise refresh and settings/edit controls, confirming settings remain outside the ribbon.
- [ ] **4D.3 — ManageAccounts review:** Review only `ManageAccounts` at 1280px, 1024px, and 390px; exercise search/filters and confirm the account table scrolls independently.
- [ ] **4D.4 — 4D record and gate:** Record all three pages' applicable results in the interaction matrix, document failures/blockers with reproduction details, and save `CP4D — Admin supporting-pages review complete`.

**Gate:** All three pages' checks and interaction-matrix rows have pass/fail/blocked results; failures are described and blockers name the missing prerequisite.

**Phase 4D.1 verification notes (25 September 2026):**

- **Overall: FAIL/BLOCKED.** The authenticated seeded-admin review completed at 1280px, 1024px, and 390px. The page has no document-level horizontal overflow, but Reset filters is only 28px high. Data-dependent filter/result matching, table scrolling, and row details could not be verified because the development audit log returned no entries.
- **Responsive containment — PASS at all three widths.** Document and body widths matched the viewport at 1280px, 1024px, and 390px. Search remains 313px wide at 390px and the filters stack into one column. The audit table's internal scroll behavior is blocked because the empty state replaces the table.
- **Touch targets — FAIL for Reset filters.** Reproduction: open `/admin/audit-logs` with the ribbon expanded at 1280px, 1024px, or 390px and inspect Reset filters; its rendered height is 28px, below the 40px interactive target. The refresh action, ribbon toggle, search field, date inputs, and native selects are 40px high. Row-level View details sizing is blocked because no audit rows render.
- **Labels, focus, and dropdowns — PASS.** Search, Action, Entity type, From, and To have wrapping labels; the native Action select changes by ArrowDown and exposes a visible 2px focus outline. No tab group or advanced-filter disclosure applies to this page.
- **Ribbon — PASS at all three widths.** The whole-ribbon control's `aria-expanded` matched visibility and its `aria-controls` resolved to the hidden/shown panel. With a search and action filter active, collapsing retained both values and the “Search and filters active” summary; expanding restored the controls without clearing state.
- **Search, filters, and refresh — PARTIAL/BLOCKED.** Search, action, entity, and date controls changed state and invoked the audit-log query path; the refresh button remained in the page header outside the ribbon and completed without an error. The development endpoint returned zero logs for the default, broad-date, and filtered views, so matching/non-matching result synchronization could not be established.
- **Empty/error states — PASS where observable.** The default empty state remains contained. A reversed range (`From` 2099-12-31; `To` 2020-01-01) displayed “The from date must be before the to date.” inside `role="alert"`. A populated-to-empty transition could not be tested with the empty dataset.
- **Blocker:** At least one audit-log entry in the development database is required to verify filtered rows, table scrolling, and row details. No audit entries were created during this review.
- **Scope boundary:** No application code or audit data was changed; 4D.2 remains untouched.

### Phase 4E — Faculty schedule

- [ ] **4E.1 — Faculty responsive review:** Review only the Faculty schedule at 1280px, 1024px, and 390px using the shared checks above.
- [ ] **4E.2 — Faculty interaction review:** Exercise schedule-view switching, search, date/filter controls, ribbon disclosure, and applicable empty/error states; confirm portal navigation, requests, and details remain unchanged.
- [ ] **4E.3 — Faculty captures and gate:** Capture the Faculty schedule at 1280px and 390px, record its interaction-matrix row, document failures/blockers with reproduction details, and save `CP4E — Faculty review complete`.

**Gate:** Faculty checks and its interaction-matrix row have pass/fail/blocked results; failures are described, the two required captures exist, and blockers name the missing prerequisite.

### Phase 4F — Student schedule

- [ ] **4F.1 — Student responsive review:** Review only the Student schedule at 1280px, 1024px, and 390px using the shared checks above.
- [ ] **4F.2 — Student interaction review:** Exercise schedule-view switching, search, date/filter controls, ribbon disclosure, and applicable empty/error states; confirm portal navigation, requests, and details remain unchanged.
- [ ] **4F.3 — Student captures and gate:** Capture the Student schedule at 1280px and 390px, record its interaction-matrix row, document failures/blockers with reproduction details, and save `CP4F — Student review complete`.

**Gate:** Student checks and its interaction-matrix row have pass/fail/blocked results; failures are described, the two required captures exist, and blockers name the missing prerequisite.

### Phase 4 — Consolidate review results

- [ ] Confirm Phases 4A–4F each have a recorded gate result.
- [ ] Confirm every interaction-matrix row has a pass/fail/blocked result; failures and blockers are documented.
- [ ] Do not repeat completed page-by-page checks during consolidation.
- [ ] Save `CP4 — Responsive and accessibility review complete`.

**Gate:** All six review tasks are recorded and the full interaction matrix has accurate pass/fail/blocked results.

## Phase 5 — Final verification

- [ ] Run `cd frontend && npm run build`.
- [ ] Run focused ESLint on every changed shared component.
- [ ] Run `git diff --check`.
- [ ] Start/restart the Backend API and Start application workflows as needed.
- [ ] Check workflow and browser logs for new import, CSS, runtime, or Fast Refresh errors.
- [ ] Confirm every interaction-matrix row has a pass/block result.
- [ ] Save `CP5 — Control-ribbon rollout verified`.

**Gate:** The final quality requirements in the implementation plan pass; failed or blocked checks from Phase 4 are not reported as passed.

## Execution order

Complete phases serially for the cleanest checkpoints. Phases 2A–2C and 3A–3B depend on Phase 1 and may run in parallel only with isolated edits that do not touch the same page files. After every page-adoption phase is complete, run review tasks 4A–4F serially, then consolidate Phase 4 before Phase 5. Do not save a checkpoint while unrelated in-progress edits are included in the workspace.