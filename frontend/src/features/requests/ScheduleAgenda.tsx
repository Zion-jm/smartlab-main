import { minutesFromIso } from '../../components/lab-schedule/scheduleViewUtils';
import { useState } from 'react';
import type { LabSchedule } from '../../types/labSchedule';
import { addCalendarDays, dateToDateKey } from '../../utils/dateTime';

const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateLabel = (key: string) => new Date(key + 'T00:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

export default function ScheduleAgenda({ schedules, range, onSelect }: { schedules: LabSchedule[]; range: {from: string; to: string}; onSelect: (schedule: LabSchedule) => void }) {
  const [start, setStart] = useState(() => range.from || range.to || todayKey());
  const days = Array.from({ length: 7 }, (_, index) => addCalendarDays(start, index)).filter(day => (!range.from || day >= range.from) && (!range.to || day <= range.to));
  const button = 'min-h-11 rounded-xl border border-[#ead7d3] px-4 text-xs font-semibold text-[#800000] hover:bg-[#fffaf7] disabled:opacity-40';
  const goToday = () => { const today = todayKey(); setStart(range.from && today < range.from ? range.from : range.to && today > range.to ? range.to : today); };
  return <div className="p-4 lg:p-5">
    <nav aria-label="Agenda date navigation" className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <p aria-live="polite" className="text-sm font-semibold text-[#57322d]">{days.length ? dateLabel(days[0]) + ' – ' + dateLabel(days[days.length - 1]) : 'No dates in this range'}</p>
      <div className="flex gap-2">
        <button type="button" className={button} disabled={!!range.from && start <= range.from} onClick={() => setStart(range.from && addCalendarDays(start, -7) < range.from ? range.from : addCalendarDays(start, -7))}>Previous 7 days</button>
        <button type="button" className={button} onClick={goToday}>Today</button>
        <button type="button" className={button} disabled={!!range.to && addCalendarDays(start, 6) >= range.to} onClick={() => setStart(addCalendarDays(start, 7))}>Next 7 days</button>
      </div>
    </nav>
    <div className="space-y-4">{days.map(day => {
      const sessions = schedules.filter(item => item.scheduleType === 'WEEKLY' ? item.dayOfWeekIndex === new Date(day + 'T00:00:00Z').getUTCDay() : dateToDateKey(item.date) === day).sort((a, b) => (minutesFromIso(a.startTime) ?? 1440) - (minutesFromIso(b.startTime) ?? 1440));
      return <section key={day} className="grid gap-3 border-t border-[#ead7d3] pt-4 lg:grid-cols-[180px_minmax(0,1fr)]">
        <div><h4 className="text-sm font-semibold text-[#57322d]">{day === todayKey() ? 'Today' : new Date(day + 'T00:00:00Z').toLocaleDateString('en-US', {timeZone:'UTC',weekday:'long'})}</h4><p className="mt-1 text-xs text-[#786565]">{dateLabel(day).split(', ').slice(1).join(', ')}</p><p className="mt-2 text-xs text-[#786565]">{sessions.length} sessions</p></div>
        <div className="space-y-2">{sessions.length ? sessions.map(item => <button key={item.id} type="button" onClick={() => onSelect({...item, displayDate: dateLabel(day)})} className="grid w-full gap-3 rounded-xl border border-[#ead7d3] bg-white p-4 text-left transition hover:bg-[#fffaf7] focus-visible:outline-2 focus-visible:outline-[#800000] xl:grid-cols-[180px_minmax(0,1fr)_auto]">
          <div><p className="text-sm font-semibold text-[#57322d]">{item.timeRange}</p><span className={'mt-2 inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold ' + (item.scheduleType === 'WEEKLY' ? 'bg-blue-50 text-blue-800' : 'bg-red-50 text-[#800000]')}>{item.scheduleType === 'WEEKLY' ? 'Weekly' : 'One-time'}</span></div>
          <div className="min-w-0"><p className="text-sm font-semibold text-[#321d1d]">{item.roomLabel}</p><p className="mt-1 break-words text-sm text-[#57322d]">{item.subjectLabel}</p><p className="mt-1 text-xs text-[#786565]">{item.programLabel} · {item.facultyName}</p></div>
          <span className="self-center text-xs font-semibold text-[#800000]">View details →</span>
        </button>) : <p className="rounded-xl bg-[#faf8f6] p-4 text-xs text-[#786565]">No matching sessions on this date.</p>}</div>
      </section>;
    })}</div>
  </div>;
}
