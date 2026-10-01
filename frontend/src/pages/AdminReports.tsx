import { dateToDateKey } from '../utils/dateTime';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import ReportDetailViews, { type ReportTab } from '../components/admin/ReportDetailViews';
import { borrowRequestApi, directoryApi, equipmentApi, labScheduleApi } from '../services/api';
import type { EquipmentItem } from '../types/equipment';
import type { BorrowRequest, BorrowRequestStatus } from '../types/requests';
import type { ApiLabSchedule } from '../types/labSchedule';
import { YEAR_LEVEL_NUMBERS } from '../constants/yearLevels';
import AcademicPeriodFilter, { type AcademicPeriodSelection } from '../components/shared/AcademicPeriodFilter';
import DateRangeFilter from '../components/shared/DateRangeFilter';
import type { DateRangeValue } from '../components/shared/dateRangeUtils';
import FilterToolbar from '../components/FilterToolbar';
import PageTabGroup from '../components/shared/PageTabGroup';
import { getPageTabId } from '../components/shared/pageTabGroupUtils';

type DateRange = DateRangeValue;

type ReportCatalog = {
  rooms: string[];
  programs: string[];
  yearLevels: number[];
};

const defaultReportCatalog: ReportCatalog = {
  rooms: [],
  programs: [],
  yearLevels: YEAR_LEVEL_NUMBERS,
};

type StatusConfig = {
  label: string;
  className: string;
  barClassName: string;
};

const statusConfig: Record<BorrowRequestStatus, StatusConfig> = {
  PENDING: {
    label: 'Pending',
    className: 'bg-[#fef3c7] text-[#92400e]',
    barClassName: 'bg-[#d97706]',
  },
  APPROVED: {
    label: 'Approved',
    className: 'bg-[#dcfce7] text-[#166534]',
    barClassName: 'bg-[#16a34a]',
  },
  BORROWED: {
    label: 'Borrowed',
    className: 'bg-[#dbeafe] text-[#1d4ed8]',
    barClassName: 'bg-[#2563eb]',
  },
  RETURNED: {
    label: 'Returned',
    className: 'bg-[#e0f2fe] text-[#0c4a6e]',
    barClassName: 'bg-[#0284c7]',
  },
  REJECTED: {
    label: 'Declined',
    className: 'bg-[#fee2e2] text-[#b91c1c]',
    barClassName: 'bg-[#dc2626]',
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-[#f3f4f6] text-[#4b5563]',
    barClassName: 'bg-[#6b7280]',
  },
};

const statusOrder: BorrowRequestStatus[] = [
  'PENDING',
  'APPROVED',
  'BORROWED',
  'RETURNED',
  'REJECTED',
  'CANCELLED',
];

const reportableStatuses = new Set<BorrowRequestStatus>([
  'PENDING',
  'APPROVED',
  'BORROWED',
  'RETURNED',
]);

const reportTabs: Array<{
  id: ReportTab;
  label: string;
  description: string;
}> = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'A snapshot of SmartLab activity.',
  },
  {
    id: 'requests',
    label: 'Requests',
    description: 'Review and print borrowing activity.',
  },
  {
    id: 'schedule',
    label: 'Schedules',
    description: 'Review room and class schedules.',
  },
  {
    id: 'equipment',
    label: 'Equipment',
    description: 'Review inventory and usage.',
  },
];

const isReportTab = (value: string | null): value is ReportTab =>
  value === 'overview' || value === 'requests' || value === 'schedule' || value === 'equipment';

const localDateKey = dateToDateKey;

const monthKey = (value: string) => value.slice(0, 7);

const formatMonth = (value: string) => {
  const date = new Date(`${value}-01T00:00:00`);
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

const formatReportDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const inDateRange = (value: string, range: DateRange) => {
  const date = localDateKey(value);
  return Boolean(date) && (!range.from || date >= range.from) && (!range.to || date <= range.to);
};

const getRequestUnits = (request: BorrowRequest) =>
  (request.items ?? []).reduce((total, item) => total + item.quantity, 0);

function MetricCard({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: 'default' | 'maroon' | 'green' | 'blue' | 'amber';
}) {
  const toneClass = {
    default: 'bg-white border-[#e5e7eb]',
    maroon: 'bg-[#fff8f8] border-[#f1d4d4]',
    green: 'bg-[#f7fdf9] border-[#d8f0df]',
    blue: 'bg-[#f7faff] border-[#dce9fb]',
    amber: 'bg-[#fffdf5] border-[#f6e8b1]',
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#111827]">{value}</p>
      <p className="mt-1 text-xs text-[#6b7280]">{detail}</p>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
      <div className="border-b border-[#f3f4f6] px-4 py-4 lg:px-5">
        <h2 className="text-sm font-semibold text-[#111827]">{title}</h2>
        {description && <p className="mt-1 text-xs text-[#6b7280]">{description}</p>}
      </div>
      <div className="p-4 lg:p-5">{children}</div>
    </section>
  );
}

export default function AdminReports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRange = useMemo<DateRange>(
    () => ({
      from: searchParams.get('from') ?? '',
      to: searchParams.get('to') ?? '',
    }),
    [searchParams]
  );
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [schedules, setSchedules] = useState<ApiLabSchedule[]>([]);
  const [reportCatalog, setReportCatalog] = useState<ReportCatalog>(defaultReportCatalog);
  const [activeTab, setActiveTab] = useState<ReportTab>(() => {
    const requestedTab = searchParams.get('reportTab');
    return isReportTab(requestedTab) ? requestedTab : 'overview';
  });
  const [reportPrimaryFilterPortalTarget, setReportPrimaryFilterPortalTarget] = useState<HTMLDivElement | null>(null);
  const [reportAdvancedFilterPortalTarget, setReportAdvancedFilterPortalTarget] = useState<HTMLDivElement | null>(null);
  const [reportBottomControlPortalTarget, setReportBottomControlPortalTarget] = useState<HTMLDivElement | null>(null);
  const [reportActionPortalTarget, setReportActionPortalTarget] = useState<HTMLDivElement | null>(null);
  const [range, setRange] = useState<DateRange>(initialRange);
  const [draftRange, setDraftRange] = useState<DateRange>(initialRange);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [academicPeriod, setAcademicPeriod] = useState<AcademicPeriodSelection>(() => ({
    academicYearId: searchParams.get('academicYearId') ?? '',
    termId: searchParams.get('termId') ?? '',
  }));

  useEffect(() => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      const setOrDelete = (key: string, value: string) => {
        if (value) next.set(key, value);
        else next.delete(key);
      };
      setOrDelete('from', range.from);
      setOrDelete('to', range.to);
      setOrDelete('academicYearId', academicPeriod.academicYearId);
      setOrDelete('termId', academicPeriod.termId);
      setOrDelete('reportTab', activeTab === 'overview' ? '' : activeTab);
      return next;
    }, { replace: true });
  }, [academicPeriod, activeTab, range, setSearchParams]);

  const performLoadReportData = useCallback(async () => {

    return Promise.allSettled([
      borrowRequestApi.getAll({
        status: 'ALL',
        sort: 'date-desc', fromDate: range.from || undefined, toDate: range.to || undefined,
        academicYearId: academicPeriod.academicYearId || undefined,
        termId: academicPeriod.termId || undefined,
      }),
      equipmentApi.getAll(),
      labScheduleApi.getAll({
        dateFrom: range.from || undefined, dateTo: range.to || undefined,
        academicYearId: academicPeriod.academicYearId || undefined,
        termId: academicPeriod.termId || undefined,
      }),
      directoryApi.getOverview(),
    ]).then(([requestsResult, equipmentResult, schedulesResult, directoryResult]) => {

    const failures = [requestsResult, equipmentResult, schedulesResult].filter(
      (result) => result.status === 'rejected'
    );

    if (failures.length > 0) {
      const limit = failures.find(result => result.status === 'rejected' && result.reason instanceof Error && /exceeds 1000|Data changed while loading/.test(result.reason.message));
      setError(limit?.status === 'rejected' ? limit.reason.message : 'Some reporting data could not be loaded. Please try again.');
      setLoading(false);
      return;
    }

    if (requestsResult.status === 'fulfilled') {
      setRequests((requestsResult.value.data?.requests ?? []) as BorrowRequest[]);
    }
    if (equipmentResult.status === 'fulfilled') {
      setEquipment(Array.isArray(equipmentResult.value.data) ? equipmentResult.value.data : []);
    }
    if (schedulesResult.status === 'fulfilled') {
      setSchedules((schedulesResult.value.data?.schedules ?? []) as ApiLabSchedule[]);
    }
    if (directoryResult.status === 'fulfilled') {
      const directory = directoryResult.value.data as {
        rooms?: Array<{ roomNumber?: string | null; roomName?: string | null }>;
        programs?: Array<{ code?: string | null; name?: string | null }>;
      };
      const rooms = (directory.rooms ?? [])
        .map((room) => [room.roomNumber, room.roomName].filter(Boolean).join(' • '))
        .filter(Boolean);
      const programs = (directory.programs ?? [])
        .map((program) => program.name || program.code || '')
        .filter(Boolean);
      setReportCatalog({
        rooms,
        programs,
        yearLevels: defaultReportCatalog.yearLevels,
      });
    }

    setLoading(false);
  
    });
  }, [academicPeriod.academicYearId, academicPeriod.termId, range.from, range.to]);

  // Automatic loads reset pending state when their query changes; refreshes reset it in the event.
  const loadReportDataInputs = [academicPeriod.academicYearId, academicPeriod.termId, range.from, range.to];
  const [loadReportDataSource, setloadReportDataSource] = useState(loadReportDataInputs);
  if (loadReportDataInputs.some((value, index) => !Object.is(value, loadReportDataSource[index]))) {
    setloadReportDataSource(loadReportDataInputs);
    setLoading(true);
    setError(null);
  }
  const loadReportData = useCallback(async () => {
    setLoading(true);
    setError(null);
    await performLoadReportData();
  }, [performLoadReportData]);

  useEffect(() => { void performLoadReportData(); }, [performLoadReportData]);

  const filteredRequests = useMemo(
    () => requests.filter((request) => inDateRange(request.dateNeeded, range)),
    [range, requests]
  );

  const reportableRequests = useMemo(
    () => filteredRequests.filter((request) => reportableStatuses.has(request.status)),
    [filteredRequests]
  );

  const summary = useMemo(() => {
    const totalUnits = filteredRequests.reduce(
      (total, request) => total + (request.items ?? []).reduce((sum, item) => sum + item.quantity, 0),
      0
    );
    const returnedRequests = filteredRequests.filter((request) => request.status === 'RETURNED');
    const completedRequests = filteredRequests.filter(
      (request) => request.status === 'BORROWED' || request.status === 'RETURNED'
    );
    const uniqueEquipment = new Set(
      filteredRequests.flatMap((request) => (request.items ?? []).map((item) => item.equipmentId))
    ).size;
    const completionRate =
      reportableRequests.length > 0 ? Math.round((completedRequests.length / reportableRequests.length) * 100) : 0;

    const scheduleCount = schedules.filter((schedule) => {
      if (schedule.scheduleType === 'WEEKLY') return true;
      return schedule.scheduleDate ? inDateRange(schedule.scheduleDate, range) : false;
    }).length;

    return {
      totalRequests: filteredRequests.length,
      totalUnits,
      returnedRequests: returnedRequests.length,
      uniqueEquipment,
      completionRate,
      scheduleCount,
    };
  }, [filteredRequests, range, reportableRequests, schedules]);

  const statusCounts = useMemo(
    () =>
      statusOrder.map((status) => ({
        status,
        count: filteredRequests.filter((request) => request.status === status).length,
      })),
    [filteredRequests]
  );

  const monthlyUsage = useMemo(() => {
    const usage = new Map<string, { month: string; requests: number; units: number }>();
    filteredRequests.forEach((request) => {
      const date = localDateKey(request.dateNeeded);
      if (!date) return;
      const key = monthKey(date);
      const current = usage.get(key) ?? { month: key, requests: 0, units: 0 };
      current.requests += 1;
      current.units += (request.items ?? []).reduce((sum, item) => sum + item.quantity, 0);
      usage.set(key, current);
    });
    return Array.from(usage.values()).sort((first, second) => first.month.localeCompare(second.month));
  }, [filteredRequests]);

  const maxStatusCount = Math.max(...statusCounts.map((item) => item.count), 1);
  const maxMonthlyUnits = Math.max(...monthlyUsage.map((item) => item.units), 1);

  const attentionSummary = useMemo(() => {
    const pendingRequests = filteredRequests.filter((request) => request.status === 'PENDING');
    const unreturnedUnits = filteredRequests
      .filter((request) => request.status === 'BORROWED')
      .reduce((total, request) => total + getRequestUnits(request), 0);
    const atRiskEquipment = equipment.filter(
      (item) =>
        item.status === 'DAMAGED' ||
        item.status === 'UNAVAILABLE' ||
        (item.totalQuantity > 1 && item.availableQuantity <= 1)
    );
    const schedulesNeedingReview = schedules.filter((schedule) => {
      const inPeriod =
        schedule.scheduleType === 'WEEKLY' ||
        (schedule.scheduleDate ? inDateRange(schedule.scheduleDate, range) : false);
      return inPeriod && (!schedule.room || !schedule.faculty);
    });

    return {
      pendingRequests: pendingRequests.length,
      unreturnedUnits,
      atRiskEquipment: atRiskEquipment.length,
      schedulesNeedingReview: schedulesNeedingReview.length,
    };
  }, [equipment, filteredRequests, range, schedules]);

  const handleDateRangeChange = (nextRange: DateRange) => {
    setDraftRange(nextRange);
    if (nextRange.from && nextRange.to && nextRange.from > nextRange.to) {
      setError('The start date must be before the end date.');
      return;
    }
    setError(null);
    setRange(nextRange);
  };

  const reportRangeLabel =
    range.from || range.to
      ? `${range.from ? formatReportDate(range.from) : 'Beginning'} – ${range.to ? formatReportDate(range.to) : 'Present'}`
      : 'All recorded dates';
  const reportTabLabel = reportTabs.find((tab) => tab.id === activeTab)?.label ?? 'Overview';
  const reportRibbonSummary = [
    `Date range: ${reportRangeLabel}`,
    `Category: ${reportTabLabel}`,
  ].filter(Boolean).join(' · ');

  const reportCounts: Record<ReportTab, string> = {
    overview: `${summary.totalRequests} requests`,
    requests: `${filteredRequests.length} records`,
    schedule: `${summary.scheduleCount} entries`,
    equipment: `${equipment.length} items`,
  };

  const reportFilterPanel = (
    <div className={`compact-filter-panel w-full space-y-3 ${activeTab !== 'overview' ? 'reports-detail-filter-panel' : ''}`}>
      <div className="grid grid-cols-1 items-end gap-3 lg:grid-cols-2">
        {activeTab !== 'overview' && (
          <div ref={setReportPrimaryFilterPortalTarget} className="ribbon-portal-target w-full min-w-0" />
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

      <div className="flex flex-col gap-2.5 md:flex-row md:items-end md:justify-start">
        <DateRangeFilter
          value={draftRange}
          onChange={handleDateRangeChange}
        />
      </div>
      {activeTab !== 'overview' && (
        <div ref={setReportAdvancedFilterPortalTarget} className="ribbon-portal-target w-full min-w-0" />
      )}

    </div>
  );

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl space-y-4 p-2 lg:p-3">
        <FilterToolbar
          searchValue=""
          onSearchChange={() => undefined}
          searchInFilters
          filters={reportFilterPanel}
          className={`mb-1 ${activeTab !== 'overview' ? 'reports-detail-filter-toolbar' : ''}`}
          compactFilters
          ribbonSummary={reportRibbonSummary}
          reserveBottomClearance={activeTab === 'overview'}
          bottomControl={activeTab !== 'overview' ? <div ref={setReportBottomControlPortalTarget} /> : undefined}
          actions={
            !loading && activeTab !== 'overview'
              ? <div ref={setReportActionPortalTarget} className="flex items-center" />
              : undefined
          }
          onRefresh={loadReportData}
          refreshing={loading}
          refreshError={Boolean(error)}
        />

        <div className="page-control-ribbon--flush px-0 pt-3 pb-0">
          <PageTabGroup
            tabs={reportTabs.map((tab) => ({
              id: tab.id,
              label: tab.label,
              count: reportCounts[tab.id],
              description: tab.description,
            }))}
            value={activeTab}
            onChange={(value) => setActiveTab(value as ReportTab)}
            ariaLabel="Report categories"
            panelId="report-tabpanel"
          />
        </div>

        {error && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#fecaca] bg-[#fff7f7] px-4 py-3 text-sm text-[#b91c1c]">
            <span>{error}</span>
            {error.includes('loaded') && (
              <button type="button" onClick={() => void loadReportData()} className="font-semibold underline">
                Try again
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div
            id="report-tabpanel"
            role="tabpanel"
            aria-labelledby={getPageTabId('report-tabpanel', activeTab)}
            className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-16 text-center text-sm text-[#6b7280]"
          >
            Loading report data…
          </div>
        ) : (
          <div
            id="report-tabpanel"
            role="tabpanel"
            aria-labelledby={getPageTabId('report-tabpanel', activeTab)}
            className="space-y-4"
          >
            {activeTab === 'overview' ? (
              <>
                <div aria-hidden="true" className="h-0.5 w-full rounded-full bg-[#c8aaa2]" />

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <MetricCard label="Borrow requests" value={summary.totalRequests} detail="Within this period" tone="maroon" />
                  <MetricCard label="Units requested" value={summary.totalUnits} detail="Approved, borrowed, or returned" tone="blue" />
                  <MetricCard label="Returned requests" value={summary.returnedRequests} detail="Completed equipment returns" tone="green" />
                  <MetricCard label="Equipment used" value={summary.uniqueEquipment} detail="Unique catalog items" tone="amber" />
                  <MetricCard label="Lab schedules" value={summary.scheduleCount} detail="One-time and recurring" />
                  <MetricCard label="Completion rate" value={`${summary.completionRate}%`} detail="Borrowed or returned" />
                </div>

                <div aria-hidden="true" className="h-0.5 w-full rounded-full bg-[#c8aaa2]" />

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_auto_minmax(0,0.9fr)]">
                  <Panel
                    title="Needs attention"
                    description="Operational items that may need an administrator's action."
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('requests')}
                        className="rounded-xl border border-[#f6e8b1] bg-[#fffdf5] p-3 text-left hover:border-[#d97706]"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#92400e]">Pending requests</p>
                        <p className="mt-1 text-2xl font-bold text-[#111827]">{attentionSummary.pendingRequests}</p>
                        <p className="mt-1 text-xs text-[#6b7280]">Open request records</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('equipment')}
                        className="rounded-xl border border-[#f1d4d4] bg-[#fff8f8] p-3 text-left hover:border-[#b91c1c]"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#991b1b]">Unreturned units</p>
                        <p className="mt-1 text-2xl font-bold text-[#111827]">{attentionSummary.unreturnedUnits}</p>
                        <p className="mt-1 text-xs text-[#6b7280]">Currently marked borrowed</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('equipment')}
                        className="rounded-xl border border-[#f1d4d4] bg-[#fff8f8] p-3 text-left hover:border-[#b91c1c]"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#991b1b]">At-risk equipment</p>
                        <p className="mt-1 text-2xl font-bold text-[#111827]">{attentionSummary.atRiskEquipment}</p>
                        <p className="mt-1 text-xs text-[#6b7280]">Damaged, unavailable, or low stock</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('schedule')}
                        className="rounded-xl border border-[#dce9fb] bg-[#f7faff] p-3 text-left hover:border-[#2563eb]"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#1d4ed8]">Schedules to review</p>
                        <p className="mt-1 text-2xl font-bold text-[#111827]">{attentionSummary.schedulesNeedingReview}</p>
                        <p className="mt-1 text-xs text-[#6b7280]">Missing a room or faculty assignment</p>
                      </button>
                    </div>
                  </Panel>

                  <div aria-hidden="true" className="hidden w-0.5 self-stretch rounded-full bg-[#c8aaa2] xl:-my-4 xl:block" />

                  <Panel title="Request status" description="Every request in the selected reporting period.">
                    <div className="space-y-3">
                      {statusCounts.map(({ status, count }) => (
                        <div key={status}>
                          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                            <span className="font-semibold text-[#374151]">{statusConfig[status].label}</span>
                            <span className="text-[#6b7280]">{count}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-[#f3f4f6]">
                            <div
                              className={`h-full rounded-full ${statusConfig[status].barClassName}`}
                              style={{ width: `${(count / maxStatusCount) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>

                <div aria-hidden="true" className="h-0.5 w-full rounded-full bg-[#c8aaa2]" />

                <Panel title="Borrowing activity over time" description="Monthly request volume and equipment units across all request statuses.">
                  {monthlyUsage.length === 0 ? (
                    <p className="py-8 text-center text-xs text-[#9ca3af]">No borrowing activity in this period.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <div className="flex min-w-[560px] items-end gap-3" style={{ minHeight: 210 }}>
                        {monthlyUsage.map((item) => (
                          <div key={item.month} className="flex min-w-[68px] flex-1 flex-col items-center justify-end gap-2">
                            <div className="flex h-[150px] w-full items-end justify-center gap-1">
                              <div
                                className="w-5 rounded-t-md bg-[#800000]"
                                style={{ height: `${Math.max((item.units / maxMonthlyUnits) * 100, item.units > 0 ? 5 : 0)}%` }}
                                title={`${item.units} units`}
                              />
                              <div
                                className="w-5 rounded-t-md bg-[#f6b728]"
                                style={{ height: `${Math.max((item.requests / Math.max(...monthlyUsage.map((entry) => entry.requests), 1)) * 100, item.requests > 0 ? 5 : 0)}%` }}
                                title={`${item.requests} requests`}
                              />
                            </div>
                            <span className="text-[10px] font-semibold text-[#6b7280]">{formatMonth(item.month)}</span>
                            <span className="text-[10px] text-[#9ca3af]">{item.units} units · {item.requests} requests</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-center gap-4 text-[10px] font-semibold text-[#6b7280]">
                        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#800000]" />Units</span>
                        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#f6b728]" />Requests</span>
                      </div>
                    </div>
                  )}
                </Panel>

                <div aria-hidden="true" className="h-0.5 w-full rounded-full bg-[#c8aaa2]" />

                <Panel title="Detailed reports" description="Open the full filtered log for the area you need to review.">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { tab: 'requests' as const, label: 'Requests', detail: 'Review request status and demand sources.' },
                      { tab: 'schedule' as const, label: 'Schedules', detail: 'Review rooms, recurring entries, and assignments.' },
                      { tab: 'equipment' as const, label: 'Equipment', detail: 'Review inventory health and item demand.' },
                    ].map((item) => (
                      <button
                        key={item.tab}
                        type="button"
                        onClick={() => setActiveTab(item.tab)}
                        className="rounded-xl border border-[#e5e7eb] p-3 text-left hover:border-[#800000] hover:bg-[#fff8f8]"
                      >
                        <p className="text-sm font-semibold text-[#374151]">{item.label}</p>
                        <p className="mt-1 text-xs leading-5 text-[#6b7280]">{item.detail}</p>
                        <span className="mt-3 inline-block text-xs font-semibold text-[#800000]">Open report →</span>
                      </button>
                    ))}
                  </div>
                </Panel>
              </>
            ) : (
              <ReportDetailViews
                activeTab={activeTab}
                requests={requests}
                schedules={schedules}
                equipment={equipment}
                range={range}
                catalog={reportCatalog}
                academicPeriod={academicPeriod}
                primaryFilterPortalTarget={reportPrimaryFilterPortalTarget}
                advancedFilterPortalTarget={reportAdvancedFilterPortalTarget}
                bottomControlPortalTarget={reportBottomControlPortalTarget}
                actionPortalTarget={reportActionPortalTarget}
              />
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}