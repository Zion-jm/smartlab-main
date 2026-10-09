import { CalendarDays, Clock, MapPin, UserRound } from 'lucide-react';
import type { EquipmentAvailabilitySummary } from '../components/equipment/EquipmentConflictChecker';
import { useRef } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { borrowRequestApi } from '../services/api';
import api from '../services/api';
import type {
  BorrowRequestFilters,
  BorrowRequestRoleFilter,
  BorrowRequestSort,
  BorrowRequestStatus,
} from '../types/requests';
import { Table, TableContainer, TableHead, TableHeaderCell, TableBody, TableRow, TableCell } from '../components/shared/Table';
import { TableActionGroup } from '../components/shared/TableActionButtons';
import { EmptyState, ErrorState, LoadingState } from '../components/shared/EmptyState';
import { FilterItem } from '../components/shared/FilterGroup';
import { InputField } from '../components/shared/InputField';
import DropdownField from '../components/shared/DropdownField';
import TableCellDetailModal from '../components/shared/TableCellDetailModal';
import RequestDetailDrawer from '../components/admin/RequestDetailDrawer';
import { formatDate, formatTimeRange, extractTimeString } from '../utils/dateTime';
import { toast } from '../stores/toastStore';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import TablePagination from '../components/shared/TablePagination';
import { DEFAULT_TABLE_PAGE_SIZE } from '../components/shared/tablePaginationConstants';
import AcademicPeriodFilter, { type AcademicPeriodSelection } from '../components/shared/AcademicPeriodFilter';
import DateRangeFilter from '../components/shared/DateRangeFilter';
import FilterToolbar from '../components/FilterToolbar';
import ResetFiltersButton from '../components/shared/ResetFiltersButton';

type ApiBorrowRequest = {
  requestType?: 'LEGACY' | 'LABORATORY' | 'EQUIPMENT';
  usageLocation?: string | null;
  usageRoom?: { id: string; name?: string | null; roomNumber?: string | null } | null;
  id: string;
  referenceCode?: string;
  requesterName: string;
  requesterEmail: string;
  requesterRole: string;
  requesterAvatar?: string | null;
  program?: string | null;
  programCode?: string | null;
  yearLevel?: number | null;
  subject?: string | null;
  room?: {
    id: string;
    name?: string | null;
    roomNumber?: string | null;
  } | null;
  location?: string | null;
  academicYearId?: string | null;
  termId?: string | null;
  items?: Array<{
    id: string;
    equipmentId: string;
    equipmentName: string;
    quantity: number;
    equipment?: {
      id: string;
      name?: string | null;
    } | null;
  }>;
  dateNeeded: string;
  timeStart?: string | null;
  timeEnd?: string | null;
  purpose?: string | null;
  notes?: string | null;
  status: BorrowRequestStatus;
  rejectionNote?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  approvedAt?: string | null;
  borrowedAt?: string | null;
  returnedAt?: string | null;
  cancelledAt?: string | null;
  declinedAt?: string | null;
};

const statusMeta: Record<BorrowRequestStatus | 'ALL', { label: string; className: string; description?: string }> = {
  ALL: { label: 'All requests', className: 'bg-[#eef2ff] text-[#312e81]' },
  PENDING: { label: 'Pending', className: 'bg-[#fef3c7] text-[#92400e]', description: 'Awaiting approval' },
  APPROVED: { label: 'Approved', className: 'bg-[#dcfce7] text-[#166534]', description: 'Ready for pickup' },
  BORROWED: { label: 'Borrowed', className: 'bg-[#dbeafe] text-[#1d4ed8]', description: 'Currently out' },
  RETURNED: { label: 'Returned', className: 'bg-[#e0f2fe] text-[#0c4a6e]' },
  REJECTED: { label: 'Declined', className: 'bg-[#fee2e2] text-[#b91c1c]' },
  CANCELLED: { label: 'Cancelled', className: 'bg-[#f3f4f6] text-[#4b5563]' },
};

const statusOptions = (
  Object.keys(statusMeta) as Array<BorrowRequestStatus | 'ALL'>
).map((key) => ({ value: key, label: statusMeta[key].label }));

const roleOptions: Array<{ value: BorrowRequestRoleFilter; label: string }> = [
  { value: 'ALL', label: 'All roles' },
  { value: 'FACULTY', label: 'Faculty' },
  { value: 'STUDENT', label: 'Student' },
];

const sortOptions: Array<{ value: BorrowRequestSort; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'date-asc', label: 'Date needed ↑' },
  { value: 'date-desc', label: 'Date needed ↓' },
  { value: 'name-asc', label: 'Name A-Z' },
  { value: 'name-desc', label: 'Name Z-A' },
];

const defaultFilters: BorrowRequestFilters = {
  search: '',
  status: 'ALL',
  role: 'ALL',
  fromDate: '',
  toDate: '',
  sort: 'newest',
};

const resolveRoom = (request: ApiBorrowRequest) => {
    if (request.requestType === 'EQUIPMENT') return request.usageRoom ? [request.usageRoom.roomNumber, request.usageRoom.name].filter(Boolean).join(' – ') : request.usageLocation || request.location || 'Not specified';
    if (request.room) {
      const roomNumber = request.room.roomNumber?.trim();
      const roomName = request.room.name?.trim();
      const compositeRoom = [roomNumber, roomName].filter(Boolean).join(' – ');
      return compositeRoom || roomNumber || roomName || '—';
    }
    if (request.location) return request.location.replace(' • ', ' – ');
    return '—';
  };

function RequestTableRow({ request, onOpen, onSelect, onAction }: {
  request: ApiBorrowRequest;
  onOpen: (request: ApiBorrowRequest) => void;
  onSelect: (request: ApiBorrowRequest) => void;
  onAction: (request: ApiBorrowRequest, action: 'approve' | 'borrow' | 'return') => Promise<void>;
}) {
              const badge = statusMeta[request.status];
              const inlineActions = [
                { label: 'Approve', action: 'approve' as const, show: request.status === 'PENDING' },
                { label: 'Borrowed', action: 'borrow' as const, show: request.status === 'APPROVED' && (request.requestType !== 'LABORATORY' || Boolean(request.items?.length)) },
                { label: 'Returned', action: 'return' as const, show: request.status === 'BORROWED' && (request.requestType !== 'LABORATORY' || Boolean(request.items?.length)) },
              ].filter((item) => item.show);

              return (
                <TableRow key={request.id}>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => onOpen(request)}
                      className="w-full text-left hover:bg-[#f9fafb] rounded-lg px-2 py-2 -mx-2 -my-2 transition-colors cursor-pointer"
                    >
                      <p className="font-semibold text-[#111827]">{request.requesterName}</p>
                      <p className="text-xs text-[#6b7280]">{request.requesterEmail}</p>
                    </button>
                  </TableCell>
                  <TableCell>{resolveRoom(request)}</TableCell>
                  <TableCell>
                    {request.items?.length ? (
                      <span className="text-sm text-[#374151]">
                        {request.items.map((item) => `${item.equipmentName} (x${item.quantity})`).join(', ')}
                      </span>
                    ) : (
                      <span className="text-[#6b7280]">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <p>{formatDate(request.dateNeeded)}</p>
                    <p className="text-xs text-[#9ca3af]">{formatTimeRange(request.timeStart, request.timeEnd)}</p>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${badge.className}`}>
                      {badge.label}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <TableActionGroup
                      actions={[
                        { label: 'View', icon: 'view', accessibleLabel: `View request from ${request.requesterName}`, onClick: () => onOpen(request) },
                        ...inlineActions.map((item) => ({
                          label: item.label, icon: item.action,
                          onClick: item.action === 'approve'
                            ? () => { onSelect(request); }
                            : () => onAction(request, item.action),
                          variant: (item.action === 'approve' ? 'primary' : 'default') as 'primary' | 'default',
                        })),
                      ]}
                    />
                  </TableCell>
                </TableRow>
              );

}

export default function AdminRequests() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState<ApiBorrowRequest[]>([]);
  const [filters, setFilters] = useState<BorrowRequestFilters>(() => {
    const requestedStatus = searchParams.get('status');
    const status = requestedStatus && requestedStatus in statusMeta
      ? requestedStatus as BorrowRequestStatus | 'ALL'
      : defaultFilters.status;
    const requestedRole = searchParams.get('role');
    const role = requestedRole && roleOptions.some((option) => option.value === requestedRole)
      ? requestedRole as BorrowRequestRoleFilter
      : defaultFilters.role;
    const requestedSort = searchParams.get('sort');
    const sort = requestedSort && sortOptions.some((option) => option.value === requestedSort)
      ? requestedSort as BorrowRequestSort
      : defaultFilters.sort;
    return {
      search: searchParams.get('search') ?? defaultFilters.search,
      status,
      role,
      sort,
      fromDate: searchParams.get('fromDate') ?? defaultFilters.fromDate,
      toDate: searchParams.get('toDate') ?? defaultFilters.toDate,
    };
  });
  const debouncedSearch = useDebouncedValue(filters.search);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ApiBorrowRequest | null>(null);
  const location = useLocation();
  const reviewRequestId = location.state?.reviewRequestId;
  const reviewToken = location.state?.reviewToken;
  useEffect(() => {
    if (typeof reviewRequestId !== 'string') return;
    let active = true;
    borrowRequestApi.getById(reviewRequestId).then(({ data }) => {
      if (!active) return;
      const r = data.request ?? data;
      setSelectedRequest({ ...r,
        location: r.requestType === 'EQUIPMENT' ? (r.usageRoom ? [r.usageRoom.roomNumber, r.usageRoom.name].filter(Boolean).join(' – ') : r.usageLocation) : r.location,
        requesterName: [r.requester?.firstName, r.requester?.lastName].filter(Boolean).join(' '),
        requesterEmail: r.requester?.email || '', requesterRole: r.requester?.role || '',
        program: r.program?.name ?? null, subject: r.subject?.name ?? null,
        items: (r.items ?? []).map((item: { equipment?: { name?: string } }) => ({ ...item, equipmentName: item.equipment?.name || 'Equipment' })),
      });
    }).catch(() => { if (active) toast.error('Could not open this request. It may no longer be available in the active academic period.'); });
    return () => { active = false; };
  }, [reviewRequestId, reviewToken]);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [detailModalRequest, setDetailModalRequest] = useState<ApiBorrowRequest | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [requestPage, setRequestPage] = useState(1);
  const [requestPageSize, setRequestPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [academicPeriod, setAcademicPeriod] = useState<AcademicPeriodSelection>(() => ({
    academicYearId: searchParams.get('academicYearId') ?? '',
    termId: searchParams.get('termId') ?? '',
  }));
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(
    () =>
      Boolean(
        searchParams.get('status') ||
          searchParams.get('role') ||
          searchParams.get('sort')
      )
  );

  const [equipmentAvailabilityCache, setEquipmentAvailabilityCache] = useState<Record<string, EquipmentAvailabilitySummary[]>>({});

  const checkRequestEquipmentAvailability = useCallback(async (request: ApiBorrowRequest) => {
    if (!request.items || !request.academicYearId || !request.termId || !request.dateNeeded || !request.timeStart || !request.timeEnd) {
      return [];
    }

    const cacheKey = `${request.id}`;
    if (equipmentAvailabilityCache[cacheKey]) {
      return equipmentAvailabilityCache[cacheKey];
    }

    try {
      const response = await api.get('/equipment-conflicts/availability', {
        params: {
          academicYearId: request.academicYearId,
          termId: request.termId,
          date: request.dateNeeded,
          timeStart: extractTimeString(request.timeStart),
          timeEnd: extractTimeString(request.timeEnd),
        },
      });
      const availability = response.data.data.availability || [];
      setEquipmentAvailabilityCache((prev) => ({ ...prev, [cacheKey]: availability }));
      return availability;
    } catch (err) {
      console.error('Equipment availability check error:', err);
      return [];
    }
  }, [equipmentAvailabilityCache]);

  useEffect(() => {
    const pendingRequests = requests.filter((req) => req.status === 'PENDING');
    pendingRequests.forEach((request) => { checkRequestEquipmentAvailability(request); });
  }, [requests, checkRequestEquipmentAvailability]);

  const invalidDateRange = Boolean(filters.fromDate && filters.toDate && filters.fromDate > filters.toDate);
  const requestVersion = useRef(0);
  const performFetchRequests = useCallback(async () => {
    const version = ++requestVersion.current;
    if (invalidDateRange) return;

    
      const params = {
        page: requestPage, pageSize: requestPageSize,
        search: debouncedSearch || undefined,
        status: filters.status,
        role: filters.role,
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
        sort: filters.sort,
        academicYearId: academicPeriod.academicYearId || undefined,
        termId: academicPeriod.termId || undefined,
      };

      return borrowRequestApi.getPage(params).then((res) => {
      if (version !== requestVersion.current) return;
      const { requests: data, total: serverTotal } = res.data;
      if (requestPage > 1 && serverTotal <= (requestPage - 1) * requestPageSize) setRequestPage(Math.max(1, Math.ceil(serverTotal / requestPageSize)));
      setRequests(Array.isArray(data) ? data : []);
      setTotal(typeof serverTotal === 'number' ? serverTotal : data?.length ?? 0);
    
    }).catch((err) => {
      if (version !== requestVersion.current) return;
      console.error('Failed to load requests', err);
      setError('Failed to load requests. Please try again later.');
    }).finally(() => {
      if (version === requestVersion.current) setLoading(false);
    });
  }, [invalidDateRange, requestPage, requestPageSize, academicPeriod.academicYearId, academicPeriod.termId, debouncedSearch, filters.fromDate, filters.role, filters.sort, filters.status, filters.toDate]);

  // Automatic loads reset pending state when their query changes; refreshes reset it in the event.
  const fetchRequestsInputs = [invalidDateRange, requestPage, requestPageSize, academicPeriod.academicYearId, academicPeriod.termId, debouncedSearch, filters.fromDate, filters.role, filters.sort, filters.status, filters.toDate];
  const [fetchRequestsSource, setfetchRequestsSource] = useState<typeof fetchRequestsInputs | null>(null);
  if (!fetchRequestsSource || fetchRequestsInputs.some((value, index) => !Object.is(value, fetchRequestsSource[index]))) {
    setfetchRequestsSource(fetchRequestsInputs);
    setLoading(!invalidDateRange);
    setError(invalidDateRange ? 'The from date cannot be later than the to date.' : null);
  }
  const fetchRequests = useCallback(async () => {
    setLoading(!invalidDateRange);
    setError(invalidDateRange ? 'The from date cannot be later than the to date.' : null);
    await performFetchRequests();
  }, [invalidDateRange, performFetchRequests]);

  useEffect(() => { void performFetchRequests(); }, [performFetchRequests]);

  const pageReset1Inputs = [filters.fromDate, filters.role, filters.search, filters.sort, filters.status, filters.toDate, academicPeriod.academicYearId, academicPeriod.termId];
  const [pageReset1Previous, setpageReset1Previous] = useState<unknown[] | null>(null);
  if (!pageReset1Previous || pageReset1Inputs.some((value, index) => !Object.is(value, pageReset1Previous[index]))) {
    setpageReset1Previous(pageReset1Inputs);
    setRequestPage(1);
  }

  useEffect(() => {
    const next = new URLSearchParams();
    if (filters.search.trim()) next.set('search', filters.search.trim());
    if (filters.status !== 'ALL') next.set('status', filters.status);
    if (filters.role !== 'ALL') next.set('role', filters.role);
    if (filters.sort !== defaultFilters.sort) next.set('sort', filters.sort);
    if (filters.fromDate) next.set('fromDate', filters.fromDate);
    if (filters.toDate) next.set('toDate', filters.toDate);
    if (academicPeriod.academicYearId) next.set('academicYearId', academicPeriod.academicYearId);
    if (academicPeriod.termId) next.set('termId', academicPeriod.termId);
    setSearchParams(next, { replace: true, state: location.state });
  }, [academicPeriod, filters, setSearchParams]);

  const handleFilterChange = (field: keyof BorrowRequestFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => setFilters(defaultFilters);

  const appliedFilters = [
    ...(filters.search.trim() ? [{ id: 'search' as const, label: `Search: ${filters.search.trim()}` }] : []),
    ...(filters.status !== 'ALL'
      ? [{ id: 'status' as const, label: `Status: ${statusMeta[filters.status].label}` }]
      : []),
    ...(filters.role !== 'ALL'
      ? [{ id: 'role' as const, label: `Role: ${roleOptions.find((option) => option.value === filters.role)?.label ?? filters.role}` }]
      : []),
    ...(filters.sort !== defaultFilters.sort
      ? [{ id: 'sort' as const, label: `Sort: ${sortOptions.find((option) => option.value === filters.sort)?.label ?? filters.sort}` }]
      : []),
    ...(filters.fromDate ? [{ id: 'fromDate' as const, label: `From: ${filters.fromDate}` }] : []),
    ...(filters.toDate ? [{ id: 'toDate' as const, label: `To: ${filters.toDate}` }] : []),
  ];

  const requestRibbonSummary = [
    `Showing ${requests.length} of ${total} requests`,
    `Status: ${statusMeta[filters.status].label}`,
    appliedFilters.filter((filter) => filter.id !== 'status').map((filter) => filter.label).join(', '),
  ].filter(Boolean).join(' · ');

  const advancedFilterCount = [
    filters.status !== 'ALL',
    filters.role !== 'ALL',
    filters.sort !== defaultFilters.sort,
  ].filter(Boolean).length;

  const removeFilter = (id: (typeof appliedFilters)[number]['id']) => {
    const resetValues: BorrowRequestFilters = {
      ...defaultFilters,
      search: '',
      status: 'ALL',
      role: 'ALL',
      sort: defaultFilters.sort,
      fromDate: '',
      toDate: '',
    };
    setFilters((previous) => ({ ...previous, [id]: resetValues[id] }));
  };

  const filtersContent = (
    <div className="compact-filter-panel w-full space-y-3">
      <div className="grid grid-cols-1 items-end gap-3 lg:grid-cols-2">
        <FilterItem label="Search" className="min-w-0">
          <InputField
            type="search"
            value={filters.search}
            onChange={(event) => handleFilterChange('search', event.target.value)}
            placeholder="Search name, email, equipment…"
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
        <DateRangeFilter styledDates
          value={{ from: filters.fromDate, to: filters.toDate }}
          onChange={(range) => setFilters((previous) => ({
            ...previous,
            fromDate: range.from,
            toDate: range.to,
          }))}
        />
      </div>

      <div
        id="request-advanced-filters"
        hidden={!showAdvancedFilters}
        className="grid grid-cols-1 gap-2.5 border-t border-[#f1e4e1] pt-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <FilterItem label="Status" className="min-w-0">
          <DropdownField
            value={filters.status}
            options={statusOptions}
            onChange={(value) => handleFilterChange('status', value)}
            placeholder="All requests"
          />
        </FilterItem>
        <FilterItem label="Role" className="min-w-0">
          <DropdownField
            value={filters.role}
            options={roleOptions}
            onChange={(value) => handleFilterChange('role', value)}
            placeholder="All roles"
          />
        </FilterItem>
        <FilterItem label="Sort by" className="min-w-0">
          <DropdownField
            value={filters.sort}
            options={sortOptions}
            onChange={(value) => handleFilterChange('sort', value)}
            placeholder="Sort by"
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
      aria-controls="request-advanced-filters"
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

  const handleOpenDetailModal = (request: ApiBorrowRequest) => {
    setDetailModalRequest(request);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setDetailModalRequest(null);
    setIsDetailModalOpen(false);
  };

  const handleAction = async (
    request: ApiBorrowRequest,
    action: 'approve' | 'borrow' | 'return' | 'reject' | 'cancel',
    reason?: string
  ) => {
    try {
      setMutatingId(request.id);
      if (action === 'approve') {
        await borrowRequestApi.approve(request.id);
      } else if (action === 'borrow') {
        await borrowRequestApi.borrow(request.id);
      } else if (action === 'return') {
        await borrowRequestApi.return(request.id);
      } else if (action === 'reject') {
        await borrowRequestApi.reject(request.id, { reason });
      } else if (action === 'cancel') {
        await borrowRequestApi.cancel(request.id);
      }
      const actionLabels: Record<typeof action, string> = {
        approve: 'approved',
        borrow: 'borrowed',
        return: 'returned',
        reject: 'rejected',
        cancel: 'cancelled & stock restored',
      };
      toast.success(`Request ${actionLabels[action]} successfully.`);
      await fetchRequests();
      if (action === 'approve' || action === 'reject') {
        setSelectedRequest(null);
      } else if (selectedRequest) {
        const updated = requests.find((item) => item.id === selectedRequest.id);
        if (updated) setSelectedRequest(updated);
      }
    } catch (err) {
      console.error('Failed to update request', err);
      toast.error('Failed to update request. Please try again.');
    } finally {
      setMutatingId(null);
    }
  };

  const tableContent = loading ? <LoadingState message="Loading requests…" /> : error ? <ErrorState message={error} onRetry={fetchRequests} /> : !requests.length ? (
        <EmptyState
          title="No requests found"
          description="No requests match the selected filters."
          variant="dashed"
        />
      ) : (
      <>
        <div className="space-y-3 md:hidden">
          {requests.map(request => <article key={request.id} className="overflow-hidden rounded-2xl border border-[#ead7d3] bg-white shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f1e6e3] bg-[#fffaf7] p-3">
              <h3 className="text-sm font-semibold text-[#57322d]">{request.referenceCode || request.id.slice(-6).toUpperCase()}</h3>
              <span className={'rounded-full px-2.5 py-1 text-xs font-semibold ' + statusMeta[request.status].className}>{statusMeta[request.status].label}</span>
            </header>
            <div className="space-y-3 p-4 text-sm"><p className="text-xs font-semibold text-[#800000]">{request.requestType === 'EQUIPMENT' ? 'Equipment borrowing · intended usage location' : request.requestType === 'LABORATORY' ? 'Laboratory reservation' : request.requestType === 'LEGACY' ? 'Legacy request' : 'Request type unavailable'}</p>
              <div><p className="font-semibold text-[#321d1d]">{request.requesterName}</p><p className="break-all text-xs text-[#786565]">{request.requesterEmail}</p></div>
              <p className="flex items-start gap-2"><MapPin size={17} className="mt-0.5 shrink-0 text-[#9a7b4f]" aria-hidden="true" /><span>{resolveRoom(request)}</span></p>
              <div className="flex items-start gap-2"><CalendarDays size={17} className="mt-0.5 shrink-0 text-[#9a7b4f]" aria-hidden="true" /><p>{formatDate(request.dateNeeded)}<span className="block text-xs text-[#786565]">{formatTimeRange(request.timeStart, request.timeEnd)}</span></p></div>
              <div className="rounded-xl bg-[#faf7f5] p-3"><p className="mb-2 text-xs font-semibold text-[#786565]">Equipment</p><ul className="space-y-1.5 text-xs leading-relaxed">{request.items?.length ? request.items.map(item => <li key={item.id} className="flex items-start justify-between gap-3"><span className="min-w-0 break-words">{item.equipmentName || item.equipment?.name || 'Equipment'}</span><span className="shrink-0 font-semibold">×{item.quantity}</span></li>) : <li>No equipment requested</li>}</ul></div>
            </div>
            <footer className="grid grid-cols-2 gap-2 border-t border-[#f1e6e3] p-3">
              <button type="button" onClick={() => handleOpenDetailModal(request)} className="min-h-11 rounded-xl border border-[#ead7d3] text-xs font-semibold text-[#800000]">View details</button>
              <button type="button" onClick={() => setSelectedRequest(request)} className="min-h-11 rounded-xl bg-[#800000] text-xs font-semibold text-white">{request.status === 'PENDING' ? 'Review request' : 'Manage request'}</button>
            </footer>
          </article>)}
        </div>
        <div className="hidden md:block"><TableContainer>
          <Table>
          <TableHead>
            <TableHeaderCell>Requester</TableHeaderCell>
            <TableHeaderCell>Reservation / usage location</TableHeaderCell>
            <TableHeaderCell>Equipment</TableHeaderCell>
            <TableHeaderCell>Date needed</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell align="right" width="12rem">Actions</TableHeaderCell>
          </TableHead>
            <TableBody>
            {requests.map(request => <RequestTableRow key={request.id} request={request} onOpen={handleOpenDetailModal} onSelect={setSelectedRequest} onAction={handleAction} />)}            </TableBody>
          </Table>
        </TableContainer></div>
        <TablePagination
          currentPage={requestPage}
          pageSize={requestPageSize}
          totalItems={total}
          onPageChange={setRequestPage}
          onPageSizeChange={(size) => {
            setRequestPageSize(size);
            setRequestPage(1);
          }}
        />
      </>
    );

  return (
    <AdminLayout>
      <div className="admin-requests-workspace mx-auto responsive-workspace space-y-4 p-2 lg:p-3">
        <FilterToolbar
          searchValue={filters.search}
          onSearchChange={(value) => handleFilterChange('search', value)}
          searchInFilters
          filters={filtersContent}
          className="mb-1"
          filtersActiveCount={appliedFilters.length}
          defaultFiltersOpen={appliedFilters.length > 0}
          compactFilters
          ribbonSummary={requestRibbonSummary}
          bottomControl={advancedFilterToggle}
          onRefresh={fetchRequests}
          refreshing={loading}
          refreshError={Boolean(error)}
        />

        <section className="rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
          <div className="px-4 py-5 lg:px-6">
            {tableContent}
          </div>
        </section>
      </div>

      <RequestDetailDrawer
        open={Boolean(selectedRequest)}
        request={selectedRequest!}
        onClose={() => setSelectedRequest(null)}
        mutating={mutatingId === selectedRequest?.id}
        onAction={async (action: 'approve' | 'borrow' | 'return' | 'reject' | 'cancel', reason?: string) => {
          if (!selectedRequest) return;
          await handleAction(selectedRequest, action, reason);
        }}
      />

      {detailModalRequest && (
        <TableCellDetailModal
          isOpen={isDetailModalOpen}
          onClose={handleCloseDetailModal}
          title={detailModalRequest.referenceCode || `REQ-${detailModalRequest.id.slice(-6).toUpperCase()}`}
          subtitle="Request details"
          data={{}}
          fields={[]}
          actions={[
            {
              label: 'View Full Request',
              onClick: () => {
                setSelectedRequest(detailModalRequest);
                handleCloseDetailModal();
              },
              variant: 'primary',
            },
          ]}
        >
          <div className="space-y-5 text-sm text-[#514343]">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusMeta[detailModalRequest.status].className}`}>{statusMeta[detailModalRequest.status].label}</span>
              <span className="text-xs text-[#786565]">{statusMeta[detailModalRequest.status].description}</span>
            </div>
            <section className="flex items-start gap-3 rounded-xl bg-[#fff8f3] p-4" aria-label="Requester">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f3e6df] text-[#800000]"><UserRound size={20} aria-hidden="true" /></span>
              <div className="min-w-0"><p className="text-xs text-[#786565]">Requested by</p><p className="mt-1 font-semibold text-[#321d1d]">{detailModalRequest.requesterName}</p><p className="mt-1 break-words text-xs text-[#786565]">{detailModalRequest.requesterRole === 'FACULTY' ? 'Faculty' : detailModalRequest.requesterRole === 'STUDENT' ? 'Student' : 'Administrator'} · {detailModalRequest.requesterEmail}</p></div>
            </section>
            <section aria-label="Booking summary">
              <h3 className="flex items-start gap-2 text-lg font-semibold text-[#321d1d]"><MapPin size={20} className="mt-1 shrink-0 text-[#800000]" aria-hidden="true" />{detailModalRequest.location || [detailModalRequest.room?.roomNumber, detailModalRequest.room?.name].filter(Boolean).join(' – ') || 'No lab reserved'}</h3>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2"><p className="flex items-center gap-2"><CalendarDays size={17} className="text-[#9d6a4e]" aria-hidden="true" />{formatDate(detailModalRequest.dateNeeded)}</p><p className="flex items-center gap-2"><Clock size={17} className="text-[#9d6a4e]" aria-hidden="true" />{formatTimeRange(detailModalRequest.timeStart, detailModalRequest.timeEnd)}</p></div>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-[#786565]">Subject</dt><dd className="mt-1 break-words">{detailModalRequest.subject || 'Not specified'}</dd></div><div><dt className="text-xs text-[#786565]">Program & year</dt><dd className="mt-1 break-words">{[detailModalRequest.programCode || detailModalRequest.program, detailModalRequest.yearLevel].filter(Boolean).join(' - ') || 'Not specified'}</dd></div></dl>
            </section>
            <section className="border-t border-[#ead7d3] pt-4"><h3 className="font-semibold text-[#321d1d]">Equipment <span className="font-normal text-[#786565]">· {detailModalRequest.items?.length || 0} items</span></h3>
              {detailModalRequest.items?.length ? <ul className="mt-2 divide-y divide-[#f1e8e4]">{detailModalRequest.items.map(item => <li key={item.id} className="flex items-start justify-between gap-4 py-2.5"><span className="min-w-0 break-words">{item.equipmentName || item.equipment?.name || 'Equipment'}</span><span className="shrink-0 rounded-md bg-[#f8f2ec] px-2 py-1 text-xs font-semibold text-[#800000]">×{item.quantity}</span></li>)}</ul> : <p className="mt-2 text-[#786565]">No equipment requested</p>}
            </section>
            <section className="border-t border-[#ead7d3] pt-4"><h3 className="font-semibold text-[#321d1d]">Purpose</h3><p className="mt-2 whitespace-pre-wrap break-words">{detailModalRequest.purpose || 'Not specified'}</p></section>
            {(detailModalRequest.rejectionNote || detailModalRequest.notes) && <section className="rounded-xl bg-[#fff8f3] p-4"><h3 className="font-semibold text-[#321d1d]">{detailModalRequest.status === 'REJECTED' ? 'Decline reason' : 'Notes'}</h3><p className="mt-2 whitespace-pre-wrap break-words">{detailModalRequest.rejectionNote || detailModalRequest.notes}</p></section>}
            <section className="border-t border-[#ead7d3] pt-4"><h3 className="font-semibold text-[#321d1d]">Request activity</h3><ol className="mt-3 grid gap-3 sm:grid-cols-2">{[
              { label: 'Submitted', date: detailModalRequest.createdAt },
              { label: 'Approved', date: detailModalRequest.approvedAt },
              { label: 'Borrowed', date: detailModalRequest.borrowedAt },
              { label: 'Returned', date: detailModalRequest.returnedAt },
              { label: 'Declined', date: detailModalRequest.declinedAt },
              { label: 'Cancelled', date: detailModalRequest.cancelledAt },
            ].filter(event => event.date).sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime()).map(event => <li key={event.label} className="border-l-2 border-[#c5ab78] pl-3"><p className="text-xs font-medium text-[#786565]">{event.label}</p><p className="mt-1">{formatDate(event.date!)}</p></li>)}</ol></section>
          </div>
        </TableCellDetailModal>
      )}
    </AdminLayout>
  );
}
