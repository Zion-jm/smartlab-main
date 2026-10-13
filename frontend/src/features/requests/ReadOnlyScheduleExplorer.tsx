import ScheduleDetailModal from '../../components/lab-schedule/ScheduleDetailModal';
import ScheduleAgenda from './ScheduleAgenda';
import type { LabSchedule } from '../../types/labSchedule';
import { useMemo, useState } from 'react';
import type { SchedulesState } from './useRequestData';
import MobileScheduleExplorer from './MobileScheduleExplorer';
import FilterToolbar from '../../components/FilterToolbar';
import DateRangeFilter from '../../components/shared/DateRangeFilter';
import ResetFiltersButton from '../../components/shared/ResetFiltersButton';
import { CalendarView, ChartView } from '../../components/lab-schedule/ScheduleViews';
import { ErrorState, LoadingState } from '../../components/shared/EmptyState';
import PageTabGroup from '../../components/shared/PageTabGroup';
import { getPageTabId } from '../../components/shared/pageTabGroupUtils';

const scheduleViewTabs = [
  { id: 'agenda', label: 'Agenda', description: 'Browse sessions grouped by date.' },
  { id: 'chart', label: 'Chart View', description: 'View schedules on a weekly utilization chart.' },
  { id: 'calendar', label: 'Calendar', description: 'View schedules in a calendar layout.' },
] as const;

type ReadOnlyScheduleExplorerProps = SchedulesState & { computerLabNames: string[] };

export default function ReadOnlyScheduleExplorer({ schedules, loading, error, dateFilter, setDateFilter, reload, computerLabNames }: ReadOnlyScheduleExplorerProps) {
  const [selectedSchedule, setSelectedSchedule] = useState<LabSchedule | null>(null);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState({from:'',to:''});
  const [viewMode, setViewMode] = useState<'agenda' | 'chart' | 'calendar'>('agenda');

  const filteredSchedules = useMemo(() => {
    const query = search.trim().toLowerCase();
    const dated = schedules.filter(schedule => {
      if (viewMode === 'chart' || (!range.from && !range.to)) return true;
      if (schedule.scheduleType !== 'WEEKLY') { const key = schedule.date?.slice(0,10); return !!key && (!range.from || key >= range.from) && (!range.to || key <= range.to); }
      if (!range.from || !range.to) return true;
      const start = new Date(range.from + 'T00:00:00Z');
      const end = new Date(range.to + 'T00:00:00Z');
      const offset = ((schedule.dayOfWeekIndex ?? -7) - start.getUTCDay() + 7) % 7;
      return schedule.dayOfWeekIndex !== null && start.getTime() + offset * 86400000 <= end.getTime();
    });
    if (viewMode === 'chart') return schedules;
    if (!query) return dated;
    return dated.filter((schedule) =>
      [
        schedule.roomLabel,
        schedule.facultyName,
        schedule.programLabel,
        schedule.subjectLabel,
        schedule.displayDay,
        schedule.displayDate,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [schedules, search, range, viewMode]);

  return (
    <>
    <MobileScheduleExplorer schedules={schedules} loading={loading} error={error} dateFilter={dateFilter} setDateFilter={setDateFilter} reload={reload} computerLabNames={computerLabNames} />
    <section className="hidden md:block mx-auto responsive-workspace space-y-4 p-2 lg:p-3">
      <FilterToolbar
        compactFilters
        searchValue={search}
        onSearchChange={setSearch}
        searchInFilters
        filters={viewMode === 'chart' ? undefined :
          <div className="schedule-ribbon-filters compact-filter-panel grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            <label className="flex min-w-0 flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">Search<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Subject, room, or faculty" className="h-10 rounded-lg border border-[#d8c7c3] bg-white px-3 text-sm font-normal normal-case" /></label>
            <div className="flex w-full items-end gap-2 md:col-span-2">
            <DateRangeFilter value={range} onChange={setRange} className="min-w-0 flex-1" />
            {(range.from || range.to) && <ResetFiltersButton onClick={() => setRange({from:'',to:''})} label="Clear dates" className="mb-0 whitespace-nowrap" />}
            </div>
          </div>
        }
        filtersActiveCount={viewMode === 'chart' ? 0 : Number(Boolean(search)) + Number(Boolean(range.from || range.to))}
        ribbonSummary={`View: ${scheduleViewTabs.find((tab) => tab.id === viewMode)?.label ?? 'Schedule'}${viewMode === 'agenda' && (range.from || range.to) ? ` · Dates: ${range.from || 'Any'} – ${range.to || 'Any'}` : ''}`}
        onRefresh={reload}
        refreshing={loading}
        refreshError={Boolean(error)}
        className="mb-1"
      />
      <div className="page-control-ribbon--flush px-0 pt-3 pb-0">
          <PageTabGroup
            tabs={scheduleViewTabs}
            value={viewMode}
            onChange={(value) => setViewMode(value as 'agenda' | 'chart' | 'calendar')}
            ariaLabel="Schedule views"
            panelId="readonly-schedule-tabpanel"
          />
      </div>
      {!loading && !error && <section className="rounded-2xl border border-[#ead7d3] bg-white shadow-sm">
        <header className="rounded-t-2xl border-b border-[#ead7d3] bg-[#fffaf7] px-5 py-4">
          <h3 className="text-sm font-semibold text-[#57322d]">Schedule overview</h3>
          <p className="mt-1 text-xs text-[#786565]">{viewMode === 'chart' ? 'Active-period records across all labs and weeks. Use the chart controls to explore a specific week.' : 'Records matching your search and date filters.'}</p>
        </header>
        <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
          {[
            {label:'Schedule records',value:filteredSchedules.length,tone:'border-[#ead7d3] bg-[#fffaf7] text-[#800000]'},
            {label:'Weekly',value:filteredSchedules.filter(item => item.scheduleType === 'WEEKLY').length,tone:'border-blue-200 bg-blue-50 text-blue-800'},
            {label:'One-time',value:filteredSchedules.filter(item => item.scheduleType === 'ONE_TIME').length,tone:'border-amber-200 bg-amber-50 text-amber-900'},
            {label:'Labs represented',value:new Set(filteredSchedules.map(item => item.roomLabel)).size,tone:'border-green-200 bg-green-50 text-green-800'},
          ].map(item => <div key={item.label} className={`rounded-xl border p-4 ${item.tone}`}><p className="text-[10px] font-semibold uppercase tracking-wide">{item.label}</p><p className="mt-2 text-2xl font-bold">{item.value}</p></div>)}
        </div>
      </section>}
      <div
        className={viewMode === 'chart' ? "min-w-0 bg-white" : "overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm"}
        id="readonly-schedule-tabpanel"
        role="tabpanel"
        aria-labelledby={getPageTabId('readonly-schedule-tabpanel', viewMode)}
        tabIndex={0}
      >
        {viewMode === 'agenda' && (
        <header className="flex items-center justify-between gap-4 border-b border-[#f1e6e3] px-4 py-4 lg:px-5">
          <div>
          <h3 className="text-sm font-semibold text-[#57322d]">Schedule agenda</h3>
          <p className="mt-1 text-xs text-[#786565]">Browse seven days at a time and select a session to review its details.</p>
          </div>
          {viewMode === 'agenda' && !loading && !error && <span className="shrink-0 rounded-full bg-[#faf4f1] px-2.5 py-1 text-[10px] font-semibold text-[#800000]">{filteredSchedules.length} records</span>}
        </header>
        )}
        {loading ? (
          <LoadingState message="Loading schedules…" />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : viewMode === 'agenda' ? (
          <ScheduleAgenda key={`${range.from}:${range.to}`} schedules={filteredSchedules} range={range} onSelect={setSelectedSchedule} />
        ) : viewMode === 'chart' ? (
          <ChartView flush showEmptyGrid schedules={schedules} computerLabNames={computerLabNames} />
        ) : (
          <CalendarView schedules={filteredSchedules} />
        )}
      </div>
    </section>
    {selectedSchedule && <ScheduleDetailModal schedule={selectedSchedule} onClose={() => setSelectedSchedule(null)} />}
    </>
  );
}

