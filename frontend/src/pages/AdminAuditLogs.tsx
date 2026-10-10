import TablePagination from '../components/shared/TablePagination';
import TableCellDetailModal from '../components/shared/TableCellDetailModal';
import { TextActionButton } from '../components/shared/TableActionButtons';
import { isAxiosError } from 'axios';
import DataTable from '../components/shared/DataTable';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, History } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import FilterToolbar from '../components/FilterToolbar';
import DateRangeFilter from '../components/shared/DateRangeFilter';
import { FilterItem } from '../components/shared/FilterGroup';
import { InputField } from '../components/shared/InputField';
import DropdownField from '../components/shared/DropdownField';
import { DEFAULT_TABLE_PAGE_SIZE } from '../components/shared/tablePaginationConstants';
import ResetFiltersButton from '../components/shared/ResetFiltersButton';
import { auditLogsApi, type AuditLog } from '../services/api';
import { toast } from '../stores/toastStore';

const ACTION_OPTIONS = [
  ['ALL', 'All actions'],
  ['CREATE', 'Created'],
  ['UPDATE', 'Updated'],
  ['ROLE_CHANGED', 'Role changed'],
  ['STATUS_CHANGED', 'Status changed'],
  ['DELETE', 'Deleted'],
  ['RETIRE', 'Retired'],
  ['RESTORE', 'Restored'],
  ['APPROVE', 'Approved'],
  ['REJECT', 'Rejected'],
  ['BORROW', 'Marked borrowed'],
  ['RETURN', 'Marked returned'],
  ['CANCEL', 'Cancelled'],
  ['ACTIVATE', 'Activated'],
] as const;

const ENTITY_OPTIONS = [
  ['ALL', 'All entity types'],
  ['User', 'User'],
  ['Equipment', 'Equipment'],
  ['LabSchedule', 'Lab schedule'],
  ['BorrowRequest', 'Borrow request'],
  ['AcademicDirectory', 'Academic directory'],
  ['AcademicPeriod', 'Academic period'],
  ['StudentAcademicRecord', 'Student academic record'],
] as const;

const formatDateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unknown date'
    : date.toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
};

const readableDetails = (details: unknown) => {
  if (details === null || details === undefined) return 'No additional details.';
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return 'Details could not be displayed safely.';
  }
};

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('ALL');
  const [entityType, setEntityType] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const performLoadLogs = useCallback(async () => {
    
      return auditLogsApi.getAll({
        page,
        pageSize,
        search: search.trim() || undefined,
        action: action === 'ALL' ? undefined : action,
        entityType: entityType === 'ALL' ? undefined : entityType,
        from: from || undefined,
        to: to || undefined,
      }).then((response) => {
      setLogs(response.data.logs ?? []);
      setTotal(Number(response.data.total) || 0);
    
    }).catch((requestError) => {
      const detail = isAxiosError(requestError) ? requestError.response?.data?.error : undefined;
      const message = typeof detail === 'string' ? detail : 'Failed to load audit logs.';
      setError(message);
      toast.error(message);
    }).finally(() => {
      setLoading(false);
    });
  }, [action, entityType, from, page, pageSize, search, to]);

  // Automatic loads reset pending state when their query changes; refreshes reset it in the event.
  const loadLogsInputs = [action, entityType, from, page, pageSize, search, to];
  const [loadLogsSource, setloadLogsSource] = useState(loadLogsInputs);
  if (loadLogsInputs.some((value, index) => !Object.is(value, loadLogsSource[index]))) {
    setloadLogsSource(loadLogsInputs);
    setLoading(true);
    setError('');
  }
  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    await performLoadLogs();
  }, [performLoadLogs]);

  useEffect(() => { void performLoadLogs(); }, [performLoadLogs]);

  useEffect(() => {
    if (!selectedLog) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedLog(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedLog]);

  const rangeLabel = useMemo(() => {
    if (!total) return 'No audit log entries';
    return `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`;
  }, [page, pageSize, total]);

  const resetToFirstPage = () => setPage(1);
  const appliedFilters = useMemo(() => {
    const chips: { id: 'search' | 'action' | 'entity' | 'date'; label: string }[] = [];
    if (search.trim()) chips.push({ id: 'search', label: `Search: ${search.trim()}` });
    if (action !== 'ALL') {
      chips.push({ id: 'action', label: `Action: ${ACTION_OPTIONS.find(([value]) => value === action)?.[1] ?? action}` });
    }
    if (entityType !== 'ALL') {
      chips.push({ id: 'entity', label: `Entity: ${ENTITY_OPTIONS.find(([value]) => value === entityType)?.[1] ?? entityType}` });
    }
    if (from || to) chips.push({ id: 'date', label: `Date: ${from || 'Any'} – ${to || 'Any'}` });
    return chips;
  }, [action, entityType, from, search, to]);

  const clearFilters = () => {
    setSearch('');
    setAction('ALL');
    setEntityType('ALL');
    setFrom('');
    setTo('');
    setPage(1);
  };

  const removeFilter = (id: (typeof appliedFilters)[number]['id']) => {
    if (id === 'search') setSearch('');
    if (id === 'action') setAction('ALL');
    if (id === 'entity') setEntityType('ALL');
    if (id === 'date') {
      setFrom('');
      setTo('');
    }
    resetToFirstPage();
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPage(1);
  };

  const activeFilterCount = appliedFilters.length;

  const filtersContent = (
    <div className="compact-filter-panel w-full space-y-3">
      <div className="grid grid-cols-1 items-end gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]">
        <FilterItem label="Search" className="min-w-0">
          <InputField
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetToFirstPage();
            }}
            placeholder="Actor, action, or request code"
            size="md"
            data-testid="input-audit-log-search"
          />
        </FilterItem>
        <FilterItem label="Action" className="min-w-0">
          <DropdownField
            value={action}
            options={ACTION_OPTIONS.map(([value, label]) => ({ value, label }))}
            onChange={(value) => {
              setAction(value);
              resetToFirstPage();
            }}
            placeholder="All actions"
          />
        </FilterItem>
        <FilterItem label="Entity type" className="min-w-0">
          <DropdownField
            value={entityType}
            options={ENTITY_OPTIONS.map(([value, label]) => ({ value, label }))}
            onChange={(value) => {
              setEntityType(value);
              resetToFirstPage();
            }}
            placeholder="All entity types"
          />
        </FilterItem>
      </div>

      <div className="flex flex-col gap-2.5 md:flex-row md:items-end md:justify-start">
        <DateRangeFilter styledDates
          value={{ from, to }}
          onChange={(range) => {
            setFrom(range.from);
            setTo(range.to);
            resetToFirstPage();
          }}
          fromInputProps={{ 'data-testid': 'input-audit-log-from' }}
          toInputProps={{ 'data-testid': 'input-audit-log-to' }}
        />
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
            <ResetFiltersButton onClick={clearFilters} data-testid="button-reset-audit-log-filters" />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <AdminLayout>
      <div className="mx-auto w-full min-w-0 responsive-workspace space-y-4 p-2 lg:p-3" data-testid="page-audit-logs">
        <FilterToolbar
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value);
            resetToFirstPage();
          }}
          searchInFilters
          filters={filtersContent}
          className="mb-1"
          filtersActiveCount={activeFilterCount}
          compactFilters
          ribbonSummary={rangeLabel}
          reserveBottomClearance
          onRefresh={loadLogs}
          refreshing={loading}
          refreshError={Boolean(error)}
        />

      {error && (
        <div role="alert" data-testid="status-audit-logs-error" className="flex items-start gap-3 rounded-2xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => void loadLogs()} data-testid="button-retry-audit-logs" className="font-semibold underline">Retry</button>
        </div>
      )}

        <section className="rounded-2xl border border-[#e5e7eb] bg-white shadow-sm" data-testid="card-audit-log-history">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f3f4f6] px-5 py-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-[#800000]" />
            <div>
              <h2 className="text-sm font-semibold text-[#1f2937]">Administrator activity</h2>
              <p className="mt-1 text-xs text-[#6b7280]">Read-only history of important system changes.</p>
            </div>
          </div>
          <span className="text-xs text-[#6b7280]" data-testid="text-audit-log-range">{rangeLabel}</span>
        </div>
        <div className="px-4 py-5 lg:px-6">
          <div className="md:hidden">
            {loading ? <p role="status" className="py-6 text-center text-sm">Loading audit logs…</p> : error ? null : !logs.length ? <p className="py-6 text-center text-sm text-[#786565]">No audit log entries match the selected filters.</p> : <>
              <div className="space-y-3">{logs.map(log => <article key={log.id} className="overflow-hidden rounded-2xl border border-[#ead7d3] bg-white">
                <header className="space-y-2 border-b border-[#f1e6e3] bg-[#fffaf7] p-3"><span className="inline-flex rounded-full bg-[#f5eae5] px-2.5 py-1 text-xs font-semibold text-[#800000]">{log.actionLabel || log.action}</span><p className="text-xs text-[#786565]">{formatDateTime(log.createdAt)}</p></header>
                <div className="space-y-3 p-4"><div><h3 className="break-words text-sm font-semibold text-[#321d1d]">{log.actor?.name || 'Unknown actor'}</h3><p className="mt-1 break-all text-xs text-[#786565]">{log.actor?.email || 'No email'}</p></div><p className="break-words text-sm leading-relaxed text-[#514343]">{log.summary || 'No summary available.'}</p><div className="rounded-xl bg-[#faf7f5] p-3"><p className="text-xs font-semibold text-[#786565]">{log.entityLabel || log.entityType}</p><p className="mt-1 break-all text-xs text-[#514343]">{log.recordReference || log.entityId}</p></div></div>
                <footer className="border-t border-[#f1e6e3] p-3"><button type="button" onClick={() => setSelectedLog(log)} className="min-h-11 w-full rounded-xl border border-[#ead7d3] text-xs font-semibold text-[#800000]">View recorded changes</button></footer>
              </article>)}</div>
              <TablePagination currentPage={page} pageSize={pageSize} totalItems={total} onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />
            </>}
          </div>
          <div className="hidden md:block"><DataTable label="Administrator activity" rows={logs} rowKey={log=>log.id} rowTestId={log=>'row-audit-log-'+log.id}
            loading={loading} error={error} onRetry={()=>void loadLogs()} emptyMessage="No audit log entries match the selected filters."
            columns={[{id:'0',header:'Actor',cell:log=><>
                        <div className="font-semibold text-[#1f2937]" data-testid={`value-audit-log-actor-${log.id}`}>{log.actor?.name || 'Unknown actor'}</div>
                        <div className="text-xs text-[#6b7280]">{log.actor?.email || 'No email'}</div>
                      </>},
{id:'1',header:'Action',cell:log=><><span className="inline-flex rounded-full bg-[#fff5f5] px-2.5 py-1 text-xs font-semibold text-[#800000]">{log.actionLabel || log.action}</span></>},
{id:'2',header:'Entity',cell:log=><>
                        <div className="font-medium text-[#374151]">{log.entityLabel || log.entityType}</div>
                        <div className="max-w-[180px] truncate text-xs text-[#6b7280]" title={log.entityId}>{log.recordReference || log.entityId}</div>
                      </>},
{id:'3',header:'Date / time',cell:log=><>{formatDateTime(log.createdAt)}</>},
{id:'4',header:'Summary',cell:log=><>{log.summary || 'No summary available.'}</>},
{id:'5',header:'Details',action:true,cell:log=><>
                        <TextActionButton label="View details" icon="view" onClick={() => setSelectedLog(log)} data-testid={`button-view-audit-log-${log.id}`} />
                      </>}]}
            pagination={{currentPage:page,pageSize,totalItems:total,onPageChange:setPage,onPageSizeChange:handlePageSizeChange}} /></div>

        </div>
        </section>

      {selectedLog && <TableCellDetailModal
        testId="dialog-audit-log-details" closeTestId="button-close-audit-log-details" dismissTestId="button-dismiss-audit-log-details"
        isOpen onClose={() => setSelectedLog(null)} title="Audit log details" subtitle={selectedLog.summary} data={selectedLog}
        fields={[
          { key: 'actor', label: 'Actor', section: 'Activity', formatter: () => [selectedLog.actor?.name || 'Unknown', selectedLog.actor?.email || 'No email'].join(' · ') },
          { key: 'createdAt', label: 'Date / time', section: 'Activity', formatter: () => formatDateTime(selectedLog.createdAt) },
          { key: 'action', label: 'Action', section: 'Activity', formatter: () => selectedLog.actionLabel || selectedLog.action },
          { key: 'entityId', label: 'Entity reference', section: 'Activity', formatter: () => [selectedLog.entityLabel, selectedLog.entityId].join(' · ') },
          { key: 'details', label: 'Recorded changes', section: 'Details', fullWidth: true, formatter: () => <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-[#f8f5f5] p-4 text-xs leading-relaxed" data-testid="value-audit-log-details">{readableDetails(selectedLog.details)}</pre> },
        ]}
      />}
      </div>
    </AdminLayout>
  );
}
