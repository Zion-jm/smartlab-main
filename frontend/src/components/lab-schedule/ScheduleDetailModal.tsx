import { CalendarDays, Clock, MapPin } from 'lucide-react';
import TableCellDetailModal from '../shared/TableCellDetailModal';
import type { LabSchedule } from '../../types/labSchedule';

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export default function ScheduleDetailModal({ schedule, onClose }: { schedule: LabSchedule; onClose: () => void }) {
  const weekly = schedule.scheduleType === 'WEEKLY';
  const day = schedule.dayOfWeekIndex != null ? weekdays[schedule.dayOfWeekIndex] : schedule.displayDay;
  const date = schedule.date ? new Date(schedule.date) : null;
  const when = weekly ? `Every ${day}` : date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : `${day}, ${schedule.displayDate}`;
  return <TableCellDetailModal isOpen onClose={onClose} title="Schedule details" subtitle={schedule.subjectLabel || 'Laboratory booking information'} data={schedule} fields={[]}>
    <div className="schedule-detail-summary">
      <span className="inline-flex rounded-full bg-[#f5eae5] px-3 py-1 text-xs font-semibold text-[#800000]">{weekly ? 'Weekly' : 'One-time'}</span>
      <div className="mt-4 flex items-start gap-3">
        <MapPin size={21} className="mt-1 shrink-0 text-[#800000]" aria-hidden="true" />
        <div className="min-w-0"><p className="text-xs text-[#786565]">Room</p><h3 className="mt-1 break-words text-xl font-semibold text-[#321d1d]">{schedule.roomLabel || 'Not assigned'}</h3></div>
      </div>
      <div className="mt-4 space-y-2 text-sm text-[#514343]">
        <p className="flex items-start gap-3"><CalendarDays size={18} className="shrink-0 text-[#9d6a4e]" aria-hidden="true" /><span>{when}</span></p>
        <p className="flex items-start gap-3"><Clock size={18} className="shrink-0 text-[#9d6a4e]" aria-hidden="true" /><span className="font-semibold">{schedule.timeRange}</span></p>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-5 border-t border-[#ead7d3] pt-5 sm:grid-cols-2">
        <div><p className="text-xs text-[#786565]">Section</p><p className="mt-1 break-words text-sm font-semibold text-[#321d1d]">{schedule.programLabel || 'Not assigned'}</p></div>
        <div><p className="text-xs text-[#786565]">Faculty</p><p className="mt-1 break-words text-sm font-semibold text-[#321d1d]">{schedule.facultyName || 'Not assigned'}</p></div>
        <div className="sm:col-span-2"><p className="text-xs text-[#786565]">Academic period</p><p className="mt-1 break-words text-sm text-[#514343]">{[schedule.academicYearLabel, schedule.termLabel].filter(Boolean).join(' · ') || 'Not specified'}</p></div>
      </div>
    </div>
  </TableCellDetailModal>;
}
