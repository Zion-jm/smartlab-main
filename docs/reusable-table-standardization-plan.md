> Historical review/proposal. See README.md and reproducible-verification.md for implemented status and current checks.

> Cleanup update, 2026-10-01: the unused ComputerLabReport.tsx was removed in step 18. Mentions below describe the historical inventory; active reports use ReportDetailViews.

> Status update, 2026-10-01: the controlled foundation, Audit Logs/personal-request migrations and shared schedule table are implemented. See reusable-tables-remediation.md for current evidence and remaining legacy consumers. Pagination descriptions below are historical; Audit Logs, requests and core admin lists now use server pages.

# Reusable Table Standardization Plan

## Purpose

SmartLab currently has several table implementations with overlapping behavior but inconsistent wrappers, spacing, sticky behavior, pagination, action cells, and responsive treatment.

This document defines a plan for standardizing the interactive screen tables without forcing print/export tables into the same component.

The goal is to create:

1. One consistent interactive table foundation.
2. Domain-specific table configurations for requests, schedules, accounts, equipment, audit logs, and reports.
3. A separate print/report table system for physical documents and exports.

No implementation changes are implied by this document alone.

---

## 1. Current table inventory

### Shared interactive table primitives

Relevant files:

- `frontend/src/components/shared/Table.tsx`
- `frontend/src/components/shared/TablePagination.tsx`
- `frontend/src/index.css`

Current shared primitives:

- `TableContainer`
- `Table`
- `TableHead`
- `TableHeaderCell`
- `TableBody`
- `TableRow`
- `TableCell`
- `TableTitleCell`
- `TableBadgeCell`
- `TableActionsCell`
- `TablePagination`

Current shared behavior:

- Horizontal scrolling through `TableContainer`.
- Sticky table headers by default.
- Shared cell padding, typography, colors, borders, and hover states.
- Responsive pagination controls.
- Sticky-bottom pagination while the table is active.
- Pagination state controlled by the containing page.

The primitives do not currently standardize:

- The outer panel/card.
- The relationship between a table and its navigator.
- Loading, error, and empty states.
- Column definitions.
- Responsive column behavior.
- Action-cell layout.
- Client versus server pagination.
- Table density and minimum width.
- Sticky scroll-root handling.
- Raw HTML table implementations.

---

## 2. Table families

### A. Operational admin tables

#### Requests

File: `frontend/src/pages/AdminRequests.tsx`

Purpose:

- Review and process equipment borrow requests.

Columns:

- Requester
- Room
- Equipment
- Date needed
- Status
- Actions

Behavior:

- Search and advanced filtering.
- URL-persisted filters.
- Client-side pagination.
- Requester cells open request details.
- Actions vary by request status.
- Full lifecycle actions are handled through a drawer.
- Loading, error, and empty states are supported.
- Shared table and pagination primitives are used.

This is the strongest reference for the standard operational table because it combines:

- A rounded white panel.
- A table.
- Pagination.
- Sticky pagination.
- Modal and drawer actions.
- Multiple data states.

#### Manage Accounts

File: `frontend/src/pages/ManageAccounts.tsx`

Purpose:

- Manage admin, faculty, and student accounts.

Columns:

- Role
- Name
- Email
- Department / Course
- Status
- Actions

Behavior:

- Search, role, and status filters.
- Client-side pagination.
- Page-level Add Account action.
- Row-level edit action.
- Create/edit drawer.
- Shared loading, error, and empty states.

Differences:

- Simpler row actions.
- Status-focused presentation.
- Additional horizontal overflow wrapper.
- Slightly different panel padding.

#### Equipment

File: `frontend/src/pages/AdminEquipment.tsx`

Purpose:

- Manage laboratory equipment inventory.

Columns:

- Equipment
- Available
- Borrowed
- Damaged
- Status
- Actions

Behavior:

- Search and status filters.
- Low-stock filtering.
- Client-side pagination.
- Edit and archive actions.
- Quantity-specific visual emphasis.
- Separate calendar/usage view.
- Summary cards above the table.

Domain-specific requirements:

- Numeric inventory columns need consistent alignment.
- Availability and quantity states need special formatting.
- Archive behavior must remain separate from table rendering.

#### Academic Directory

File: `frontend/src/pages/AdminAcademicDirectory.tsx`

Purpose:

- Manage buildings, rooms, programs, subjects, and departments.

Table schemas:

- Buildings: Name, Rooms, Actions.
- Rooms: Room No., Name, Building, Type, Actions.
- Programs: Code, Name, Actions.
- Subjects: Code, Name, Actions.
- Departments: Name, Actions.

Behavior:

- One page with multiple tabs.
- Different columns per tab.
- Contextual Add action.
- Edit drawer.
- Search and tab-specific filtering.
- Client-side filtering and pagination.

This page is a strong candidate for column configuration instead of separate table markup per tab.

#### Audit Logs

File: `frontend/src/pages/AdminAuditLogs.tsx`

Purpose:

- Display administrator activity history.

Columns:

- Actor
- Action
- Entity
- Date / time
- Summary
- Details

Behavior:

- Server-side pagination.
- Server-side filtering and search.
- Details modal.
- Horizontal scrolling.
- Raw HTML table rather than the shared table primitives.

This should use the interactive table foundation while preserving server-side pagination and read-only detail behavior.

---

### B. Schedule tables

#### Admin schedule

File: `frontend/src/pages/AdminLabSchedule.tsx`

Columns:

- Source
- Date & Time
- Room
- Subject
- Program
- Faculty
- Actions

Behavior:

- Search and advanced filters.
- Date range and academic period filters.
- Source, schedule type, room, program, and faculty filters.
- Client-side pagination.
- View and edit actions.
- Chart and calendar alternatives.
- Sticky table header.
- Sticky pagination.

The admin version has more controls and actions than the faculty and student versions.

#### Faculty schedule

File: `frontend/src/pages/FacultyPanel.tsx`

Columns:

- Date & Time
- Room
- Subject
- Program
- Faculty
- Academic Context

Behavior:

- Search and date filtering.
- No pagination.
- Read-only browsing.
- Table, chart, and calendar views.
- Shared table primitives.

#### Student schedule

File: `frontend/src/pages/StudentPanel.tsx`

The student schedule table is effectively the same structure as the faculty schedule table.

This duplication should be removed through a shared `ScheduleTable` configuration or component.

#### Faculty and student personal requests

Files:

- `frontend/src/pages/FacultyPanel.tsx`
- `frontend/src/pages/StudentPanel.tsx`

Columns:

- Reference
- Room
- Equipment
- Date of use
- Status
- Actions

Behavior:

- Local filtering.
- No pagination.
- Pending requests can be edited or cancelled.
- Raw HTML tables.
- No sticky header.
- No shared table wrapper.

These should use the common interactive foundation while remaining a separate domain configuration from the admin borrow-request table.

---

### C. Report tables

#### Interactive report tables

File: `frontend/src/components/admin/ReportDetailViews.tsx`

Report table types include:

- Request report table.
- Schedule report table.
- Equipment report table.
- Equipment usage table.

Behavior:

- Report-specific filters.
- Analytical summary panels.
- Client-side pagination.
- Wide minimum table widths.
- Multi-line cells.
- Badges and secondary text.
- Shared table primitives.
- Export controls outside the table.

These should use the shared screen-table foundation with report-specific widths and density.

#### Computer lab report

File: `frontend/src/components/admin/ComputerLabReport.tsx`

This is a compact dashboard table with:

- Summary cards.
- Room-usage bars.
- A non-paginated compact table.
- Export data that differs from the visible columns.

It should share table cells and visual tokens where practical, but should not be forced into the full operational-table layout.

#### Printable report tables

Files:

- `frontend/src/components/admin/PrintableReportDocument.tsx`
- `frontend/src/styles/reportDocumentStyles.css`

These must remain separate from interactive screen tables.

Print tables require:

- Fixed physical page sizes.
- Print-specific widths.
- Repeated headers.
- Measured page breaks.
- Formal report headers and footers.
- Different columns from screen tables.
- No interactive actions.
- No sticky behavior.
- No screen pagination.

Data normalization and column metadata may be shared, but the rendered print component should remain separate.

---

## 3. Main inconsistencies to solve

### Different outer containers

Current tables use several patterns:

- Page-level white section containing the table.
- Table container with its own border and shadow.
- Raw `overflow-x-auto` wrapper.
- Report-specific rounded wrappers.
- No visible panel.

The final standard should use one clear ownership model:

```text
TablePanel
├── optional table toolbar
├── TableViewport
│   └── semantic table
└── optional TablePagination
```

Page filters and page-level actions should remain outside the table panel unless a page explicitly needs an embedded table toolbar.

### Inconsistent sticky behavior

Current behavior:

- Shared `TableContainer` supports sticky headers.
- Raw HTML tables do not.
- Pagination depends on its relationship to the table container.
- `TableContainer` hides vertical overflow by default.
- Sticky behavior depends on the portal content scroll container.
- Some pages add nested horizontal overflow wrappers.

Recommended default scroll contract:

- The portal content area remains the vertical scroll container.
- The table viewport handles horizontal scrolling.
- The header sticks to the page scroll viewport.
- The navigator sticks to the bottom of the page viewport while the table is active.
- No table-specific vertical scroll container by default.

An optional local-scroll mode can be added for dense reports, but it should require an explicit maximum height and scroll-root configuration.

### Mixed pagination modes

Current pages use:

- Client-side pagination.
- Server-side pagination.
- No pagination.
- Report-specific pagination.
- Page resets after filter changes.
- Server totals separate from visible client data.

The reusable component should support controlled pagination without owning data fetching.

Recommended pagination contract:

```ts
type TablePaginationMode = 'none' | 'client' | 'server';

type TablePaginationState = {
  page: number;
  pageSize: number;
  totalItems: number;
};
```

The table component should render controls and emit changes. The page should remain responsible for:

- Fetching data.
- Slicing client-side data.
- Resetting the page after filter changes.
- Handling server totals.

### Raw HTML tables bypass the design system

Interactive raw tables currently exist in:

- `AdminAuditLogs.tsx`
- Faculty personal requests.
- Student personal requests.
- Faculty and student report-like sections.
- `ComputerLabReport.tsx`.

These should be migrated to the interactive screen-table foundation.

Printable tables should remain separate.

### Inconsistent action patterns

Current action patterns include:

- `IconActionButton`.
- `TableActionGroup`.
- Inline buttons.
- Clickable cells.
- Page-level primary actions.
- Detail modals.
- Detail drawers.

The table should provide:

- An actions column.
- Alignment rules.
- A slot for page-specific action content.
- Consistent keyboard and accessible-label requirements.

It should not own business actions or mutations.

---

## 4. Proposed reusable design

### Layer 1: Table primitives

Keep and improve the existing primitives:

- `Table`
- `TableHead`
- `TableHeaderCell`
- `TableBody`
- `TableRow`
- `TableCell`

Responsibilities:

- Semantic markup.
- Typography.
- Spacing.
- Borders.
- Hover states.
- Alignment.

These primitives should not own fetching, pagination, modals, or domain-specific actions.

### Layer 2: Table panel

Introduce a consistent visual wrapper:

```tsx
<TablePanel>
  {toolbar}
  <TableViewport>
    <DataTable />
  </TableViewport>
  {pagination}
</TablePanel>
```

Visual specification:

- White background.
- `#e5e7eb` border.
- `16px` rounded corners.
- Subtle shadow.
- Pagination inside the same visual panel.
- No `overflow-hidden` on the outer panel, so sticky pagination continues to work.
- Horizontal overflow owned by the table viewport.
- Consistent responsive padding.

### Layer 3: Configurable interactive table

Recommended column contract:

```ts
type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  minWidth?: string;
  hideAt?: 'sm' | 'md' | 'lg';
  headerClassName?: string;
  cellClassName?: string;
};
```

Recommended table contract:

```ts
type DataTableProps<T> = {
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  emptyState?: ReactNode;
  stickyHeader?: boolean;
  pagination?: TablePaginationState;
  paginationMode?: 'none' | 'client' | 'server';
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  minWidth?: string;
  density?: 'comfortable' | 'compact';
  rowClassName?: (row: T) => string;
};
```

Important rule:

The table should be controlled. It should not fetch data, open drawers, mutate records, or own filters.

Pages should provide those behaviors through:

- Column renderers.
- Action slots.
- Parent-level state.
- Existing API services and handlers.

---

## 5. Final visual design

### Panel

- White background.
- `1px` `#e5e7eb` border.
- `16px` rounded corners.
- Subtle shadow.
- Table and navigator visually contained in the same panel.

### Header

- White background.
- Sticky when enabled.
- Small semibold gray labels.
- Consistent horizontal padding.
- Bottom border or subtle shadow.
- Uppercase labels only when appropriate; do not force uppercase on report tables.

### Body

- `13px` default screen-table text.
- `12px` compact report-table text.
- Approximately `12px` vertical cell padding.
- Light row dividers.
- Subtle gray hover state.
- No strong zebra striping by default.
- Primary values use dark gray.
- Supporting values use muted gray.
- Badges use shared semantic variants but remain domain-configurable.

### Actions

- Right-aligned by default.
- Fixed or minimum width.
- Consistent gap.
- Icon buttons for dense admin tables.
- Text actions when clarity requires a visible label.
- Accessible labels required for icon-only actions.

### Responsive behavior

Desktop:

- Full table width.
- Natural column sizing with explicit minimum widths where required.

Mobile:

- Preserve semantic table markup.
- Allow horizontal scrolling.
- Keep actions visible.
- Do not automatically convert every table into cards.
- Allow explicitly configured secondary columns to hide at small widths.
- Keep identity, status, date, and action information visible by default.

### Pagination

- Always inside the same `TablePanel`.
- Top border separates pagination from rows.
- White background.
- Sticky bottom behavior enabled when pagination exists.
- Full labels on larger screens.
- Abbreviated labels on mobile.
- Page changes do not automatically scroll users back to the table header.

---

## 6. Domain-specific configurations

### `AdminRequestTable`

- Status badges.
- Requester detail trigger.
- Status-dependent actions.
- Equipment quantity rendering.
- Client pagination.
- Optional server-backed totals.

### `AccountTable`

- Role and status badges.
- Edit action.
- Department/course secondary text.
- Client pagination.

### `EquipmentTable`

- Quantity alignment.
- Availability color states.
- Edit/archive actions.
- Compact numeric cells.

### `AcademicDirectoryTable`

- Configurable columns per tab.
- Shared edit action.
- Tab-specific empty states.
- Optional pagination.

### `AuditLogTable`

- Server-side pagination.
- Action/entity badges.
- Detail modal action.
- Truncated IDs and summaries.
- Read-only behavior.

### `ScheduleTable`

- Date/time cell renderer.
- Schedule type badge.
- Academic context secondary text.
- Admin action variant.
- Faculty/student read-only variant.
- Optional pagination.
- Shared across admin, faculty, and student panels.

### `PersonalRequestTable`

- Reference cell.
- Status badge.
- Pending-only edit/cancel actions.
- No pagination by default, but compatible with it.

### `ReportTable`

- Compact density.
- Explicit minimum width.
- Multi-line cells.
- Report-specific filters and export controls outside the table.
- Optional pagination.

### `PrintableReportTable`

Keep separate from the interactive table component.

---

## 7. Recommended implementation order

### Phase 1: Finalize the contract

Before editing:

- Use the Requests page as the visual baseline.
- Confirm the panel background and spacing.
- Confirm sticky header behavior.
- Confirm sticky pagination behavior.
- Confirm page scrolling versus local table scrolling.
- Confirm mobile behavior.
- Confirm report-table density.

Recommended decisions:

- Requests page becomes the reference panel structure.
- Page-level vertical scrolling is the default.
- Wide tables use horizontal scrolling.
- Sticky header and sticky pagination are optional but enabled for paginated tables.
- Print tables remain separate.

### Phase 2: Strengthen shared primitives

Implement:

- Reusable `TablePanel`.
- Configurable `DataTable`.
- Standard loading, error, and empty slots.
- More robust sticky scroll-root handling.
- Preserved existing `Table` primitives for incremental migration.

### Phase 3: Migrate one reference page

Start with:

- `frontend/src/pages/AdminRequests.tsx`

This page already contains the strongest combination of panel, filters, actions, detail views, pagination, and sticky navigation.

### Phase 4: Migrate operational admin pages

Migrate:

1. `ManageAccounts.tsx`
2. `AdminEquipment.tsx`
3. `AdminAcademicDirectory.tsx`
4. `AdminAuditLogs.tsx`

Keep business behavior unchanged while replacing:

- Wrapper markup.
- Table rendering.
- Pagination rendering.
- Action-cell layout.
- Loading/error/empty presentation.

### Phase 5: Consolidate schedule tables

Create one shared schedule-table implementation for:

- Admin.
- Faculty.
- Student.

Expose role-specific options for:

- Admin actions.
- Pagination.
- Filter presentation.
- Read-only mode.
- Detail modal behavior.

This removes duplicated schedule markup from the faculty and student panels.

### Phase 6: Migrate personal-request and report screen tables

Migrate:

- Faculty personal requests.
- Student personal requests.
- Report detail tables.
- Computer lab report table where the interactive styling is appropriate.

Keep report-specific widths and density as configuration.

### Phase 7: Keep print/export rendering separate

Do not migrate:

- `PrintableReportDocument.tsx`
- Print-specific report styles.

Optionally share:

- Column metadata.
- Data normalization.
- Cell formatting helpers.

Rendered screen and print components should remain separate.

---

## 8. Verification plan

### Structure

- Correct semantic table markup.
- Stable column alignment.
- Correct action alignment.
- No unintended nested horizontal scroll containers.

### Behavior

- Loading state.
- Error state and retry.
- Empty state.
- Filter changes reset pagination correctly.
- Page-size changes reset to page one.
- Client and server pagination remain correct.
- Row actions open the correct modal or drawer.
- No unintended navigation after page changes.

### Sticky behavior

- Header sticks while scrolling.
- Pagination sticks to the bottom only while the table is active.
- Pagination returns to normal flow after the table ends.
- Sticky controls are not clipped by rounded wrappers.
- Sticky behavior works with expanded filters.
- Sticky behavior works at mobile widths.

### Visual consistency

- Same panel radius, border, background, and shadow.
- Same header height.
- Same row density.
- Same status badge treatment.
- Same action spacing.
- Same horizontal-scroll behavior.

---

## Recommended final direction

Use the Requests page as the visual baseline. Build a reusable interactive `DataTable` and `TablePanel`, configure domain-specific columns and actions, and keep print/report rendering separate.

The key design rule is:

> Standardize the table shell and interaction behavior while allowing each domain to control its columns, cell rendering, actions, pagination mode, and density.