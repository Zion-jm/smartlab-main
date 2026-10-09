import { UserRound, Package, Mail, GraduationCap, MapPin, BookOpen, CalendarDays, Clock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { useScheduleConflictCheck } from '../../hooks/useScheduleConflictCheck';
import EquipmentConflictChecker, { type EquipmentAvailabilitySummary } from '../equipment/EquipmentConflictChecker';
import ConflictStatusCard from '../shared/ConflictStatusCard';
import ConflictDetailModal from '../shared/ConflictDetailModal';
import { formatDate, formatTimeRange, extractTimeString } from '../../utils/dateTime';
import type { BorrowRequestStatus } from '../../types/requests';

type ApiBorrowRequest = {
  requestType?: 'LABORATORY' | 'EQUIPMENT';
  id: string;
  referenceCode?: string;
  requesterName: string;
  requesterEmail: string;
  requesterRole: string;
  requesterAvatar?: string | null;
  program?: string | null;
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
  APPROVED: { label: 'Approved', className: 'bg-[#dcfce7] text-[#166534]', description: 'Approved for use' },
  BORROWED: { label: 'Borrowed', className: 'bg-[#dbeafe] text-[#1d4ed8]', description: 'Currently out' },
  RETURNED: { label: 'Returned', className: 'bg-[#e0f2fe] text-[#0c4a6e]' },
  REJECTED: { label: 'Declined', className: 'bg-[#fee2e2] text-[#b91c1c]' },
  CANCELLED: { label: 'Cancelled', className: 'bg-[#f3f4f6] text-[#4b5563]' },
};

type Props = {
  request: ApiBorrowRequest;
  open: boolean;
  onClose: () => void;
  onAction: (action: 'approve' | 'borrow' | 'return' | 'reject' | 'cancel', reason?: string) => Promise<void>;
  mutating: boolean;
};

export default function RequestDetailDrawer({ request, open, onClose, onAction, mutating }: Props) {
  const [rejectReason, setRejectReason] = useState('');
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [equipmentAvailability, setEquipmentAvailability] = useState<EquipmentAvailabilitySummary[]>([]);
  const [equipmentAvailabilityLoading, setEquipmentAvailabilityLoading] = useState(Boolean(request?.status === 'PENDING' && request.items?.length && request.academicYearId && request.termId && request.dateNeeded && request.timeStart && request.timeEnd));

  const conflictParams = useMemo(() => {
    if (!request) return null;

    if (request.requestType === 'EQUIPMENT') return null;
    let roomId = null;
    if (request.room?.id) {
      roomId = request.room.id;
    } else if (request.location) {
      return null;
    }

    const academicYearId = request.academicYearId;
    const termId = request.termId;
    const dateNeeded = request.dateNeeded;
    const timeStart = extractTimeString(request.timeStart) || undefined;
    const timeEnd = extractTimeString(request.timeEnd) || undefined;

    if (!academicYearId || !termId || !roomId) return null;
    if (!dateNeeded || !timeStart || !timeEnd) return null;

    const params = {
      scheduleType: 'ONE_TIME' as const,
      scheduleDate: dateNeeded,
      dayOfWeek: undefined,
      timeStart,
      timeEnd,
      roomId: roomId || undefined,
      roomLabel: request.location || request.room?.name || request.room?.roomNumber || roomId,
      academicYearId,
      termId,
      excludeRequestId: request.id,
    };

    return params;
  }, [request]);

  const equipmentConflictParams = useMemo(() => {
    if (!request) return null;

    const academicYearId = request.academicYearId;
    const termId = request.termId;
    const date = request.dateNeeded;
    const timeStart = extractTimeString(request.timeStart) || '';
    const timeEnd = extractTimeString(request.timeEnd) || '';

    if (!academicYearId || !termId || !date || !timeStart || !timeEnd) return null;
    if (!request.items || request.items.length === 0) return null;

    return {
      academicYearId,
      termId,
      date,
      timeStart,
      timeEnd,
    };
  }, [request]);

  const conflictCheck = useScheduleConflictCheck(conflictParams);
  const conflictBlocked = conflictCheck.status === 'danger';

  const availabilityEnabled = Boolean(request?.status === 'PENDING' && request.items?.length && request.academicYearId && request.termId && request.dateNeeded && request.timeStart && request.timeEnd);
  const [availabilitySource, setAvailabilitySource] = useState(request);
  if (availabilitySource !== request) {
    setAvailabilitySource(request);
    setEquipmentAvailability([]);
    setEquipmentAvailabilityLoading(availabilityEnabled);
  }
  useEffect(() => {
    if (!availabilityEnabled) return;
    let active = true;
    api.get('/equipment-conflicts/availability', { params: {
      academicYearId: request.academicYearId, termId: request.termId,
      date: request.dateNeeded, timeStart: extractTimeString(request.timeStart), timeEnd: extractTimeString(request.timeEnd),
    }}).then(response => {
      if (active) setEquipmentAvailability(response.data.success ? response.data.data.availability || [] : []);
    }).catch(err => {
      console.error('Equipment availability check error:', err);
      if (active) setEquipmentAvailability([]);
    }).finally(() => { if (active) setEquipmentAvailabilityLoading(false); });
    return () => { active = false; };
  }, [availabilityEnabled, request]);

  const hasEquipmentShortages = useMemo(() => {
    if (!request?.items || equipmentAvailability.length === 0) return false;
    return request.items.some((requestedItem) => {
      const availability = equipmentAvailability.find((avail) => avail.id === requestedItem.equipmentId);
      return availability && availability.available < requestedItem.quantity;
    });
  }, [request, equipmentAvailability]);

  if (!open || !request) return null;

  const statusChip = statusMeta[request.status];
  const canApprove = request.status === 'PENDING';
  const canBorrow = request.status === 'APPROVED' && (request.requestType !== 'LABORATORY' || Boolean(request.items?.length));
  const canReturn = request.status === 'BORROWED' && (request.requestType !== 'LABORATORY' || Boolean(request.items?.length));
  const canCancel = request.status === 'BORROWED' || (request.status === 'APPROVED' && Boolean(request.requestType));
  const canDecline = request.status === 'PENDING' || request.status === 'APPROVED';

  const handleClose = () => {
    setRejectReason('');
    onClose();
  };

  const resolveRoom = () => {
    if (request.room) {
      const roomNumber = request.room.roomNumber?.trim();
      const roomName = request.room.name?.trim();
      const compositeRoom = [roomNumber, roomName].filter(Boolean).join(' – ');
      return compositeRoom || roomNumber || roomName || '—';
    }
    if (request.location) return request.location.replace(' • ', ' – ');
    return '—';
  };

  const actionButtons = [
    canApprove && (
      <button
        key="approve"
        disabled={mutating || conflictBlocked || hasEquipmentShortages || equipmentAvailabilityLoading}
        onClick={() => onAction('approve')}
        className="px-4 py-2 rounded-full bg-[#065f46] text-white text-xs font-semibold disabled:opacity-60"
        title={
          hasEquipmentShortages
            ? 'Cannot approve: insufficient equipment availability'
            : conflictBlocked
            ? 'Cannot approve: schedule conflicts detected'
            : equipmentAvailabilityLoading
            ? 'Checking equipment availability...'
            : 'Approve this request'
        }
      >
        {equipmentAvailabilityLoading ? 'Checking...' : 'Approve request'}
      </button>
    ),
    canBorrow && (
      <button
        key="borrow"
        disabled={mutating}
        onClick={() => onAction('borrow')}
        className="px-4 py-2 rounded-full bg-[#1d4ed8] text-white text-xs font-semibold disabled:opacity-60"
      >
        Mark as borrowed
      </button>
    ),
    canReturn && (
      <button
        key="return"
        disabled={mutating}
        onClick={() => onAction('return')}
        className="px-4 py-2 rounded-full bg-[#0c4a6e] text-white text-xs font-semibold disabled:opacity-60"
      >
        Mark as returned
      </button>
    ),
    canCancel && (
      <button
        key="cancel"
        disabled={mutating}
        onClick={() => onAction('cancel')}
        className="px-4 py-2 rounded-full bg-[#4b5563] text-white text-xs font-semibold disabled:opacity-60"
        title="Cancel this request and release its reservations"
      >
        {request.status === 'BORROWED' ? 'Cancel & restore stock' : 'Cancel reservation'}
      </button>
    ),
    canDecline && (
      <button
        key="decline"
        disabled={mutating || !rejectReason.trim()}
        onClick={() => onAction('reject', rejectReason.trim())}
        className="px-4 py-2 rounded-full bg-[#991b1b] text-white text-xs font-semibold disabled:opacity-60"
      >
        Decline request
      </button>
    ),
  ].filter(Boolean);

  return (
    <div className="admin-mobile-drawer fixed inset-0 z-50 h-dvh">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="request-review-drawer absolute inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl flex flex-col">
        <p className="px-6 pt-4 text-xs font-semibold text-[#800000]">{request.requestType === 'EQUIPMENT' ? 'Equipment borrowing · location is for intended use only' : request.requestType === 'LABORATORY' ? 'Faculty laboratory reservation' : 'Request type unavailable'}</p><div className="request-review-header flex items-center justify-between gap-3 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="request-review-avatar" aria-hidden="true"><UserRound size={23} strokeWidth={1.75} /></span><div className="min-w-0">
            <p className="text-xs uppercase font-semibold text-[#9ca3af]">
              Request #{request.referenceCode ?? request.id.slice(-6)}
            </p>
            <h3 className="text-lg font-semibold text-[#111827]">{request.requesterName}</h3></div>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold ${statusChip.className}`}>
            {statusChip.label}
          </span>
        </div>

        <div className="request-review-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-5">
          {conflictParams && (
            <ConflictStatusCard
              status={conflictCheck.status}
              ready={conflictCheck.ready}
              loading={conflictCheck.loading}
              error={conflictCheck.error}
              hasDetails={conflictCheck.conflicts.length > 0}
              onShowDetails={() => setConflictModalOpen(true)}
            />
          )}

          {equipmentConflictParams && (
            <EquipmentConflictChecker
              academicYearId={equipmentConflictParams.academicYearId}
              termId={equipmentConflictParams.termId}
              date={equipmentConflictParams.date}
              timeStart={equipmentConflictParams.timeStart}
              timeEnd={equipmentConflictParams.timeEnd}
              equipment={request.items!.map((item) => ({
                equipmentId: item.equipmentId,
                quantity: item.quantity,
              }))}
              excludeRequestId={request.id}
              availability={request.status === 'PENDING' ? equipmentAvailability : undefined}
              availabilityLoading={request.status === 'PENDING' && equipmentAvailabilityLoading}
              hasEquipmentShortages={request.status === 'PENDING' && hasEquipmentShortages}
            />
          )}

          <section className="request-review-fields grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-[#374151]">
            <div>
              <p className="request-review-label"><Mail size={14} strokeWidth={1.75} aria-hidden="true" />Email</p>
              <p>{request.requesterEmail}</p>
            </div>
            <div>
              <p className="request-review-label"><GraduationCap size={14} strokeWidth={1.75} aria-hidden="true" />Role</p>
              <p>{request.requesterRole}</p>
            </div>
            <div>
              <p className="request-review-label"><MapPin size={14} strokeWidth={1.75} aria-hidden="true" />Room</p>
              <p>{resolveRoom()}</p>
            </div>
            <div>
              <p className="request-review-label"><BookOpen size={14} strokeWidth={1.75} aria-hidden="true" />Subject</p>
              <p>{request.subject || '—'}</p>
            </div>
            <div>
              <p className="request-review-label"><CalendarDays size={14} strokeWidth={1.75} aria-hidden="true" />Date needed</p>
              <p>{formatDate(request.dateNeeded)}</p>
            </div>
            <div>
              <p className="request-review-label"><Clock size={14} strokeWidth={1.75} aria-hidden="true" />Time</p>
              <p>{formatTimeRange(request.timeStart, request.timeEnd)}</p>
            </div>
          </section>

          <section>
            <p className="request-review-label mb-2"><Package size={15} aria-hidden="true" />Equipment requested</p>
            <div className="request-review-equipment text-sm">
              {request.items?.length ? (
                request.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <span className="text-[#111827]">{item.equipmentName}</span>
                    <span className="request-review-quantity">x{item.quantity}</span>
                  </div>
                ))
              ) : (
                <p className="text-[#6b7280]">No equipment included</p>
              )}
            </div>
          </section>

          <section>
            <p className="text-xs font-semibold text-[#9ca3af] mb-1">Purpose / notes</p>
            <p className="text-sm text-[#374151] bg-[#f9fafb] border border-[#f3f4f6] rounded-2xl p-3">
              {request.purpose || request.notes || 'No additional context provided.'}
            </p>
          </section>

          <section className="grid grid-cols-2 gap-3 text-xs text-[#6b7280]">
            {[
              { label: 'Created', value: formatDate(request.createdAt) },
              { label: 'Approved', value: formatDate(request.approvedAt) },
              { label: 'Borrowed', value: formatDate(request.borrowedAt) },
              { label: 'Returned', value: formatDate(request.returnedAt) },
              { label: 'Cancelled', value: formatDate(request.cancelledAt) },
              { label: 'Declined', value: formatDate(request.declinedAt) },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-[#f3f4f6] bg-[#fdfdfd] px-3 py-2">
                <p className="font-semibold text-[#9ca3af]">{item.label}</p>
                <p className="text-[#111827] text-sm">{item.value}</p>
              </div>
            ))}
          </section>

          {canDecline && (
            <section>
              <label className="text-xs font-semibold text-[#9ca3af] mb-1 block">Reason for declining</label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                className="w-full rounded-2xl border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#800000]"
                placeholder="Provide context for declining (required)"
              />
            </section>
          )}
        </div>

        <div className="request-review-footer px-6 py-4 flex flex-wrap gap-2 justify-between">
          <button
            className="px-4 py-2 text-xs font-semibold text-[#374151] rounded-full border border-[#e5e7eb]"
            onClick={handleClose}
          >
            Close
          </button>
          <div className="flex flex-wrap gap-2">{actionButtons}</div>
        </div>
      </div>

      {conflictModalOpen && (
        <ConflictDetailModal
          conflicts={conflictCheck.conflicts}
          onClose={() => setConflictModalOpen(false)}
        />
      )}
    </div>
  );
}
