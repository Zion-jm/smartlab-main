import { dateToDateKey, dateKeyToPickerDate, manilaTodayForPicker } from '../../utils/dateTime';
import { useMemo, useState } from 'react';
import type { EquipmentItem } from '../../types/equipment';
import type { BorrowRequest, BorrowRequestStatus } from '../../types/requests';
import { formatTimeRange } from '../../utils/dateTime';

type EquipmentUsageCalendarProps = {
  equipment: EquipmentItem[];
  requests: BorrowRequest[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

type CalendarCell = {
  date: Date;
  inCurrentMonth: boolean;
  requests: BorrowRequest[];
};

const usageStatuses: BorrowRequestStatus[] = ['PENDING', 'APPROVED', 'BORROWED', 'RETURNED'];

const statusMeta: Record<
  BorrowRequestStatus,
  { label: string; className: string; dotClassName: string }
> = {
  PENDING: {
    label: 'Pending',
    className: 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]',
    dotClassName: 'bg-[#d97706]',
  },
  APPROVED: {
    label: 'Approved',
    className: 'bg-[#dbeafe] text-[#1d4ed8] border-[#bfdbfe]',
    dotClassName: 'bg-[#2563eb]',
  },
  BORROWED: {
    label: 'Borrowed',
    className: 'bg-[#dcfce7] text-[#166534] border-[#bbf7d0]',
    dotClassName: 'bg-[#16a34a]',
  },
  RETURNED: {
    label: 'Returned',
    className: 'bg-[#e0f2fe] text-[#0c4a6e] border-[#bae6fd]',
    dotClassName: 'bg-[#0284c7]',
  },
  REJECTED: {
    label: 'Declined',
    className: 'bg-[#fee2e2] text-[#b91c1c] border-[#fecaca]',
    dotClassName: 'bg-[#dc2626]',
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-[#f3f4f6] text-[#4b5563] border-[#e5e7eb]',
    dotClassName: 'bg-[#6b7280]',
  },
};

const sameDay = (first: Date, second: Date) =>
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate();

const getMonthLabel = (date: Date) =>
  date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

const getRequestDate = (request: BorrowRequest) => {
  return dateKeyToPickerDate(dateToDateKey(request.dateNeeded));
};

const getEquipmentNames = (request: BorrowRequest, selectedEquipmentId: string) => {
  const items = (request.items ?? []).filter((item) =>
    selectedEquipmentId ? item.equipmentId === selectedEquipmentId : true
  );
  return items;
};

export default function EquipmentUsageCalendar({
  equipment,
  requests,
  loading,
  error,
  onRetry,
}: EquipmentUsageCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = manilaTodayForPicker();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const equipmentNames = useMemo(
    () => new Map(equipment.map((item) => [item.id, item.name])),
    [equipment]
  );

  const usageRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          usageStatuses.includes(request.status) &&
          Boolean(getRequestDate(request)) &&
          getEquipmentNames(request, selectedEquipmentId).length > 0
      ),
    [requests, selectedEquipmentId]
  );

  const startDayOfGrid = useMemo(() => {
    const start = new Date(currentMonth);
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
    return start;
  }, [currentMonth]);

  const endDayOfGrid = useMemo(() => {
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    end.setHours(0, 0, 0, 0);
    while (end.getDay() !== 6) end.setDate(end.getDate() + 1);
    return end;
  }, [currentMonth]);

  const calendarCells = useMemo<CalendarCell[]>(() => {
    const totalDays =
      Math.round((endDayOfGrid.getTime() - startDayOfGrid.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Array.from({ length: totalDays }, (_, index) => {
      const date = new Date(startDayOfGrid);
      date.setDate(startDayOfGrid.getDate() + index);
      return {
        date,
        inCurrentMonth:
          date.getFullYear() === currentMonth.getFullYear() &&
          date.getMonth() === currentMonth.getMonth(),
        requests: usageRequests.filter((request) => {
          const requestDate = getRequestDate(request);
          return requestDate ? sameDay(requestDate, date) : false;
        }),
      };
    });
  }, [currentMonth, endDayOfGrid, startDayOfGrid, usageRequests]);

  const today = useMemo(() => {
    const now = manilaTodayForPicker();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const selectedDayRequests = useMemo(() => {
    if (!selectedDate) return [];
    return usageRequests.filter((request) => {
      const requestDate = getRequestDate(request);
      return requestDate ? sameDay(requestDate, selectedDate) : false;
    });
  }, [selectedDate, usageRequests]);

  const summary = useMemo(() => {
    const units = usageRequests.reduce(
      (total, request) =>
        total +
        getEquipmentNames(request, selectedEquipmentId).reduce((sum, item) => sum + item.quantity, 0),
      0
    );
    const equipmentCount = new Set(
      usageRequests.flatMap((request) =>
        getEquipmentNames(request, selectedEquipmentId).map((item) => item.equipmentId)
      )
    ).size;
    return { requests: usageRequests.length, units, equipmentCount };
  }, [selectedEquipmentId, usageRequests]);

  const getRequestEquipmentLabel = (request: BorrowRequest) => {
    const items = getEquipmentNames(request, selectedEquipmentId);
    if (!items.length) return 'Equipment';
    if (selectedEquipmentId) {
      return `${equipmentNames.get(items[0].equipmentId) ?? items[0].equipmentName} × ${items[0].quantity}`;
    }
    const first = `${items[0].equipmentName} × ${items[0].quantity}`;
    return items.length > 1 ? `${first} +${items.length - 1}` : first;
  };

  if (loading) {
    return <div className="px-4 lg:px-6 py-12 text-center text-sm text-[#6b7280]">Loading equipment usage…</div>;
  }

  if (error) {
    return (
      <div className="px-4 lg:px-6 py-12 text-center">
        <p className="text-sm text-[#b91c1c]">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-full border border-[#d1d5db] px-4 py-2 text-xs font-semibold text-[#374151]"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6 py-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Usage requests</p>
          <p className="text-2xl font-bold text-[#111827]">{summary.requests}</p>
          <p className="text-xs text-[#6b7280]">Pending, approved, borrowed, or returned</p>
        </div>
        <div className="rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Units scheduled</p>
          <p className="text-2xl font-bold text-[#111827]">{summary.units}</p>
          <p className="text-xs text-[#6b7280]">Across the visible requests</p>
        </div>
        <div className="rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Equipment tracked</p>
          <p className="text-2xl font-bold text-[#111827]">{summary.equipmentCount}</p>
          <p className="text-xs text-[#6b7280]">Items with scheduled usage</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3">
        <div>
          <h3 className="text-base font-semibold text-[#111827]">{getMonthLabel(currentMonth)}</h3>
          <p className="text-xs text-[#6b7280]">Select a day to review equipment usage.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="equipment-usage-filter" className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
            Equipment
          </label>
          <select
            id="equipment-usage-filter"
            value={selectedEquipmentId}
            onChange={(event) => setSelectedEquipmentId(event.target.value)}
            className="max-w-[220px] rounded-xl border border-[#d1d5db] px-3 py-2 text-xs font-semibold text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#800000]"
          >
            <option value="">All equipment</option>
            {equipment.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              const now = manilaTodayForPicker();
              setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
            className="rounded-full border border-[#d1d5db] px-3 py-1.5 text-xs font-semibold text-[#374151] hover:border-[#9ca3af]"
          >
            Today
          </button>
          <div className="flex items-center rounded-full border border-[#d1d5db]">
            <button
              type="button"
              onClick={() => setCurrentMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() - 1, 1))}
              className="px-3 py-1.5 text-[#374151] hover:text-[#111827]"
              aria-label="Previous month"
            >
              ‹
            </button>
            <div className="h-4 w-px bg-[#e5e7eb]" />
            <button
              type="button"
              onClick={() => setCurrentMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() + 1, 1))}
              className="px-3 py-1.5 text-[#374151] hover:text-[#111827]"
              aria-label="Next month"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-[#6b7280]">
        {(['PENDING', 'APPROVED', 'BORROWED', 'RETURNED'] as BorrowRequestStatus[]).map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${statusMeta[status].dotClassName}`} />
            {statusMeta[status].label}
          </span>
        ))}
      </div>

      {usageRequests.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#d1d5db] px-4 py-8 text-center text-sm text-[#6b7280]">
          No equipment usage requests match this filter yet.
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-[#e5e7eb] bg-white">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-7 border-b border-[#f3f4f6] text-center text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
              <div key={label} className="py-2">{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-[#f3f4f6]">
            {calendarCells.map(({ date, inCurrentMonth, requests: dayRequests }) => {
              const isToday = sameDay(date, today);
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  className={`min-h-[125px] rounded-xl border border-white bg-white p-2 text-left transition hover:border-[#cbd5f5] ${
                    inCurrentMonth ? 'text-[#111827]' : 'text-[#9ca3af]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-sm">{date.getDate()}</span>
                    {isToday && <span className="text-[10px] text-[#b91c1c]">Today</span>}
                  </div>
                  <div className="mt-2 space-y-1">
                    {dayRequests.slice(0, 3).map((request) => {
                      const meta = statusMeta[request.status];
                      return (
                        <div
                          key={request.id}
                          className={`truncate rounded-lg border px-2 py-1 text-[10px] font-semibold ${meta.className}`}
                          title={`${getRequestEquipmentLabel(request)} — ${request.requesterName}`}
                        >
                          {getRequestEquipmentLabel(request)}
                        </div>
                      );
                    })}
                    {dayRequests.length > 3 && (
                      <div className="text-[10px] font-semibold text-[#6b7280]">+{dayRequests.length - 3} more</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selectedDate && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4" onClick={() => setSelectedDate(null)}>
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#f3f4f6] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#111827]">
                  {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="text-xs text-[#6b7280]">
                  {selectedDayRequests.length} usage request{selectedDayRequests.length === 1 ? '' : 's'}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedDate(null)} className="text-[#6b7280] hover:text-[#111827]">
                ✕
              </button>
            </div>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto px-4 py-4">
              {selectedDayRequests.length === 0 ? (
                <p className="py-6 text-center text-xs text-[#9ca3af]">No equipment usage on this day.</p>
              ) : (
                selectedDayRequests.map((request) => {
                  const meta = statusMeta[request.status];
                  return (
                    <div key={request.id} className="rounded-2xl border border-[#e5e7eb] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.className}`}>
                          {meta.label}
                        </span>
                        <span className="text-xs font-semibold text-[#6b7280]">
                          {formatTimeRange(request.timeStart, request.timeEnd)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-[#111827]">{request.requesterName}</p>
                      <p className="text-xs text-[#6b7280]">{request.location || 'Location not specified'}</p>
                      <div className="mt-3 space-y-1 border-t border-[#f3f4f6] pt-2">
                        {getEquipmentNames(request, selectedEquipmentId).map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-3 text-xs text-[#374151]">
                            <span>{equipmentNames.get(item.equipmentId) ?? item.equipmentName}</span>
                            <span className="font-semibold">× {item.quantity}</span>
                          </div>
                        ))}
                      </div>
                      {request.purpose && <p className="mt-2 text-xs text-[#6b7280]">Purpose: {request.purpose}</p>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}