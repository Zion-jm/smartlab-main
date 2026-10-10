import StudentAcademicBatch from './StudentAcademicBatch';
import { useRef, useState } from 'react';
import { studentAcademicApi } from '../../services/api';
import ConfirmationModal from '../shared/ConfirmationModal';

type RecordEntry = { id: string; programId: string; programCode: string; programName: string; yearLevel: number | null; status: string; updatedAt: string };
type Student = { id: string; firstName: string; lastName: string; email: string; status: string; studentProfile: { programId: string | null; yearLevel: number | null } | null; studentAcademicRecords: RecordEntry[] };
type Results = { total: number; page: number; pageSize: number; students: Student[]; programs: { id: string; name: string; code: string }[] };
const statusLabels: Record<string, string> = { ENROLLED: 'Enrolled', CONTINUING: 'Continuing', GRADUATED: 'Graduated', WITHDRAWN: 'Withdrawn' };
const inputClass = 'mt-1.5 min-h-11 w-full rounded-xl border border-[#dcc8c2] bg-white px-3 text-sm text-[#321d1d] outline-none transition focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/10';
const errorText = (error: unknown) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Unable to save or load academic records. Please try again.';

export default function StudentAcademicRecords({ years }: { years: { id: string; year: string; isActive: boolean }[] }) {
  const [yearId, setYearId] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Results | null>(null);
  const [selected, setSelected] = useState<Student | null>(null);
  const [programId, setProgramId] = useState('');
  const [level, setLevel] = useState('');
  const [status, setStatus] = useState('ENROLLED');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const version = useRef(0);
  const year = years.find(item => item.id === yearId);
  const previous = selected?.studentAcademicRecords[0];
  const resetResults = () => { version.current++; setLoading(false); setResults(null); setSelected(null); setError(''); setSuccess(''); };
  const load = async (page = 1) => {
    if (!yearId) { setError('Select an academic year.'); return; }
    const requestVersion = ++version.current;
    setLoading(true); setSelected(null); setError(''); setSuccess('');
    try { const response = await studentAcademicApi.list({ academicYearId: yearId, search, page }); if (requestVersion === version.current) setResults(response.data); }
    catch (e) { if (requestVersion === version.current) { setResults(null); setError(errorText(e)); } }
    finally { if (requestVersion === version.current) setLoading(false); }
  };
  const edit = (student: Student) => {
    const record = student.studentAcademicRecords[0]; setSelected(student); setProgramId(record?.programId ?? ''); setLevel(record?.yearLevel != null ? String(record.yearLevel) : ''); setStatus(record?.status ?? 'ENROLLED'); setReason(''); setError(''); setSuccess('');
  };
  const save = async () => {
    if (!selected) return;
    setSaving(true); setError('');
    try {
      const response = await studentAcademicApi.save({ studentId: selected.id, academicYearId: yearId, programId, yearLevel: level ? Number(level) : null, status, reason, expectedUpdatedAt: previous?.updatedAt ?? null });
      setResults(current => current ? { ...current, students: current.students.map(student => student.id === selected.id ? { ...student, studentAcademicRecords: [response.data.record] } : student) } : current);
      setSelected(null); setConfirm(false); setSuccess('Academic record saved. Existing requests and account access were not changed.');
    } catch (e) { setConfirm(false); setError(errorText(e)); }
    finally { setSaving(false); }
  };
  return <section className="overflow-hidden rounded-2xl border border-[#ead7d3] bg-white p-5 shadow-sm lg:p-6">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a15c45]">Student records</p>
    <h2 className="mt-1 text-lg font-semibold text-[#321d1d]">Academic standing by year</h2>
    <p className="mt-1 max-w-3xl text-sm leading-5 text-[#786565]">Review and confirm each student’s standing for the selected academic year. Historical records and account access remain unchanged unless explicitly updated.</p>
    <div className="mt-5 grid gap-3 rounded-2xl border border-[#ead7d3] bg-[#faf7f5] p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <label className="text-xs">Academic year<select className={inputClass} value={yearId} disabled={saving || confirm} onChange={e => { setYearId(e.target.value); resetResults(); }}><option value="">Select academic year</option>{years.map(item => <option key={item.id} value={item.id}>{item.year}{item.isActive ? ' · Active' : ''}</option>)}</select></label>
      <label className="text-xs">Student name or email<input className={inputClass} value={search} disabled={saving || confirm} onChange={e => { setSearch(e.target.value); resetResults(); }} /></label>
      <button type="button" disabled={loading || saving || confirm} onClick={() => void load()} className="min-h-11 self-end rounded-xl bg-[#800000] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#680000] disabled:opacity-50">{loading ? 'Loading…' : 'Load records'}</button>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {success && <p role="status" className="mt-3 text-sm text-green-800">{success}</p>}
    {results && !loading && <>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-[#321d1d]">{results.total} students · {year?.year}</p><p className="text-xs text-[#786565]">No record means standing has not been confirmed for this year.</p></div>
      <div className="mt-3 grid gap-2">{results.students.map(student => { const record = student.studentAcademicRecords[0]; return <div key={student.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#eee1dd] bg-white px-4 py-3 transition hover:border-[#d9bbb3] hover:bg-[#fffdfc]">
        <div><p className="text-sm font-semibold">{student.firstName} {student.lastName}</p><p className="text-xs text-[#786565]">{student.email} · Account {student.status.toLowerCase()}</p><p className="mt-1 text-sm">{record ? `${record.programCode} · ${record.yearLevel == null ? 'No year level' : `Year ${record.yearLevel}`} · ${statusLabels[record.status]}` : 'No academic record'}</p></div>
        <button type="button" disabled={saving || confirm} onClick={() => edit(student)} className="min-h-11 rounded-xl border border-[#dcbeb7] bg-white px-4 text-sm font-semibold text-[#800000] transition hover:bg-[#fff5f2]">{record ? 'Edit record' : 'Add record'}</button>
      </div>; })}</div>
      <div className="mt-3 flex items-center gap-3 text-xs"><button type="button" disabled={results.page <= 1 || loading || saving || confirm} className="min-h-11 rounded-lg border px-3 disabled:opacity-40" onClick={() => void load(results.page - 1)}>Previous</button><span>Page {results.page} of {Math.max(1, Math.ceil(results.total / results.pageSize))}</span><button type="button" disabled={results.page * results.pageSize >= results.total || loading || saving || confirm} className="min-h-11 rounded-lg border px-3 disabled:opacity-40" onClick={() => void load(results.page + 1)}>Next</button></div>
    </>}
    {results && !loading && !selected && <StudentAcademicBatch key={`${yearId}-${search}-${results.page}`} yearId={yearId} years={years} studentIds={results.students.map(student => student.id)} programs={results.programs} onSaved={() => { void load(results.page).then(() => setSuccess('Batch saved. Existing records and account access were not changed.')); }} />}
    {selected && <form className="mt-5 rounded-xl border border-[#ead7d3] bg-[#faf7f5] p-4" onSubmit={e => { e.preventDefault(); setConfirm(true); }}>
      <h3 className="font-semibold">{selected.firstName} {selected.lastName} · {year?.year}</h3>
      <p className="mt-1 text-xs text-[#786565]">Confirm that these details belong to this year. Adding the first record enables year-specific enrollment checks for future requests; missing years will require administrator review.</p>
      {!previous && selected.studentProfile && <button type="button" disabled={saving || confirm} className="mt-2 min-h-11 text-sm font-semibold text-[#800000] underline" onClick={() => { setProgramId(selected.studentProfile?.programId ?? ''); setLevel(selected.studentProfile?.yearLevel != null ? String(selected.studentProfile.yearLevel) : ''); }}>Use current profile as a starting point</button>}
      <fieldset disabled={saving || confirm} className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-xs">Program *<select required className={inputClass} value={programId} onChange={e => setProgramId(e.target.value)}><option value="">Select program</option>{results?.programs.map(program => <option key={program.id} value={program.id}>{program.code} – {program.name}</option>)}</select></label>
        <label className="text-xs">Academic status *<select className={inputClass} value={status} onChange={e => setStatus(e.target.value)}>{Object.entries(statusLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="text-xs">Year level{['ENROLLED','CONTINUING'].includes(status) ? ' *' : ' (optional)'}<select required={['ENROLLED','CONTINUING'].includes(status)} className={inputClass} value={level} onChange={e => setLevel(e.target.value)}><option value="">Select year level</option>{[1,2,3,4].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-xs sm:col-span-3">Reason / source of confirmation *<input required maxLength={500} className={inputClass} value={reason} onChange={e => setReason(e.target.value)} /></label>
      </fieldset>
      <div className="mt-4 flex gap-3"><button type="submit" disabled={saving || confirm || !reason.trim()} className="min-h-11 rounded-xl bg-[#800000] px-4 text-sm font-semibold text-white disabled:opacity-50">Review and save</button><button type="button" disabled={saving || confirm} onClick={() => setSelected(null)} className="min-h-11 px-4 text-sm">Cancel</button></div>
    </form>}
    <ConfirmationModal isOpen={confirm} title="Save student academic record?" message={`Record ${selected?.firstName ?? ''} ${selected?.lastName ?? ''} as ${statusLabels[status]?.toLowerCase()}${level ? `, Year ${level}` : ''}, for ${year?.year ?? ''}? This does not change their account access, current profile, or existing requests.`} confirmLabel="Save academic record" confirmingLabel="Saving…" cancelLabel="Go back" isConfirming={saving} onConfirm={() => void save()} onClose={() => { if (!saving) setConfirm(false); }} />
  </section>;
}
