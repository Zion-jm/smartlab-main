import { normalizeSchedule } from '../components/lab-schedule/normalizeSchedule';
import ScheduleDataTable from '../components/lab-schedule/ScheduleDataTable';
import { CalendarView, ChartView } from '../components/lab-schedule/ScheduleViews';
import { scheduleTypeLabel } from '../components/lab-schedule/scheduleViewUtils';

import { useRef } from 'react';


import { useCallback, useEffect, useMemo, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { Plus } from 'lucide-react';

import AdminLayout from '../components/AdminLayout';

import FilterToolbar from '../components/FilterToolbar';

import { labScheduleApi } from '../services/api';

import type { AcademicContextSelection, ApiLabSchedule, LabSchedule, LabScheduleResourceOption, LabScheduleResources, ScheduleType } from '../types/labSchedule';

import LabScheduleModal from '../components/lab-schedule/LabScheduleModal';

import ScheduleDetailModal from '../components/lab-schedule/ScheduleDetailModal';

import { IconActionButton } from '../components/shared/TableActionButtons';

import { EmptyState, ErrorState, LoadingState } from '../components/shared/EmptyState';


import { FilterItem } from '../components/shared/FilterGroup';

import DropdownField from '../components/shared/DropdownField';

import { InputField } from '../components/shared/InputField';

import { DEFAULT_TABLE_PAGE_SIZE } from '../components/shared/tablePaginationConstants';

import AcademicPeriodFilter, { type AcademicPeriodSelection } from '../components/shared/AcademicPeriodFilter';

import DateRangeFilter from '../components/shared/DateRangeFilter';

import PageTabGroup from '../components/shared/PageTabGroup';

import { getPageTabId } from '../components/shared/pageTabGroupUtils';

import ResetFiltersButton from '../components/shared/ResetFiltersButton';

type ScheduleView = 'table' | 'chart' | 'calendar';

const scheduleViewTabs: Array<{ id: ScheduleView; label: string }> = [
  { id: 'table', label: 'Table View' },
  { id: 'chart', label: 'Chart View' },
  { id: 'calendar', label: 'Calendar' },
];

const isScheduleView = (value: string | null): value is ScheduleView =>
  value === 'table' || value === 'chart' || value === 'calendar';

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AdminLabSchedule() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [schedules, setSchedules] = useState<LabSchedule[]>([]);
  const [rawSchedules, setRawSchedules] = useState<ApiLabSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [dateFrom, setDateFrom] = useState<string>(() => searchParams.get('dateFrom') ?? searchParams.get('date') ?? '');
  const [dateTo, setDateTo] = useState<string>(() => searchParams.get('dateTo') ?? searchParams.get('date') ?? '');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'admin' | 'request'>(
    () => (searchParams.get('source') as 'all' | 'admin' | 'request' | null) ?? 'all'
  );
  const [scheduleTypeFilter, setScheduleTypeFilter] = useState<'all' | ScheduleType>(
    () => (searchParams.get('type') as 'all' | ScheduleType | null) ?? 'all'
  );
  const [roomFilter, setRoomFilter] = useState(() => searchParams.get('room') ?? '');
  const [programFilter, setProgramFilter] = useState(() => searchParams.get('program') ?? '');
  const [facultyFilter, setFacultyFilter] = useState(() => searchParams.get('faculty') ?? '');
  const [resources, setResources] = useState<LabScheduleResources | null>(null);
  const [modalConfig, setModalConfig] = useState<{ mode: 'create' | 'edit'; schedule: ApiLabSchedule | null } | null>(null);
  const [detailsModalConfig, setDetailsModalConfig] = useState<{ schedule: LabSchedule | null } | null>(null);
  const [isResourcesLoading, setIsResourcesLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [academicContext, setAcademicContext] = useState<AcademicContextSelection | null>(null);
  const [viewMode, setViewMode] = useState<ScheduleView>(() => {
    const requestedView = searchParams.get('tab');
    return isScheduleView(requestedView) ? requestedView : 'table';
  });
  const [serverTotal, setServerTotal] = useState(0);
  const [schedulePage, setSchedulePage] = useState(1);
  const [schedulePageSize, setSchedulePageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [academicPeriod, setAcademicPeriod] = useState<AcademicPeriodSelection>(() => ({
    academicYearId: searchParams.get('academicYearId') ?? '',
    termId: searchParams.get('termId') ?? '',
  }));
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(
    () =>
      Boolean(
        searchParams.get('source') ||
          searchParams.get('type') ||
          searchParams.get('room') ||
          searchParams.get('program') ||
          searchParams.get('faculty')
      )
  );

  const requestVersion = useRef(0);
  const performFetchSchedules = useCallback(async () => {
    const version = ++requestVersion.current;
    
      const params = {
        page: schedulePage, pageSize: schedulePageSize, search, source: sourceFilter, scheduleType: scheduleTypeFilter, room: roomFilter, program: programFilter, faculty: facultyFilter,
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        academicYearId: academicPeriod.academicYearId || undefined,
        termId: academicPeriod.termId || undefined,
      };
      return (viewMode === 'table' ? labScheduleApi.getPage : labScheduleApi.getAll)(params).then((response) => {
      if (version !== requestVersion.current) return;
      const count = Number(response.data.total); setServerTotal(count);
      if (schedulePage > 1 && count <= (schedulePage - 1) * schedulePageSize) setSchedulePage(Math.max(1, Math.ceil(count / schedulePageSize)));
      const apiSchedules: ApiLabSchedule[] = (response.data?.schedules ?? []) as ApiLabSchedule[];
      setRawSchedules(apiSchedules);
      setSchedules(apiSchedules.map(schedule => normalizeSchedule(schedule, dayNames)));
    
    }).catch((err) => {
      if (version !== requestVersion.current) return;
      console.error('Failed to fetch schedules', err);
      setError(err instanceof Error && /exceeds 1000|Data changed while loading/.test(err.message) ? err.message : 'Failed to load schedules. Please try again.');
    }).finally(() => {
      if (version === requestVersion.current) setLoading(false);
    });
  }, [schedulePage, schedulePageSize, viewMode, search, sourceFilter, scheduleTypeFilter, roomFilter, programFilter, facultyFilter, academicPeriod.academicYearId, academicPeriod.termId, dateFrom, dateTo]);

  // Automatic loads reset pending state when their query changes; refreshes reset it in the event.
  const fetchSchedulesInputs = [schedulePage, schedulePageSize, viewMode, search, sourceFilter, scheduleTypeFilter, roomFilter, programFilter, facultyFilter, academicPeriod.academicYearId, academicPeriod.termId, dateFrom, dateTo];
  const [fetchSchedulesSource, setfetchSchedulesSource] = useState(fetchSchedulesInputs);
  if (fetchSchedulesInputs.some((value, index) => !Object.is(value, fetchSchedulesSource[index]))) {
    setfetchSchedulesSource(fetchSchedulesInputs);
    setLoading(true);
    setError(null);
  }
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    await performFetchSchedules();
  }, [performFetchSchedules]);

  useEffect(() => { void performFetchSchedules(); }, [performFetchSchedules]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (viewMode !== 'table') next.set('tab', viewMode);
    if (search.trim()) next.set('search', search.trim());
    if (dateFrom) next.set('dateFrom', dateFrom);
    if (dateTo) next.set('dateTo', dateTo);
    if (sourceFilter !== 'all') next.set('source', sourceFilter);
    if (scheduleTypeFilter !== 'all') next.set('type', scheduleTypeFilter);
    if (roomFilter) next.set('room', roomFilter);
    if (programFilter) next.set('program', programFilter);
    if (facultyFilter) next.set('faculty', facultyFilter);
    if (academicPeriod.academicYearId) next.set('academicYearId', academicPeriod.academicYearId);
    if (academicPeriod.termId) next.set('termId', academicPeriod.termId);
    setSearchParams(next, { replace: true });
  }, [academicPeriod, dateFrom, dateTo, facultyFilter, programFilter, roomFilter, scheduleTypeFilter, search, setSearchParams, sourceFilter, viewMode]);

  const TabInputs = [searchParams];
  const [TabPrevious, setTabPrevious] = useState<unknown[] | null>(null);
  if (!TabPrevious || TabInputs.some((value, index) => !Object.is(value, TabPrevious[index]))) {
    setTabPrevious(TabInputs);
    const requestedView = searchParams.get('tab');
    const nextView = isScheduleView(requestedView) ? requestedView : 'table';
    setViewMode((currentView) => (currentView === nextView ? currentView : nextView));
  }

  useEffect(() => {
    type RawResource = {
      id: string;
      name?: string | null;
      roomNumber?: string | null;
      code?: string | null;
      year?: string | null;
      isActive?: boolean | null;
      isComputerLab?: boolean | null;
    };
    type RawFaculty = { profileId: string; userId: string; firstName?: string | null; lastName?: string | null };
    type RawResponse = {
      rooms?: RawResource[];
      programs?: RawResource[];
      subjects?: RawResource[];
      faculty?: RawFaculty[];
      academicYears?: RawResource[];
      terms?: RawResource[];
    };

    const mapOptions = (
      items: RawResource[] = [],
      labelResolver: (item: RawResource) => string | null | undefined
    ): LabScheduleResourceOption[] =>
      items
        .filter((item) => item.id)
        .map((item) => ({ value: item.id, label: labelResolver(item)?.trim() || 'Unnamed' }));

    const mapRoomOptions = (items: RawResource[] = []): LabScheduleResourceOption[] =>
      items
        .filter((item) => item.id)
        .map((item) => ({
          value: item.id,
          label: (item.name || item.roomNumber || '').trim() || 'Unnamed',
          isComputerLab: Boolean(item.isComputerLab),
        }));

    const loadResources = async () => {
      setIsResourcesLoading(true);
      setModalError(null);
      try {
        const response = await labScheduleApi.getResources();
        const data: RawResponse = response.data ?? {};

        setResources({
          rooms: mapRoomOptions(data.rooms),
          programs: mapOptions(data.programs, (item) => item.name || item.code || ''),
          subjects: mapOptions(data.subjects, (item) => item.name || item.code || ''),
          faculty:
            (data.faculty ?? []).map((profile: RawFaculty) => ({
              value: profile.profileId,
              label: `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || 'Unnamed faculty',
              profileId: profile.profileId,
            })) ?? [],
        });

        const pickActiveResource = (items: RawResource[] = []) => {
          if (!items.length) return null;
          return items.find((item) => item.isActive) ?? items[0];
        };

        const selectedYear = pickActiveResource(data.academicYears);
        const selectedTerm = pickActiveResource(data.terms);

        if (selectedYear && selectedTerm) {
          setAcademicContext({
            academicYearId: selectedYear.id,
            academicYearLabel: selectedYear.year || selectedYear.name || 'Academic Year',
            termId: selectedTerm.id,
            termLabel: selectedTerm.name || 'Term',
          });
        } else {
          setAcademicContext(null);
        }
      } catch (err) {
        console.error('Failed to load lab schedule resources', err);
        setModalError('Failed to load schedule creation resources.');
        setAcademicContext(null);
      } finally {
        setIsResourcesLoading(false);
      }
    };

    loadResources();
  }, []);

  const computerLabNames = useMemo(
    () => (resources?.rooms ?? []).filter((room) => room.isComputerLab).map((room) => room.label),
    [resources]
  );

  const filteredSchedules = schedules;

  const paginatedSchedules = filteredSchedules;

  const pageReset1Inputs = [
    dateFrom,
    dateTo,
    facultyFilter,
    programFilter,
    roomFilter,
    scheduleTypeFilter,
    search,
    sourceFilter,
    academicPeriod.academicYearId, academicPeriod.termId,
  ];
  const [pageReset1Previous, setpageReset1Previous] = useState<unknown[] | null>(null);
  if (!pageReset1Previous || pageReset1Inputs.some((value, index) => !Object.is(value, pageReset1Previous[index]))) {
    setpageReset1Previous(pageReset1Inputs);
    setSchedulePage(1);
  }

  const openCreateModal = () => setModalConfig({ mode: 'create', schedule: null });

  const clearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setSourceFilter('all');
    setScheduleTypeFilter('all');
    setRoomFilter('');
    setProgramFilter('');
    setFacultyFilter('');
    setViewMode('table');
    setShowAdvancedFilters(false);
  };

  const filterOptions = useMemo(() => ({
    rooms: (resources?.rooms ?? []).map(option => option.label),
    programs: (resources?.programs ?? []).map(option => option.label),
    faculty: (resources?.faculty ?? []).map(option => option.label),
  }), [resources]);

  const appliedFilters = useMemo(() => {
    const chips: { id: 'search' | 'date' | 'source' | 'type' | 'room' | 'program' | 'faculty'; label: string }[] = [];
    if (search.trim()) chips.push({ id: 'search', label: `Search: ${search.trim()}` });
    if (dateFrom || dateTo) chips.push({ id: 'date', label: `Date: ${dateFrom || 'Any'} – ${dateTo || 'Any'}` });
    if (sourceFilter !== 'all') chips.push({ id: 'source', label: `Source: ${sourceFilter === 'request' ? 'Request' : 'Admin'}` });
    if (scheduleTypeFilter !== 'all') {
      chips.push({ id: 'type', label: `Type: ${scheduleTypeLabel[scheduleTypeFilter]}` });
    }
    if (roomFilter) chips.push({ id: 'room', label: `Room: ${roomFilter}` });
    if (programFilter) chips.push({ id: 'program', label: `Program: ${programFilter}` });
    if (facultyFilter) chips.push({ id: 'faculty', label: `Faculty: ${facultyFilter}` });
    return chips;
  }, [dateFrom, dateTo, facultyFilter, programFilter, roomFilter, scheduleTypeFilter, search, sourceFilter]);

  const advancedFilterCount = useMemo(
    () => [sourceFilter !== 'all', scheduleTypeFilter !== 'all', roomFilter, programFilter, facultyFilter].filter(Boolean).length,
    [facultyFilter, programFilter, roomFilter, scheduleTypeFilter, sourceFilter]
  );
  const scheduleViewLabel = scheduleViewTabs.find((tab) => tab.id === viewMode)?.label ?? 'Schedule view';
  const scheduleRibbonSummary = [
    `View: ${scheduleViewLabel}`,
  ].filter(Boolean).join(' · ');

  const removeFilter = (id: (typeof appliedFilters)[number]['id']) => {
    if (id === 'search') setSearch('');
    if (id === 'date') {
      setDateFrom('');
      setDateTo('');
    }
    if (id === 'source') setSourceFilter('all');
    if (id === 'type') setScheduleTypeFilter('all');
    if (id === 'room') setRoomFilter('');
    if (id === 'program') setProgramFilter('');
    if (id === 'faculty') setFacultyFilter('');
  };

  const filtersContent = (
    <div className="schedule-ribbon-filters compact-filter-panel w-full min-w-0 space-y-3">
      <div className="grid grid-cols-1 items-end gap-3 lg:grid-cols-2">
        <FilterItem label="Search" className="min-w-0">
          <InputField
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search room, subject, program, faculty…"
            size="md"
          />
        </FilterItem>
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

      <div className="flex flex-col gap-2.5 md:flex-row md:items-end md:justify-start">
        <DateRangeFilter
          value={{ from: dateFrom, to: dateTo }}
          onChange={(range) => {
            setDateFrom(range.from);
            setDateTo(range.to);
          }}
        />
      </div>

      <div
        id="lab-schedule-advanced-filters"
        hidden={!showAdvancedFilters}
        className="grid grid-cols-1 gap-2.5 border-t border-[#f1e4e1] pt-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        <FilterItem label="Source" className="min-w-0">
          <DropdownField
            value={sourceFilter}
            options={[
              { value: 'all', label: 'All sources' },
              { value: 'admin', label: 'Admin' },
              { value: 'request', label: 'Request' },
            ]}
            onChange={setSourceFilter}
            placeholder="All sources"
          />
        </FilterItem>
        <FilterItem label="Schedule type" className="min-w-0">
          <DropdownField
            value={scheduleTypeFilter}
            options={[
              { value: 'all', label: 'All types' },
              { value: 'ONE_TIME', label: 'One-time' },
              { value: 'WEEKLY', label: 'Weekly' },
            ]}
            onChange={setScheduleTypeFilter}
            placeholder="All types"
          />
        </FilterItem>
        <FilterItem label="Room" className="min-w-0">
          <DropdownField
            value={roomFilter}
            options={[{ value: '', label: 'All rooms' }, ...filterOptions.rooms.map((label) => ({ value: label, label }))]}
            onChange={setRoomFilter}
            placeholder="All rooms"
          />
        </FilterItem>
        <FilterItem label="Program" className="min-w-0">
          <DropdownField
            value={programFilter}
            options={[{ value: '', label: 'All programs' }, ...filterOptions.programs.map((label) => ({ value: label, label }))]}
            onChange={setProgramFilter}
            placeholder="All programs"
          />
        </FilterItem>
        <FilterItem label="Faculty" className="min-w-0">
          <DropdownField
            value={facultyFilter}
            options={[{ value: '', label: 'All faculty' }, ...filterOptions.faculty.map((label) => ({ value: label, label }))]}
            onChange={setFacultyFilter}
            placeholder="All faculty"
          />
        </FilterItem>
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
    </div>
  );

  const advancedFilterToggle = (
    <button
      type="button"
      onClick={() => setShowAdvancedFilters((current) => !current)}
      aria-expanded={showAdvancedFilters}
      aria-controls="lab-schedule-advanced-filters"
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
  );

  const handleEditSchedule = (scheduleId: string) => {
    const target = rawSchedules.find((record) => record.id === scheduleId) ?? null;
    if (!target) return;
    setModalConfig({ mode: 'edit', schedule: target });
  };

  const handleViewSchedule = (scheduleId: string) => {
    const target = schedules.find((record) => record.id === scheduleId) ?? null;
    if (!target) return;
    setDetailsModalConfig({ schedule: target });
  };

  return (
    <AdminLayout>
      <div className="px-2 pb-2 lg:px-3 lg:pb-3 responsive-workspace mx-auto space-y-4">
        <FilterToolbar
          searchValue={search}
          onSearchChange={setSearch}
          primaryAction={{
            label: 'Add Schedule',
            icon: <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />,
            onClick: openCreateModal,
          }}
          searchInFilters
          filters={filtersContent}
          className="mobile-schedule-ribbon mb-1"
          filtersActiveCount={appliedFilters.length}
          defaultFiltersOpen={appliedFilters.length > 0}
          compactFilters
          ribbonSummary={scheduleRibbonSummary}
          bottomControl={advancedFilterToggle}
          onRefresh={fetchSchedules}
          refreshing={loading}
          refreshError={Boolean(error)}
        />

        <div className={`page-control-ribbon--flush px-0 ${viewMode === 'table' ? 'pt-3 pb-0' : 'py-3'}`}>
          <PageTabGroup
            tabs={scheduleViewTabs}
            value={viewMode}
            onChange={(value) => setViewMode(value as ScheduleView)}
            ariaLabel="Lab schedule views"
            panelId="lab-schedule-tabpanel"
          />
        </div>

        <div
          id="lab-schedule-tabpanel"
          role="tabpanel"
          aria-labelledby={getPageTabId('lab-schedule-tabpanel', viewMode)}
          className="space-y-4"
        >
          <div aria-hidden="true" className="h-0.5 w-full rounded-full bg-[#c8aaa2]" />
            {loading ? (
              <LoadingState message="Loading schedules…" />
            ) : error ? (
              <ErrorState message={error} onRetry={fetchSchedules} />
            ) : viewMode === 'table' ? (
              filteredSchedules.length === 0 ? (
                <EmptyState title="No schedules found" description="No schedules match your filters yet." variant="minimal" />
              ) : (
                <>
                  <section className="rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
                    <div className="px-4 py-5 lg:px-6">
                    <ScheduleDataTable schedules={paginatedSchedules}
                      source={schedule=><>
                                {schedule.borrowRequest?.id || schedule._meta?.isRequestDerived ? (
                                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#fef3f2] text-[#b91c1c] border border-[#fecaca]">
                                    Request
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#f0f9ff] text-[#1e40af] border border-[#bfdbfe]">
                                    Admin
                                  </span>
                                )}
                              </>} actions={schedule=><>
                                <div className="flex gap-1">
                                  <IconActionButton
                                    label={`View details for ${schedule.programLabel}`}
                                    onClick={() => handleViewSchedule(schedule.id)}
                                    icon="view"
                                    variant="default"
                                  />
                                  <IconActionButton
                                    label={`Edit schedule for ${schedule.programLabel}`}
                                    onClick={() => handleEditSchedule(schedule.id)}
                                    icon="edit"
                                    variant="warning"
                                  />
                                </div>
                              </>}
                      pagination={{currentPage:schedulePage,pageSize:schedulePageSize,totalItems:serverTotal,onPageChange:setSchedulePage,onPageSizeChange:size=>{setSchedulePageSize(size);setSchedulePage(1);}}}
                    />
                    </div>
                  </section>
                </>
              )
            ) : viewMode === 'chart' ? (
              <ChartView dayLabels={dayNames} showEmptyGrid schedules={filteredSchedules} computerLabNames={computerLabNames} onSelectSchedule={handleViewSchedule} />
            ) : (
              <CalendarView dayLabels={dayNames} schedules={filteredSchedules} />
            )}
        </div>
      </div>

      {modalConfig && (
        <LabScheduleModal
          onClose={() => setModalConfig(null)}
          resources={resources}
          academicContext={academicContext}
          loading={isResourcesLoading}
          error={modalError}
          onCreated={() => { setModalConfig(null); fetchSchedules(); }}
          onUpdated={() => { setModalConfig(null); fetchSchedules(); }}
          mode={modalConfig.mode}
          schedule={modalConfig.schedule}
        />
      )}

      {detailsModalConfig && (
        <ScheduleDetailModal schedule={detailsModalConfig.schedule!} onClose={() => setDetailsModalConfig(null)} />
      )}
    </AdminLayout>
  );
}