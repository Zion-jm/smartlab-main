import type { ScheduleConflict } from '../../hooks/useScheduleConflictCheck';


export type ConflictDetailModalProps = {
  conflicts: ScheduleConflict[];
  onClose: () => void;
};

export function ConflictDetailModal({ conflicts, onClose }: ConflictDetailModalProps) {
  const chipColor = (level: 'warning' | 'danger') =>
    level === 'danger' ? 'text-[#b91c1c]' : 'text-[#9a3412]';

  const detailText = (label: string, value?: unknown) => {
    if (value === null || value === undefined || value === '') return null;
    return (
      <p className="text-xs text-[#4b5563]">
        <span className="font-semibold text-[#111827]">{label}:</span> {String(value)}
      </p>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#f3f4f6] px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-[#111827]">Conflict details</p>
            <p className="text-xs text-[#6b7280]">Review overlapping reservations before saving.</p>
          </div>
          <button type="button" onClick={onClose} className="text-[#6b7280] hover:text-[#111827]">
            ✕
          </button>
        </div>
        <div className="space-y-3 p-5">
          {conflicts.map((conflict) => {
            const details = conflict.details as Record<string, unknown>;
            return (
              <div
                key={conflict.id}
                className={`rounded-2xl border px-4 py-3 ${
                  conflict.level === 'danger' ? 'border-[#fecaca] bg-[#fef2f2]' : 'border-[#fed7aa] bg-[#fff7ed]'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold text-[#111827]">
                  <span>{conflict.level === 'danger' ? 'Active schedule' : 'Pending request'}</span>
                  <span className={chipColor(conflict.level)}>{conflict.level === 'danger' ? 'Danger' : 'Warning'}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-[#111827]">{conflict.title}</p>
                <p className="text-xs text-[#6b7280]">{conflict.message}</p>
                <div className="mt-3 space-y-1">
                  {Boolean(details.schedule_type) && detailText('Type', details.schedule_type === 'ONE_TIME' ? 'One-time schedule' : 'Weekly schedule')}
                  {detailText('Room', details.location ?? details.room_label)}
                  {detailText('Date', details.date_needed)}
                  {detailText('Day', details.day_of_week)}
                  {detailText(
                    'Time',
                    details.time_start && details.time_end ? `${details.time_start} – ${details.time_end}` : undefined
                  )}
                  {detailText('Subject', details.subject)}
                  {detailText('Faculty', details.faculty_name)}
                  {detailText('Requester', details.requester_name)}
                  {detailText('Program', details.program)}
                  {detailText('Status', details.status)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ConflictDetailModal;
