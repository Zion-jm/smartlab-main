import { useState } from 'react';
import { CalendarDays, MapPin, Package, ClipboardList, RefreshCw, Info } from 'lucide-react';
import MyRequestDetailModal from './MyRequestDetailModal';
import DataTable from '../../components/shared/DataTable';
import DropdownField from '../../components/shared/DropdownField';
import { IconActionButton } from '../../components/shared/TableActionButtons';
import type { BorrowRequestStatus } from '../../types/requests';
import { type ApiBorrowRequest, type RequestRow } from './requestModels';
import { type RequestsHookState } from './useRequestData';

export function MyRequestsPreview({
  page, setPage, total, requestSearch, setRequestSearch, requestStatus, setRequestStatus,
  rows,
  loading,
  error,
  reload,
  onEdit,
  onCancelRequest,
  cancellingRequestId,
}: RequestsHookState & {
  onEdit: (request: ApiBorrowRequest) => void;
  onCancelRequest: (request: RequestRow) => void | Promise<void>;
  cancellingRequestId: string | null;
}) {
  const statusStyles: Record<RequestRow['status'], string> = {
    APPROVED: 'bg-[#dcfce7] text-[#166534]',
    BORROWED: 'bg-[#dbeafe] text-[#1d4ed8]',
    CANCELLED: 'bg-[#f3f4f6] text-[#4b5563]',
    PENDING: 'bg-[#fef3c7] text-[#92400e]',
    REJECTED: 'bg-[#fee2e2] text-[#b91c1c]',
    RETURNED: 'bg-[#e0f2fe] text-[#0c4a6e]',
  };
  const filteredRows = rows;
  const [selected, setSelected] = useState<RequestRow | null>(null);
  const statusLabel = (status: RequestRow['status']) => status === 'REJECTED' ? 'Declined' : status.charAt(0) + status.slice(1).toLowerCase();
  const pages = Math.max(1, Math.ceil(total / 10));

  return (
    <div className="space-y-4">
      <section aria-labelledby="my-requests-heading" className="rounded-2xl border border-[#ead7d3] bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-t-2xl border-b border-[#ead7d3] bg-[#fffaf7] p-4 lg:px-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f4e9e5] text-[#800000]"><ClipboardList size={20} aria-hidden="true" /></span>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.16em] text-[#9a7b4f]">Request tracking</p>
              <h2 id="my-requests-heading" className="text-lg font-semibold text-[#57322d]">My requests</h2>
              <p className="mt-1 text-xs text-[#786565]">Track your submissions, check approval status, and review request details.</p>
            </div>
          </div>
          <button type="button" onClick={() => void reload()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d8c7c2] bg-white px-4 text-sm font-semibold text-[#800000] disabled:opacity-50">
            <RefreshCw size={16} aria-hidden="true" className={loading ? 'animate-spin' : ''} />{loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </header>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end lg:px-5">
        <label className="min-w-0 flex-1 text-xs font-semibold text-[#57322d] sm:min-w-[240px] lg:max-w-[480px]">
          Search requests
          <input
            type="search"
            value={requestSearch}
            onChange={(event) => setRequestSearch(event.target.value)}
            placeholder="Reference, room, or equipment…"
            className="mt-1 min-h-11 w-full rounded-xl border border-[#d8c7c2] bg-white px-3 py-2 text-sm font-normal text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#800000]"
          />
        </label>
        <div className="w-full text-xs font-semibold text-[#57322d] sm:w-52">
          <DropdownField
            label="Status"
            value={requestStatus}
            options={[
              { value: 'ALL', label: 'All statuses' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'BORROWED', label: 'Borrowed' },
              { value: 'RETURNED', label: 'Returned' },
              { value: 'REJECTED', label: 'Declined' },
              { value: 'CANCELLED', label: 'Cancelled' },
            ]}
            onChange={(value) => setRequestStatus(value as BorrowRequestStatus | 'ALL')}
            placeholder="All statuses"
          />
        </div>
        {(requestSearch || requestStatus !== 'ALL') && (
          <button
            type="button"
            onClick={() => { setRequestSearch(''); setRequestStatus('ALL'); }}
            className="min-h-11 rounded-xl border border-[#d8c7c2] px-3 py-2 text-xs font-semibold text-[#800000]"
          >
            Clear filters
          </button>
        )}
        </div>
        <div className="flex items-start gap-2 border-t border-[#f1e6e3] px-4 py-3 text-xs leading-relaxed text-[#786565] lg:px-5">
          <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[#9a7b4f]" />
          <p>You can edit pending requests and cancel pending or approved requests. Open a request to review its full details.</p>
        </div>
      </section>
      <section aria-labelledby="request-history-heading" className="rounded-2xl border border-[#ead7d3] bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-2 rounded-t-2xl border-b border-[#ead7d3] bg-[#fffaf7] px-4 py-4 lg:px-5">
          <div>
            <h3 id="request-history-heading" className="text-sm font-semibold text-[#57322d]">Request history</h3>
            <p className="mt-1 text-xs text-[#786565]">{requestStatus === 'ALL' ? 'All statuses' : statusLabel(requestStatus)}{requestSearch.trim() ? ' / Search applied' : ''}</p>
          </div>
          <span role="status" className="rounded-full bg-[#f4e9e5] px-3 py-1 text-xs font-semibold text-[#800000]">{loading ? 'Loading...' : error ? 'Unavailable' : `${total} matching ${total === 1 ? 'request' : 'requests'}`}</span>
        </header>
      <div className="space-y-3 p-4 md:hidden" aria-live="polite">
        {loading ? <p className="py-6 text-center text-sm">Loading requests…</p> : error ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}<button type="button" onClick={() => void reload()} className="ml-2 min-h-11 underline">Retry</button></div> : !rows.length ? <p className="py-6 text-center text-sm text-gray-500">No requests match the selected filters.</p> : rows.map(request => {
          const items = request.source.items ?? [];
          return <article key={request.id} className="overflow-hidden rounded-xl border border-[#ead7d3] bg-white">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f1e6e3] bg-[#fffaf7] px-3 py-3">
              <h3 className="text-sm font-semibold text-[#57322d]">{request.reference}</h3>
              <span className={'whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ' + statusStyles[request.status]}>{statusLabel(request.status)}</span>
            </header>
            <div className="space-y-3 p-3 text-sm">
              <p className="flex items-start gap-2 font-semibold"><MapPin size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-[#9a7b4f]" />{request.room}</p>
              <p className="flex items-start gap-2"><CalendarDays size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-[#9a7b4f]" /><span>{request.dateOfUse}<span className="block text-xs text-gray-500">{request.time}</span></span></p>
              <div className="flex items-start gap-2"><Package size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-[#9a7b4f]" /><div className="min-w-0 text-xs leading-relaxed text-gray-600">{items.length ? items.slice(0, 2).map(item => (item.equipment?.name || 'Equipment') + ' ×' + item.quantity).join(', ') : 'No equipment requested'}{items.length > 2 && <button type="button" onClick={() => setSelected(request)} className="block min-h-11 font-semibold text-[#800000]">+{items.length - 2} more</button>}</div></div>
            </div>
            <footer className="flex items-center justify-between gap-2 border-t border-[#f1e6e3] px-3 py-2">
              <button type="button" onClick={() => setSelected(request)} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-[#800000]">View details</button>
              {(request.status === 'PENDING' || request.status === 'APPROVED') && <div className="flex gap-2">{request.status === 'PENDING' && <IconActionButton label={'Edit ' + request.reference} onClick={() => onEdit(request.source)} icon="edit" variant="warning" />}<IconActionButton label={'Cancel ' + request.reference} onClick={() => { if (cancellingRequestId === null) void onCancelRequest(request); }} icon="cancel" variant="danger" disabled={cancellingRequestId !== null} busy={cancellingRequestId === request.id} /></div>}
            </footer>
          </article>;
        })}
        {!loading && !error && total > 0 && <nav aria-label="Request pages" className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs"><span>{(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="min-h-11 rounded-lg border px-3 disabled:opacity-40">Previous</button><button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="min-h-11 rounded-lg border px-3 disabled:opacity-40">Next</button></div></nav>}
      </div>
      {selected && <MyRequestDetailModal key={selected.id} request={selected} onClose={() => setSelected(null)} />}
      <div className="hidden md:block">
      <DataTable embedded label="My requests" rows={filteredRows} rowKey={request => request.id}
        loading={loading} error={error} onRetry={reload} emptyMessage="No requests match the selected filters."
        columns={[{ id: '0', header: 'Reference', cell: request => <>
                    <p className="font-semibold text-[#111827]">{request.reference}</p>
                    <p className="text-xs text-[#6b7280]">Filed {request.filed}</p>
                  </> },
{ id: '1', header: 'Location', cell: request => <>{request.room}</> },
{ id: '2', header: 'Equipment', cell: request => <>{request.equipment}</> },
{ id: '3', header: 'Date of use', cell: request => <>
                    <p>{request.dateOfUse}</p>
                    <p className="text-xs text-[#9ca3af]">{request.time}</p>
                  </> },
{ id: '4', header: 'Status', cell: request => <>
                    <span className={`inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusStyles[request.status]}`}>
                      {statusLabel(request.status)}
                    </span>
                  </> },
{ id: '5', header: 'Actions', action: true, cell: request => <>
                    <div className="flex justify-end items-center gap-2">
                      <IconActionButton label={`View details for ${request.reference}`} icon="view" onClick={() => setSelected(request)} />
                      {(request.status === 'PENDING' || request.status === 'APPROVED') && (
                        <>
                          {request.status === 'PENDING' &&                           <IconActionButton
                            label={`Edit ${request.reference}`}
                            onClick={() => onEdit(request.source)}
                            icon="edit"
                            variant="warning"
                          />}
                          <IconActionButton
                            label={cancellingRequestId === request.id ? `Cancelling ${request.reference}` : `Cancel ${request.reference}`}
                            onClick={() => {
                              if (cancellingRequestId === null) void onCancelRequest(request);
                            }}
                            icon="cancel"
                            variant="danger"
                            disabled={cancellingRequestId !== null} busy={cancellingRequestId === request.id}
                          />
                        </>
                      )}
                    </div>
                  </> }]}
        pagination={{currentPage:page,pageSize:10,totalItems:total,onPageChange:setPage,onPageSizeChange:()=>{},pageSizeOptions:[10]}}
      />
      </div>
      </section>
    </div>
  );
}
