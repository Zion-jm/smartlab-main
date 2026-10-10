import EquipmentAvailabilityPlanner from '../components/equipment/EquipmentAvailabilityPlanner';
import { useRef } from 'react';
import { isAxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import EquipmentDrawer, { type EquipmentDrawerMode } from '../components/equipment/EquipmentDrawer';
import EquipmentUsageCalendar from '../components/equipment/EquipmentUsageCalendar';
import { borrowRequestApi, equipmentApi } from '../services/api';
import type { EquipmentFilters, EquipmentItem, EquipmentStats, EquipmentStatus } from '../types/equipment';
import type { BorrowRequest } from '../types/requests';
import { CompactStatCard } from '../components/shared/Card';
import { Table, TableContainer, TableHead, TableHeaderCell, TableBody, TableRow, TableCell, TableTitleCell, TableActionsCell } from '../components/shared/Table';
import { TextActionButton } from '../components/shared/TableActionButtons';
import { EmptyState, LoadingState, ErrorState } from '../components/shared/EmptyState';
import { FilterItem, CheckboxFilter } from '../components/shared/FilterGroup';
import { InputField } from '../components/shared/InputField';
import DropdownField from '../components/shared/DropdownField';
import { toast } from '../stores/toastStore';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import TablePagination from '../components/shared/TablePagination';
import { DEFAULT_TABLE_PAGE_SIZE } from '../components/shared/tablePaginationConstants';
import PageTabGroup from '../components/shared/PageTabGroup';
import { getPageTabId } from '../components/shared/pageTabGroupUtils';
import AcademicPeriodFilter, { type AcademicPeriodSelection } from '../components/shared/AcademicPeriodFilter';
import FilterToolbar from '../components/FilterToolbar';
import ResetFiltersButton from '../components/shared/ResetFiltersButton';

type EquipmentView = 'table' | 'calendar' | 'availability';

const equipmentViewTabs: Array<{ id: EquipmentView; label: string }> = [
  { id: 'table', label: 'Inventory' },
  { id: 'calendar', label: 'Usage Calendar' },
  { id: 'availability', label: 'Availability' },
];

const isEquipmentView = (value: string | null): value is EquipmentView =>
  value === 'table' || value === 'calendar' || value === 'availability';

const statusBadges: Record<EquipmentStatus, { label: string; className: string }> = {
  AVAILABLE: { label: 'Available', className: 'bg-[#dcfce7] text-[#166534]' },
  BORROWED: { label: 'Borrowed', className: 'bg-[#dbeafe] text-[#1d4ed8]' },
  DAMAGED: { label: 'Damaged', className: 'bg-[#fee2e2] text-[#b91c1c]' },
  UNAVAILABLE: { label: 'Unavailable', className: 'bg-[#fef3c7] text-[#92400e]' },
};

const statusOptions: Array<{ value: EquipmentStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'AVAILABLE', label: statusBadges.AVAILABLE.label },
  { value: 'BORROWED', label: statusBadges.BORROWED.label },
  { value: 'DAMAGED', label: statusBadges.DAMAGED.label },
  { value: 'UNAVAILABLE', label: statusBadges.UNAVAILABLE.label },
];

const defaultFilters: EquipmentFilters = {
  search: '',
  status: 'ALL',
  lowStockOnly: false,
};

export default function AdminEquipment() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [stats, setStats] = useState<EquipmentStats | null>(null);
  const [filters, setFilters] = useState<EquipmentFilters>(() => ({
    search: searchParams.get('search') ?? '',
    status: statusOptions.some((option) => option.value === searchParams.get('status'))
      ? searchParams.get('status') as EquipmentStatus | 'ALL'
      : 'ALL',
    lowStockOnly: searchParams.get('lowStock') === '1',
  }));
  const debouncedSearch = useDebouncedValue(filters.search);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<EquipmentDrawerMode>('create');
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentItem | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [usageRequests, setUsageRequests] = useState<BorrowRequest[]>([]);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<EquipmentView>(() => {
    const requestedView = searchParams.get('tab');
    return isEquipmentView(requestedView) ? requestedView : 'table';
  });
  const [serverTotal, setServerTotal] = useState(0);
  const [equipmentPage, setEquipmentPage] = useState(1);
  const [equipmentPageSize, setEquipmentPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [academicPeriod, setAcademicPeriod] = useState<AcademicPeriodSelection>(() => ({
    academicYearId: searchParams.get('academicYearId') ?? '',
    termId: searchParams.get('termId') ?? '',
  }));
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(
    () => Boolean(searchParams.get('status') || searchParams.get('lowStock'))
  );

  const requestVersion = useRef(0);
  const performLoadData = useCallback(async () => {
    const version = ++requestVersion.current;
    
      return Promise.all([
        (viewMode === 'table' ? equipmentApi.getPage : equipmentApi.getAll)({
          page: equipmentPage, pageSize: equipmentPageSize,
          ...(viewMode === 'table' && debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
          ...(viewMode === 'table' && filters.status !== 'ALL' ? { status: filters.status } : {}),
          ...(viewMode === 'table' && filters.lowStockOnly ? { lowStock: '1' } : {}),
        }),
        equipmentApi.getStats({
          academicYearId: academicPeriod.academicYearId || undefined,
          termId: academicPeriod.termId || undefined,
        }),
      ]).then(([equipmentRes, statsRes]) => {
      if (version !== requestVersion.current) return;
      const count = Number(equipmentRes.headers['x-total-count']); setServerTotal(count);
      if (equipmentPage > 1 && count <= (equipmentPage - 1) * equipmentPageSize) setEquipmentPage(Math.max(1, Math.ceil(count / equipmentPageSize)));
      setEquipment(Array.isArray(equipmentRes.data) ? equipmentRes.data : []);
      setStats((statsRes.data ?? null) as EquipmentStats);
    
    }).catch((err) => {
      if (version !== requestVersion.current) return;
      console.error('Failed to load equipment data', err);
      setError(err instanceof Error && /exceeds 1000|Data changed while loading/.test(err.message) ? err.message : 'Failed to load equipment data. Please try again later.');
    }).finally(() => {
      if (version === requestVersion.current) setLoading(false);
    });
  }, [
    equipmentPage, equipmentPageSize, viewMode,
    academicPeriod.academicYearId,
    academicPeriod.termId,
    debouncedSearch,
    filters.lowStockOnly,
    filters.status,
  ]);

  // Automatic loads reset pending state when their query changes; refreshes reset it in the event.
  const loadDataInputs = [
    equipmentPage, equipmentPageSize, viewMode,
    academicPeriod.academicYearId,
    academicPeriod.termId,
    debouncedSearch,
    filters.lowStockOnly,
    filters.status,
  ];
  const [loadDataSource, setloadDataSource] = useState(loadDataInputs);
  if (loadDataInputs.some((value, index) => !Object.is(value, loadDataSource[index]))) {
    setloadDataSource(loadDataInputs);
    setLoading(true);
    setError(null);
  }
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    await performLoadData();
  }, [performLoadData]);

  useEffect(() => { void performLoadData(); }, [performLoadData]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (viewMode !== 'table') next.set('tab', viewMode);
    if (filters.search.trim()) next.set('search', filters.search.trim());
    if (filters.status !== 'ALL') next.set('status', filters.status);
    if (filters.lowStockOnly) next.set('lowStock', '1');
    if (academicPeriod.academicYearId) next.set('academicYearId', academicPeriod.academicYearId);
    if (academicPeriod.termId) next.set('termId', academicPeriod.termId);
    setSearchParams(next, { replace: true });
  }, [academicPeriod, filters, setSearchParams, viewMode]);

  const TabInputs = [searchParams];
  const [TabPrevious, setTabPrevious] = useState<unknown[] | null>(null);
  if (!TabPrevious || TabInputs.some((value, index) => !Object.is(value, TabPrevious[index]))) {
    setTabPrevious(TabInputs);
    const requestedView = searchParams.get('tab');
    const nextView = isEquipmentView(requestedView) ? requestedView : 'table';
    setViewMode((currentView) => (currentView === nextView ? currentView : nextView));
  }

  const usageRequestVersion = useRef(0);
  const performLoadUsageData = useCallback(async () => {
    const version = ++usageRequestVersion.current;
    
      return borrowRequestApi.getAll({
        status: 'ALL',
        sort: 'date-asc',
        academicYearId: academicPeriod.academicYearId || undefined,
        termId: academicPeriod.termId || undefined,
      }).then((response) => {
      if (version !== usageRequestVersion.current) return;
      setUsageRequests((response.data?.requests ?? []) as BorrowRequest[]);
    
    }).catch((err) => {
      if (version !== usageRequestVersion.current) return;
      console.error('Failed to load equipment usage schedule', err);
      setUsageError(err instanceof Error && /exceeds 1000|Data changed while loading/.test(err.message) ? err.message : 'Failed to load equipment usage schedule. Please try again.');
    }).finally(() => {
      if (version === usageRequestVersion.current) setUsageLoading(false);
    });
  }, [academicPeriod.academicYearId, academicPeriod.termId]);

  // Automatic loads reset pending state when their query changes; refreshes reset it in the event.
  const loadUsageDataInputs = [academicPeriod.academicYearId, academicPeriod.termId];
  const [loadUsageDataSource, setloadUsageDataSource] = useState(loadUsageDataInputs);
  if (loadUsageDataInputs.some((value, index) => !Object.is(value, loadUsageDataSource[index]))) {
    setloadUsageDataSource(loadUsageDataInputs);
    setUsageLoading(true);
    setUsageError(null);
  }
  const loadUsageData = useCallback(async () => {
    setUsageLoading(true);
    setUsageError(null);
    await performLoadUsageData();
  }, [performLoadUsageData]);

  const refreshEquipmentData = useCallback(async () => {
    await Promise.all([loadData(), loadUsageData()]);
  }, [loadData, loadUsageData]);

  useEffect(() => { void performLoadUsageData(); }, [performLoadUsageData]);

  const openDrawer = (mode: EquipmentDrawerMode, record: EquipmentItem | null = null) => {
    setDrawerMode(mode);
    setSelectedEquipment(record);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedEquipment(null);
  };

  const handleDrawerSaved = (mode: EquipmentDrawerMode) => {
    closeDrawer();
    loadData();
    toast.success(mode === 'create' ? 'Equipment added successfully.' : 'Equipment updated successfully.');
  };

  const handleArchive = async (item: EquipmentItem) => {
    if (archivingId) return;
    if (!confirm(`Archive "${item.name}"? It will be unavailable for new loans. History and existing loans will be kept.`)) return;
    setArchivingId(item.id);
    try {
      await equipmentApi.retire(item.id);
      await loadData();
      toast.success(`"${item.name}" archived successfully.`);
    } catch (error) {
      const detail = isAxiosError(error) ? error.response?.data?.error : undefined;
      toast.error(typeof detail === 'string' ? detail : 'Failed to archive equipment. Please try again.');
    } finally {
      setArchivingId(null);
    }
  };

  const handleRestore = async (item: EquipmentItem) => {
    if (archivingId || !confirm(`Restore "${item.name}"? Availability will depend on its current stock.`)) return;
    setArchivingId(item.id);
    try {
      await equipmentApi.restore(item.id);
      await loadData();
      toast.success('Equipment restored.');
    } catch (error) {
      const detail = isAxiosError(error) ? error.response?.data?.error : undefined;
      toast.error(typeof detail === 'string' ? detail : 'Failed to restore equipment.');
    } finally { setArchivingId(null); }
  };

  const filteredEquipment = equipment;

  const pageReset1Inputs = [filters.search, filters.status, filters.lowStockOnly];
  const [pageReset1Previous, setpageReset1Previous] = useState<unknown[] | null>(null);
  if (!pageReset1Previous || pageReset1Inputs.some((value, index) => !Object.is(value, pageReset1Previous[index]))) {
    setpageReset1Previous(pageReset1Inputs);
    setEquipmentPage(1);
  }

  const paginatedEquipment = filteredEquipment;

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, search: event.target.value }));
  };

  const handleStatusChange = (value: EquipmentStatus | 'ALL') => {
    setFilters((prev) => ({ ...prev, status: value }));
  };

  const handleLowStockToggle = (checked: boolean) => {
    setFilters((prev) => ({ ...prev, lowStockOnly: checked }));
  };

  const clearFilters = () => setFilters(defaultFilters);

  const appliedFilters = useMemo(() => {
    const chips: { id: 'search' | 'status' | 'lowStockOnly'; label: string }[] = [];
    if (filters.search.trim()) {
      chips.push({ id: 'search', label: `Search: ${filters.search.trim()}` });
    }
    if (filters.status !== 'ALL') {
      const statusLabel = statusOptions.find((option) => option.value === filters.status)?.label ?? filters.status;
      chips.push({ id: 'status', label: `Status: ${statusLabel}` });
    }
    if (filters.lowStockOnly) {
      chips.push({ id: 'lowStockOnly', label: 'Low stock only' });
    }
    return chips;
  }, [filters]);

  const removeFilter = (id: (typeof appliedFilters)[number]['id']) => {
    if (id === 'search') setFilters((previous) => ({ ...previous, search: '' }));
    if (id === 'status') setFilters((previous) => ({ ...previous, status: 'ALL' }));
    if (id === 'lowStockOnly') setFilters((previous) => ({ ...previous, lowStockOnly: false }));
  };

  const renderSummaryCards = () => {
    if (!stats) return null;

    const cards = [
      {
        title: 'Total Inventory',
        value: stats.inventory?.totalQuantity ?? 0,
        subtext: `${stats.inventory?.uniqueItems ?? 0} unique items`,
      },
      {
        title: 'Available',
        value: stats.inventory?.availableQuantity ?? 0,
        subtext: `${stats.inventory?.lowStockCount ?? 0} low in stock`,
      },
      {
        title: 'Currently checked out',
        value: stats.inventory?.borrowedQuantity ?? 0,
        subtext: `${stats.today?.itemsReserved ?? 0} reserved today`,
      },
      {
        title: 'Damaged',
        value: stats.inventory?.damagedQuantity ?? 0,
        subtext: `${stats.overdue?.requests ?? 0} overdue returns`,
      },
      {
        title: 'Archived',
        value: stats.inventory?.archivedQuantity ?? 0,
        subtext: 'Stored units unavailable for borrowing',
      },
      {
        title: 'Utilization',
        value: `${stats.inventory?.utilizationRate ?? 0}%`,
        subtext: `${stats.upcoming?.requests ?? 0} upcoming reservations`,
      },
    ];

    return (
      <div className="equipment-summary grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {cards.map((card) => (
          <CompactStatCard
            key={card.title}
            title={card.title}
            value={card.value}
            subtext={card.subtext}
          />
        ))}
      </div>
    );
  };

  const renderTable = () => {
    if (loading) {
      return <LoadingState message="Loading equipment…" />;
    }

    if (error) {
      return <ErrorState message={error} onRetry={() => window.location.reload()} />;
    }

    if (filteredEquipment.length === 0) {
      return (
        <EmptyState
          title="No equipment found"
          description="Try a different search or add a new item."
          variant="dashed"
        />
      );
    }

    return (
      <section className="rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
        <div className="px-4 py-5 lg:px-6">
          <div className="space-y-3 md:hidden">
            {paginatedEquipment.map(item => <article key={item.id} className="overflow-hidden rounded-2xl border border-[#ead7d3] bg-white">
              <header className="space-y-2 border-b border-[#f1e6e3] bg-[#fffaf7] p-3"><h3 className="break-words text-sm font-semibold text-[#57322d]">{item.name}</h3><span className={'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ' + statusBadges[item.status].className}>{item.retiredAt ? 'Archived' : statusBadges[item.status].label}</span></header>
              <div className="p-3"><p className="mb-3 break-words text-xs leading-relaxed text-[#786565]">{item.description || 'No description provided'}</p><dl className="grid grid-cols-3 gap-2 text-center">{[['Available', item.availableQuantity], ['Checked out', item.borrowedQuantity], ['Damaged', item.damagedQuantity]].map(([label, count]) => <div key={label} className="rounded-xl bg-[#faf7f5] py-3"><dt className="text-[10px] text-[#786565]">{label}</dt><dd className="mt-1 text-lg font-semibold text-[#321d1d]">{count}</dd></div>)}</dl><p className="mt-2 text-right text-xs text-[#786565]">{item.totalQuantity} total units</p></div>
              <footer className="grid grid-cols-2 gap-2 border-t border-[#f1e6e3] p-3"><TextActionButton label="Edit" icon="edit" onClick={() => openDrawer('edit', item)} /><TextActionButton label={archivingId === item.id ? 'Saving…' : item.retiredAt ? 'Restore' : 'Archive'} icon={item.retiredAt ? 'restore' : 'archive'} onClick={() => item.retiredAt ? handleRestore(item) : handleArchive(item)} disabled={archivingId !== null} busy={archivingId === item.id} /></footer>
            </article>)}
          </div>
          <div className="hidden md:block"><TableContainer>
            <Table>
              <TableHead>
                <TableHeaderCell>Equipment</TableHeaderCell>
                <TableHeaderCell>Available</TableHeaderCell>
                <TableHeaderCell>Currently checked out</TableHeaderCell>
                <TableHeaderCell>Damaged</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell align="right" width="8rem">Actions</TableHeaderCell>
              </TableHead>
              <TableBody>
                {paginatedEquipment.map((item) => {
                  const badge = statusBadges[item.status];
                  return (
                    <TableRow key={item.id}>
                      <TableTitleCell
                        title={item.name}
                        subtitle={item.description || '—'}
                      />
                      <TableCell>
                        {item.availableQuantity}{' '}
                        <span className="text-[11px] text-[#9ca3af]">/ {item.totalQuantity}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[#1d4ed8]">{item.borrowedQuantity}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[#b91c1c]">{item.damagedQuantity}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${badge.className}`}>
                          {item.retiredAt ? 'Archived' : badge.label}
                        </span>
                      </TableCell>
                      <TableActionsCell>
                        <TextActionButton
                          label="Edit" icon="edit"
                          onClick={() => openDrawer('edit', item)}
                          variant="default"
                        />
                        <TextActionButton
                          label={archivingId === item.id ? 'Saving…' : item.retiredAt ? 'Restore' : 'Archive'}
                          onClick={() => item.retiredAt ? handleRestore(item) : handleArchive(item)}
                          variant="default" icon={item.retiredAt ? 'restore' : 'archive'} disabled={archivingId !== null} busy={archivingId === item.id}
                        />
                      </TableActionsCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer></div>
          <TablePagination
            currentPage={equipmentPage}
            pageSize={equipmentPageSize}
            totalItems={serverTotal}
            onPageChange={setEquipmentPage}
            onPageSizeChange={(size) => {
              setEquipmentPageSize(size);
              setEquipmentPage(1);
            }}
          />
        </div>
      </section>
    );
  };

  const equipmentViewLabel = equipmentViewTabs.find((tab) => tab.id === viewMode)?.label ?? 'Equipment view';
  const equipmentRibbonSummary = [
    `View: ${equipmentViewLabel}`,
    viewMode === 'table' && appliedFilters.length > 0 ? appliedFilters.map((filter) => filter.label).join(', ') : 'No active filters',
  ].filter(Boolean).join(' · ');

  const advancedFilterCount = [
    filters.status !== 'ALL',
    filters.lowStockOnly,
  ].filter(Boolean).length;

  const equipmentFilterPanel = (
    <div className="compact-filter-panel w-full space-y-3">
      <div className={`grid grid-cols-1 items-end gap-3 ${viewMode === 'table' ? 'lg:grid-cols-2' : ''}`}>
        {viewMode === 'table' && (
          <FilterItem label="Search" className="min-w-0">
            <InputField
              type="search"
              value={filters.search}
              onChange={handleSearchChange}
              placeholder="Search equipment or description…"
              size="md"
            />
          </FilterItem>
        )}
        <div role="group" aria-label="Academic period filters" className="ribbon-control-group min-w-0">
          <div className="ribbon-filter-label">Academic period</div>
          <AcademicPeriodFilter
            compact
            compactDropdown
            showCompactDropdownLabel={false}
            className="border-0 px-0"
            value={academicPeriod}
            onChange={setAcademicPeriod}
          />
        </div>
      </div>

      {viewMode === 'table' && (
        <>
          <div
            id="equipment-advanced-filters"
            hidden={!showAdvancedFilters}
            className="grid grid-cols-1 gap-2.5 border-t border-[#f1e4e1] pt-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <FilterItem label="Status" className="min-w-0">
              <DropdownField
                value={filters.status}
                options={statusOptions}
                onChange={handleStatusChange}
                placeholder="All statuses"
              />
            </FilterItem>
            <div className="flex min-h-10 items-end">
              <CheckboxFilter
                label="Low stock only"
                checked={filters.lowStockOnly}
                onChange={handleLowStockToggle}
              />
            </div>
          </div>

          {appliedFilters.length > 0 && (
            <div className="filter-active-row">
              <div className="filter-active-chips">
                <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Active</span>
                {appliedFilters.map((chip) => (
                  <span
                    key={chip.id}
                    className="filter-active-chip inline-flex items-center gap-2 rounded-full border border-[#f1caca] bg-[#fff7f7] px-3 py-1.5 text-[11px] font-semibold text-[#800000]"
                  >
                    <span className="filter-active-chip__label">{chip.label}</span>
                    <button
                      type="button"
                      onClick={() => removeFilter(chip.id)}
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#b77b7b] transition hover:bg-[#fce7e7] hover:text-[#800000]"
                      aria-label={`Remove ${chip.label}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <div className="filter-active-reset">
                <ResetFiltersButton onClick={clearFilters} />
              </div>
            </div>
          )}

        </>
      )}
    </div>
  );

  const equipmentAdvancedFilterToggle = viewMode === 'table' ? (
    <button
      type="button"
      onClick={() => setShowAdvancedFilters((current) => !current)}
      aria-expanded={showAdvancedFilters}
      aria-controls="equipment-advanced-filters"
      aria-label={showAdvancedFilters ? 'Hide more filters' : 'Show more filters'}
      title={showAdvancedFilters ? 'Hide more filters' : 'Show more filters'}
      className="ribbon-bottom-control"
    >
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path
          d={showAdvancedFilters ? 'm5 12 5-5 5 5' : 'm5 8 5 5 5-5'}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="sr-only">
        {showAdvancedFilters ? 'Hide' : 'Show'} more filters
        {advancedFilterCount > 0 ? `, ${advancedFilterCount} active` : ''}
      </span>
    </button>
  ) : null;

  return (
    <AdminLayout>
      <div className="equipment-workspace min-w-0">
      <div className="p-2 lg:p-3 responsive-workspace mx-auto space-y-4">
        <FilterToolbar
          searchValue={filters.search}
          onSearchChange={(value) => setFilters((previous) => ({ ...previous, search: value }))}
          searchInFilters
          primaryAction={{
            label: 'Add Equipment',
            icon: <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />,
            onClick: () => openDrawer('create'),
          }}
          filters={viewMode === 'availability' ? <p className="text-sm text-[#786565]">Availability includes reservations across all academic periods.</p> : equipmentFilterPanel}
          className="mb-1"
          filtersActiveCount={viewMode === 'table' ? appliedFilters.length : 0}
          defaultFiltersOpen={appliedFilters.length > 0}
          compactFilters
          ribbonSummary={equipmentRibbonSummary}
          bottomControl={equipmentAdvancedFilterToggle}
          reserveBottomClearance={viewMode === 'calendar'}
          onRefresh={refreshEquipmentData}
          refreshing={loading || usageLoading}
          refreshError={Boolean(error || usageError)}
        />

        <div className={`page-control-ribbon--flush px-0 ${viewMode === 'table' ? 'pt-3 pb-0' : 'py-3'}`}>
          <PageTabGroup
            tabs={equipmentViewTabs}
            value={viewMode}
            onChange={(value) => setViewMode(value as EquipmentView)}
            ariaLabel="Equipment views"
            panelId="equipment-tabpanel"
          />
        </div>

        <div
          id="equipment-tabpanel"
          role="tabpanel"
          aria-labelledby={getPageTabId('equipment-tabpanel', viewMode)}
          className={viewMode === 'table' ? 'space-y-4' : 'py-2'}
        >
            <div className="space-y-4">
              <div aria-hidden="true" className="h-0.5 w-full rounded-full bg-[#c8aaa2]" />
              {viewMode === 'table' && renderSummaryCards()}
              {viewMode === 'table' && stats && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-[#e5e7eb] p-4 bg-white">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">Pending requests</p>
                    <p className="text-2xl font-semibold text-[#111827]">{stats.pendingRequests ?? 0}</p>
                    <p className="text-xs text-[#6b7280]">Awaiting approval</p>
                  </div>
                  <div className="rounded-2xl border border-[#e5e7eb] p-4 bg-white">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">Upcoming reservations</p>
                    <p className="text-2xl font-semibold text-[#111827]">{stats.upcoming?.requests ?? 0}</p>
                    <p className="text-xs text-[#6b7280]">{stats.upcoming?.quantity ?? 0} units scheduled</p>
                  </div>
                  <div className="rounded-2xl border border-[#e5e7eb] p-4 bg-white">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">Overdue returns</p>
                    <p className="text-2xl font-semibold text-[#111827]">{stats.overdue?.requests ?? 0}</p>
                    <p className="text-xs text-[#6b7280]">{stats.overdue?.quantity ?? 0} units overdue</p>
                  </div>
                </div>
              )}
              {viewMode === 'table' && (
                <div aria-hidden="true" className="h-0.5 w-full rounded-full bg-[#c8aaa2]" />
              )}
              {viewMode === 'table' ? renderTable() : viewMode === 'availability' ? <EquipmentAvailabilityPlanner /> : (
                <EquipmentUsageCalendar
                  equipment={equipment}
                  requests={usageRequests}
                  loading={loading || usageLoading}
                  error={error || usageError}
                  onRetry={refreshEquipmentData}
                />
              )}
            </div>
        </div>
      </div>
      <EquipmentDrawer
        open={drawerOpen}
        mode={drawerMode}
        record={selectedEquipment}
        onClose={closeDrawer}
        onSaved={() => handleDrawerSaved(drawerMode)}
      />
    </div></AdminLayout>
  );
}
