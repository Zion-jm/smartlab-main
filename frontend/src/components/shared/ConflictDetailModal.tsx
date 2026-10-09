import { useEffect, useId, useRef } from 'react';
import { CalendarX2, TriangleAlert, X } from 'lucide-react';
import type { ScheduleConflict } from '../../hooks/useScheduleConflictCheck';

export type ConflictDetailModalProps = {
  conflicts: ScheduleConflict[];
  onClose: () => void;
};

export function ConflictDetailModal({ conflicts, onClose }: ConflictDetailModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  const detailText = (label: string, value?: unknown) => {
    if (value === null || value === undefined || value === '') return null;
    return <div className="conflict-detail-field"><dt>{label}</dt><dd>{String(value)}</dd></div>;
  };
  return <dialog ref={dialog} aria-labelledby={titleId} className="record-detail-dialog" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="record-detail-shell">
      <header className="record-detail-header">
        <span className="record-detail-symbol"><CalendarX2 size={22} strokeWidth={1.75} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-lg font-bold text-[#451a1a]">Conflict details</h2>
          <p className="mt-1 text-xs leading-5 text-[#786565]">Review overlapping reservations before saving.</p>
        </div>
        <button type="button" autoFocus onClick={onClose} aria-label="Close conflict details" className="record-detail-close"><X size={20} aria-hidden="true" /></button>
      </header>
      <div className="record-detail-body space-y-4">
        {conflicts.map(conflict => {
          const details = conflict.details;
          return <article key={conflict.id} className={`conflict-detail-card conflict-detail-card--${conflict.level}`}>
            <div className="conflict-detail-summary">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#786565]">{conflict.level === 'danger' ? 'Active schedule' : 'Pending request'}</span>
                <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-4 ${conflict.level === 'danger' ? 'border-[#f3caca] bg-[#fff1f1] text-[#a33535]' : 'border-[#ead5ab] bg-[#fff8e8] text-[#94621f]'}`}><TriangleAlert size={14} strokeWidth={1.75} className="shrink-0" aria-hidden="true" /><span>{conflict.level === 'danger' ? 'Schedule conflict' : 'Needs review'}</span></span>
              </div>
              <h3 className="mt-2 text-base font-semibold text-[#451a1a] break-words">{conflict.title}</h3>
              <p className="mt-1 text-xs leading-5 text-[#786565] break-words">{conflict.message}</p>
            </div>
            <dl className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
              {Boolean(details.schedule_type) && detailText('Type', details.schedule_type === 'ONE_TIME' ? 'One-time schedule' : 'Weekly schedule')}
              {detailText('Room', details.location ?? details.room_label)}
              {detailText('Date', details.date_needed)}
              {detailText('Day', details.day_of_week)}
              {detailText('Time', details.time_start && details.time_end ? `${details.time_start} – ${details.time_end}` : undefined)}
              {detailText('Subject', details.subject)}
              {detailText('Faculty', details.faculty_name)}
              {detailText('Requester', details.requester_name)}
              {detailText('Program', details.program)}
              {detailText('Status', details.status)}
            </dl>
          </article>;
        })}
      </div>
      <footer className="record-detail-footer"><button type="button" onClick={onClose} className="record-detail-button">Close</button></footer>
    </div>
  </dialog>;
}
export default ConflictDetailModal;
