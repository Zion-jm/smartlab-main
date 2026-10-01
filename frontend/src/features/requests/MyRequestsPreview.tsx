import DataTable from '../../components/shared/DataTable';
import DropdownField from '../../components/shared/DropdownField';
import { IconActionButton } from '../../components/shared/TableActionButtons';
import type { BorrowRequestStatus } from '../../types/requests';
import { PanelSection } from './PanelSection';
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

  return (
    <PanelSection
      title="My borrow requests"
      helper="Track approvals, status changes, and upcoming borrow requests."
    >
      <div className="flex flex-col gap-3 rounded-xl border border-[#e5e7eb] bg-[#fafafa] p-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-xs font-semibold text-[#6b7280]">
          Search requests
          <input
            type="search"
            value={requestSearch}
            onChange={(event) => setRequestSearch(event.target.value)}
            placeholder="Reference, room, or equipment…"
            className="mt-1 w-full rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-sm font-normal text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#800000]"
          />
        </label>
        <label className="text-xs font-semibold text-[#6b7280]">
          Status
          <DropdownField
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
        </label>
        {(requestSearch || requestStatus !== 'ALL') && (
          <button
            type="button"
            onClick={() => { setRequestSearch(''); setRequestStatus('ALL'); }}
            className="rounded-full border border-[#d1d5db] px-3 py-2 text-xs font-semibold text-[#374151]"
          >
            Clear filters
          </button>
        )}
      </div>
      <DataTable label="My requests" rows={filteredRows} rowKey={request => request.id}
        loading={loading} error={error} onRetry={reload} emptyMessage="No requests match the selected filters."
        columns={[{ id: '0', header: 'Reference', cell: request => <>
                    <p className="font-semibold text-[#111827]">{request.reference}</p>
                    <p className="text-xs text-[#6b7280]">Filed {request.filed}</p>
                  </> },
{ id: '1', header: 'Room', cell: request => <>{request.room}</> },
{ id: '2', header: 'Equipment', cell: request => <>{request.equipment}</> },
{ id: '3', header: 'Date of use', cell: request => <>
                    <p>{request.dateOfUse}</p>
                    <p className="text-xs text-[#9ca3af]">{request.time}</p>
                  </> },
{ id: '4', header: 'Status', cell: request => <>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusStyles[request.status]}`}>
                      {request.status}
                    </span>
                  </> },
{ id: '5', header: 'Actions', action: true, cell: request => <>
                    <div className="flex justify-end items-center gap-2">
                      {request.status === 'PENDING' && (
                        <>
                          <IconActionButton
                            label={`Edit ${request.reference}`}
                            onClick={() => onEdit(request.source)}
                            icon="edit"
                            variant="warning"
                          />
                          <IconActionButton
                            label={cancellingRequestId === request.id ? `Cancelling ${request.reference}` : `Cancel ${request.reference}`}
                            onClick={() => {
                              if (cancellingRequestId === null) void onCancelRequest(request);
                            }}
                            icon="delete"
                            variant="danger"
                            className={cancellingRequestId !== null ? 'opacity-50 pointer-events-none' : ''}
                          />
                        </>
                      )}
                    </div>
                  </> }]}
        pagination={{currentPage:page,pageSize:25,totalItems:total,onPageChange:setPage,onPageSizeChange:()=>{},pageSizeOptions:[25]}}
      />
    </PanelSection>
  );
}
