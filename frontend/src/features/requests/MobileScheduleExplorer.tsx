import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import ControlRibbon from '../../components/shared/ControlRibbon';
import PageTabGroup from '../../components/shared/PageTabGroup';
import DropdownField from '../../components/shared/DropdownField';
import DateRangeFilter from '../../components/shared/DateRangeFilter';
import { useState, type ReactNode } from 'react';
import type { LabSchedule } from '../../types/labSchedule';
import ScheduleDetailModal from '../../components/lab-schedule/ScheduleDetailModal';
import { ChartView } from '../../components/lab-schedule/ScheduleViews';
import type { SchedulesState } from './useRequestData';

const dayKey = (date: Date) => date.toISOString().slice(0, 10);
const shift = (key: string, days: number) => { const date = new Date(key + 'T00:00:00Z'); date.setUTCDate(date.getUTCDate() + days); return dayKey(date); };
const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const label = (key: string) => new Date(key + 'T00:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

export default function MobileScheduleExplorer({ schedules, loading, error, reload, computerLabNames, actions, extraControls, onSelectSchedule, allRooms = false }: Pick<SchedulesState, 'schedules' | 'loading' | 'error' | 'reload'> & Partial<Pick<SchedulesState, 'dateFilter' | 'setDateFilter'>> & { computerLabNames: string[]; actions?: ReactNode; extraControls?: ReactNode; onSelectSchedule?: (id: string) => void; allRooms?: boolean }) {
  const openSchedule = (item: LabSchedule) => { if (onSelectSchedule) onSelectSchedule(item.id); else setSelected(item); };
  const [view, setView] = useState('agenda');
  const [date, setDate] = useState(todayKey);
  const [range, setRange] = useState(() => ({from:todayKey(),to:shift(todayKey(),6)}));
  const [search, setSearch] = useState('');
  const [room, setRoom] = useState('');
  const [selected, setSelected] = useState<LabSchedule | null>(null);
  const rooms = [...new Set(schedules.map(item => item.roomLabel))].sort();
  const filtered = schedules.filter(item => (!room || item.roomLabel === room) && [item.roomLabel, item.subjectLabel, item.facultyName, item.programLabel].join(' ').toLowerCase().includes(search.toLowerCase()));
  const onDay = (key: string) => ((range.from && key < range.from) || (range.to && key > range.to) ? [] : filtered).filter(item => item.scheduleType === 'WEEKLY' ? item.dayOfWeekIndex === new Date(key + 'T00:00:00Z').getUTCDay() : item.date?.slice(0, 10) === key).sort((a,b) => a.startTime.localeCompare(b.startTime));
  const days = Array.from({ length: view === 'calendar' ? 1 : 7 }, (_, i) => shift(date, i)).filter(key => view === 'calendar' || ((!range.from || key >= range.from) && (!range.to || key <= range.to)));
  const monthStart = date.slice(0, 7) + '-01';
  const month = new Date(monthStart + 'T00:00:00Z');
  const count = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const moveMonth = (step: number) => setDate(dayKey(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + step, 1))));
  const shortDate = (key: string) => new Date(key + 'T00:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
  const rangeSummary = range.from && range.to
    ? range.from === range.to ? shortDate(range.from) : range.from.slice(0, 7) === range.to.slice(0, 7) ? new Date(range.from + 'T00:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }) + '–' + Number(range.to.slice(8)) + ', ' + range.to.slice(0, 4) : shortDate(range.from) + ' – ' + shortDate(range.to)
    : range.from ? 'From ' + shortDate(range.from) : range.to ? 'Until ' + shortDate(range.to) : 'All dates';
  const field = 'min-h-11 min-w-0 w-full rounded-xl border border-[#d8c7c3] bg-white px-3 text-sm';
  return <section className="space-y-4 md:hidden">
    <ControlRibbon actions={actions} className="mobile-schedule-ribbon" onRefresh={reload} refreshing={loading} refreshError={Boolean(error)} activeSummary={view === 'timetable' ? (allRooms ? 'Timetable · Selected academic period' : 'Timetable · Active academic period') : rangeSummary + ' · ' + (room || (allRooms ? 'All rooms' : 'All computer labs')) + (search ? ' · Search active' : '')}>
      {extraControls && <div className="mobile-schedule-period">{extraControls}</div>}
      {view === 'timetable' ? <p className="mobile-schedule-guidance">Choose a computer lab in the timetable below. Showing schedules for the {allRooms ? 'selected' : 'active'} academic period.</p> : <div className="schedule-ribbon-filters compact-filter-panel space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#74615e]">Search<input type="search" aria-label="Search schedules" placeholder="Subject, room, or faculty" className={field + ' mt-1 font-normal normal-case'} value={search} onChange={event => setSearch(event.target.value)} /></label>
        <div className="grid grid-cols-1 gap-3">
          <DateRangeFilter value={range} onChange={value => {setRange(value);setDate(value.from || value.to || todayKey());}} className="w-full min-w-0" />
          <DropdownField label={allRooms ? "Room" : "Computer lab"} value={room} onChange={setRoom} options={[{value:'',label:allRooms ? 'All rooms' : 'All computer labs'}, ...rooms.map(name => ({value:name,label:name}))]} />
        </div>
        {(search || room || date !== todayKey()) && <div className="flex justify-end border-t border-[#ead7d3] pt-2"><button type="button" onClick={() => {setSearch('');setRoom('');setDate(todayKey());setRange({from:todayKey(),to:shift(todayKey(),6)});}} className="min-h-11 rounded-lg border border-[#ead7d3] bg-white px-3 text-xs font-semibold text-[#800000]">Reset filters</button></div>}
      </div>}
    </ControlRibbon>
    <PageTabGroup tabs={[{id:'agenda',label:'Agenda'},{id:'calendar',label:'Calendar'},{id:'timetable',label:'Timetable'}]} value={view} onChange={setView} ariaLabel="Schedule views" panelId="mobile-schedule-panel" />
    <div id="mobile-schedule-panel" role="tabpanel">
    {loading ? <p role="status">Loading schedules…</p> : error ? <p role="alert" className="p-3 text-sm text-red-700">{error}</p> : <>
      {view === 'calendar' && <div className="rounded-xl border bg-white p-3">
        <div className="flex items-center justify-between"><button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)} className="h-11 w-11">‹</button><span className="text-sm font-semibold">{month.toLocaleDateString('en-US',{timeZone:'UTC',month:'long',year:'numeric'})}</span><button type="button" aria-label="Next month" onClick={() => moveMonth(1)} className="h-11 w-11">›</button></div>
        <div className="grid grid-cols-7 text-center text-xs">{['Su','Mo','Tu','We','Th','Fr','Sa'].map(name => <span key={name} className="py-2 text-gray-500">{name}</span>)}{Array.from({length:month.getUTCDay()},(_,i)=><span key={'blank'+i} />)}{Array.from({length:count},(_,i)=>{const key=shift(monthStart,i);return <button key={key} type="button" aria-label={label(key)} aria-pressed={date===key} onClick={()=>setDate(key)} className={'min-h-11 rounded-lg ' +(date===key?'bg-[#800000] text-white':'text-[#57322d]')}><span>{i+1}</span><span className="block h-2 text-[8px]" aria-hidden="true">{onDay(key).length ? '●' : ''}</span></button>})}</div>
      </div>}
      {view === 'timetable' ? <div className="overflow-x-auto rounded-xl border bg-white"><p className="p-3 text-xs text-gray-500">{allRooms ? 'Selected academic period' : 'Active academic year and term'} · choose a computer lab to view its schedule.</p><ChartView schedules={schedules} computerLabNames={computerLabNames} onSelectSchedule={id=>{ const item = schedules.find(item=>item.id===id); if (item) openSchedule(item); }} /></div> : <div className="space-y-4">{days.map(key => {const entries=onDay(key);return <section key={key}><h3 className="mb-2 text-sm font-semibold text-[#800000]">{key===todayKey()?'Today · ':''}{label(key)}</h3>{!entries.length ? <p className="rounded-xl bg-white p-3 text-xs text-gray-500">No schedules for this date and filters.</p> : <div className="space-y-2">{entries.map(item=><button key={item.id} type="button" onClick={()=>openSchedule({...item,displayDate:label(key)})} className="w-full rounded-xl border border-[#ead7d3] bg-white p-3 text-left"><span className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold text-[#57322d]">{item.timeRange}</span><span className="rounded-full bg-[#f4eee8] px-2 py-1 text-[11px]">{item.scheduleType==='WEEKLY'?'Weekly':'One time'}</span></span><span className="mt-2 block text-sm font-semibold">{item.roomLabel}</span><span className="block text-sm text-gray-600">{item.subjectLabel}</span><span className="mt-2 block text-xs font-semibold text-[#800000]">View details</span></button>)}</div>}</section>})}</div>}
      {view !== 'timetable' && <nav aria-label="Schedule date navigation" className="sticky bottom-0 z-30 mt-4 rounded-t-xl border border-[#ead7d3] bg-white/95 p-2 pb-[max(.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(76,37,24,0.08)] backdrop-blur-sm">
        <p aria-live="polite" className="mb-2 text-center text-[11px] font-medium text-[#74615e]">{view === 'agenda' ? (days.length ? label(days[0]) + ' – ' + label(days[days.length - 1]) : 'No dates in this range') : label(date)}</p>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2">
          <button type="button" aria-label={view === 'agenda' ? 'Previous 7 days' : 'Previous day'} disabled={!!range.from && date <= range.from} onClick={()=>setDate(shift(date,view==='agenda'?-7:-1))} className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-[#ead7d3] bg-white px-2 text-xs font-semibold text-[#57322d] transition hover:bg-[#fff5f2] focus-visible:outline-2 focus-visible:outline-[#800000] disabled:cursor-not-allowed disabled:bg-[#f8f7f6] disabled:text-[#a8a09e] disabled:opacity-60"><ChevronLeft size={16} aria-hidden="true" />Previous</button>
          <button type="button" onClick={()=>{setDate(todayKey());setRange({from:todayKey(),to:shift(todayKey(),6)});}} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#800000] px-4 text-xs font-semibold text-white transition hover:bg-[#650000] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#800000]"><CalendarDays size={16} aria-hidden="true" />Today</button>
          <button type="button" aria-label={view === 'agenda' ? 'Next 7 days' : 'Next day'} disabled={!!range.to && (view === 'agenda' ? shift(date,6) : date) >= range.to} onClick={()=>setDate(shift(date,view==='agenda'?7:1))} className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-[#ead7d3] bg-white px-2 text-xs font-semibold text-[#57322d] transition hover:bg-[#fff5f2] focus-visible:outline-2 focus-visible:outline-[#800000] disabled:cursor-not-allowed disabled:bg-[#f8f7f6] disabled:text-[#a8a09e] disabled:opacity-60">Next<ChevronRight size={16} aria-hidden="true" /></button>
        </div>
      </nav>}

    </>}
    </div>
    {selected && <ScheduleDetailModal schedule={selected} onClose={()=>setSelected(null)} />}
  </section>;
}
