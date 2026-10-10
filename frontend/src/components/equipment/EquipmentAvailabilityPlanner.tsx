import { CalendarDays, Search, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { StyledDatePicker } from '../shared/StyledDatePicker';
import DropdownField from '../shared/DropdownField';
import { manilaTodayForPicker, formatDate, formatTimeRange } from '../../utils/dateTime';

type PlanningRequest = { id: string; academicYearId: string; termId: string; reference: string; requester: string; quantity: number; status: string; dateNeeded: string; timeStart: string | null; timeEnd: string | null; location: string };
type PlanningRow = { id: string; name: string; archived: boolean; usable: number; checkedOut: number; reserved: number; available: number; pending: number; requests: PlanningRequest[] };
const times = Array.from({ length: 28 }, (_, i) => { const minutes = 450 + i * 30; const value = String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0'); return { value, label: (Math.floor(minutes / 60) % 12 || 12) + ':' + String(minutes % 60).padStart(2, '0') + (minutes < 720 ? ' AM' : ' PM') }; });
const dateKey = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');

export default function EquipmentAvailabilityPlanner() {
  const [date, setDate] = useState<Date | null>(manilaTodayForPicker);
  const [mode, setMode] = useState('day');
  const [start, setStart] = useState('07:30');
  const [end, setEnd] = useState('09:00');
  const [query, setQuery] = useState<{ date: string; timeStart?: string; timeEnd?: string } | null>(null);
  const [rows, setRows] = useState<PlanningRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    if (!query) return;
    let active = true;
    api.get('/equipment-conflicts/planning', { params: query }).then(response => {
      if (active) setRows(response.data.data);
    }).catch(() => { if (active) setError('Could not check availability. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query]);
  const changed = !query || !date || query.date !== dateKey(date) || query.timeStart !== (mode === 'time' ? start : undefined) || query.timeEnd !== (mode === 'time' ? end : undefined);
  return <section className="space-y-4 rounded-2xl border border-[#ead7d3] bg-white p-4 shadow-sm sm:p-5">
    <header className="-mx-4 -mt-4 flex items-center gap-3 rounded-t-2xl border-b border-[#ead7d3] bg-[#fffaf7] p-4 sm:-mx-5 sm:-mt-5 sm:p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#800000] text-white shadow-sm"><CalendarDays size={22} aria-hidden="true" /></span>
      <div><h2 className="text-base font-semibold text-[#321d1d]">Equipment availability</h2><p className="mt-1 text-xs text-[#786565]">Plan equipment use for a day or a specific time. All times are in Manila time.</p></div>
    </header>
    <form className="grid grid-cols-2 items-end gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={event => {
      event.preventDefault();
      if (!date || (mode === 'time' && end <= start)) { setError('Select a date and an end time later than the start.'); return; }
      setError(''); setLoading(true); setExpanded(null);
      setQuery({ date: dateKey(date), ...(mode === 'time' ? { timeStart: start, timeEnd: end } : {}) });
    }}>
      <div className="col-span-2 min-w-0 sm:col-span-1"><p className="mb-2 text-xs font-semibold text-[#786565]">Date</p><StyledDatePicker browsing value={date} onChange={setDate} /></div>
      <div className="col-span-2 min-w-0 sm:col-span-1"><p className="mb-2 text-xs font-semibold text-[#786565]">Time coverage</p><DropdownField value={mode} onChange={setMode} options={[{ value: 'day', label: 'Whole day' }, { value: 'time', label: 'Specific time' }]} /></div>
      <div className="min-w-0"><p className="mb-2 text-xs font-semibold text-[#786565]">From</p><DropdownField disabled={mode === 'day'} value={mode === 'day' ? '00:00' : start} onChange={setStart} options={mode === 'day' ? [{ value: '00:00', label: '12:00 AM' }] : times} /></div><div className="min-w-0"><p className="mb-2 text-xs font-semibold text-[#786565]">To</p><DropdownField disabled={mode === 'day'} value={mode === 'day' ? '24:00' : end} onChange={setEnd} options={mode === 'day' ? [{ value: '24:00', label: '12:00 AM (next day)' }] : times} /></div>
      <div className="col-span-2 flex justify-end xl:col-span-1"><button disabled={loading} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#800000] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#650000] disabled:opacity-60 sm:w-auto" type="submit"><Search size={16} aria-hidden="true" />{loading ? 'Checking…' : 'Check availability'}</button></div>
    </form>
    <div className="flex items-start gap-2 rounded-xl bg-[#faf8f6] px-3 py-2.5 text-xs leading-5 text-[#786565]"><Info size={15} className="mt-0.5 shrink-0 text-[#967348]" aria-hidden="true" /><p>Stock is shared across academic periods. Pending requests do not reserve stock. Checked-out units remain unavailable until returned.</p></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {query && !changed && !loading && !error && <>
      <p className="text-sm text-[#786565]">{query.date} · {query.timeStart ? query.timeStart + '–' + query.timeEnd : 'Whole day'} (Manila time). Reserved and pending figures show peak simultaneous quantities, not daily totals. Availability uses current stock, including outstanding loans.</p>
      <input aria-label="Search availability" className="min-h-11 w-full rounded-lg border p-3 text-sm" placeholder="Search equipment…" value={search} onChange={e => setSearch(e.target.value)} />
      {rows.filter(row => row.name.toLowerCase().includes(search.toLowerCase())).map(row => <article key={row.id} className="rounded-xl border border-[#ead7d3] p-3">
        <h3 className="font-semibold">{row.name}{row.archived ? ' · Archived' : ''}</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">{[['Usable stock', row.usable], ['Checked out now', row.checkedOut], ['Reserved (peak)', row.reserved], ['Available for period', row.available], ['Pending (peak)', row.pending]].map(([label, count]) => <div key={label}><dt className="text-xs text-[#786565]">{label}</dt><dd className="mt-1 font-semibold">{count}</dd></div>)}</dl>
        <button type="button" className="mt-2 min-h-11 text-sm font-semibold text-[#800000] underline" aria-expanded={expanded === row.id} onClick={() => setExpanded(expanded === row.id ? null : row.id)}>{expanded === row.id ? 'Hide requests' : 'View requests'} ({row.requests.length})</button>
        {expanded === row.id && <div className="space-y-3 border-t pt-3">{row.requests.length === 0 && <p className="text-sm">No reservations, pending demand, or outstanding loans.</p>}{row.requests.map(request => <div key={request.id} className="space-y-1 text-sm">
          <p className="font-semibold">{request.reference} · {request.requester} · ×{request.quantity}</p>
          <p>{request.status} · {formatDate(request.dateNeeded)} · {formatTimeRange(request.timeStart, request.timeEnd)}</p><p>Usage location: {request.location}</p>
          <Link className="inline-flex min-h-11 items-center font-semibold text-[#800000] underline" to={'/admin/requests?search=' + encodeURIComponent(request.id) + '&academicYearId=' + encodeURIComponent(request.academicYearId) + '&termId=' + encodeURIComponent(request.termId)}>Open request</Link>
        </div>)}</div>}
      </article>)}
      {rows.filter(row => row.name.toLowerCase().includes(search.toLowerCase())).length === 0 && <p>No matching equipment.</p>}
    </>}
    {changed && query && <p className="text-sm text-[#786565]">Select Check availability to load the new period.</p>}
  </section>;
}
