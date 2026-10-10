import { dateToDateKey } from '../utils/dateTime';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive, ArrowRight, CalendarRange, CheckCircle2, Clock3, GraduationCap, History, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import ConfirmationModal from '../components/shared/ConfirmationModal';
import { academicPeriodApi } from '../services/api';
import { toast } from '../stores/toastStore';

type AcademicYearRecord = {
  id: string;
  year: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type TermRecord = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type CurrentPeriod = {
  academicYear: Pick<AcademicYearRecord, 'id' | 'year' | 'isActive'>;
  term: Pick<TermRecord, 'id' | 'name' | 'isActive'>;
  label: string;
};

type PeriodHistory = {
  id: string;
  action: string;
  details?: {
    previous?: { year: string; term: string } | null;
    next?: { year: string; term: string };
    reason?: string | null;
  } | null;
  createdAt: string;
  actor: { id: string; name: string; email: string };
};

type AcademicPeriodPayload = {
  current: CurrentPeriod | null;
  academicYears: AcademicYearRecord[];
  terms: TermRecord[];
  suggestedTerms: string[];
  history: PeriodHistory[];
};

const defaultTerms = ['1st Semester', '2nd Semester', 'Summer Term'];
const NEW_ACADEMIC_YEAR_VALUE = '__new_academic_year__';

const getErrorMessage = (error: unknown) => {
  const responseMessage = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return responseMessage || 'The academic period could not be saved. Please try again.';
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
};

const historyLabel = (entry: PeriodHistory) => {
  const next = entry.details?.next;
  if (!next) return 'Academic period updated';
  return `Set ${next.year} · ${next.term} as active`;
};

const getNextAcademicYearSuggestion = (academicYears: AcademicYearRecord[]) => {
  const latestYearEnd = academicYears.reduce((latest, academicYear) => {
    const match = /^(\d{4})-(\d{4})$/.exec(academicYear.year);
    return match ? Math.max(latest, Number(match[2])) : latest;
  }, 0);
  const startYear = latestYearEnd || Number(dateToDateKey(new Date()).slice(0, 4));
  return `${startYear}-${startYear + 1}`;
};

const getAcademicYearValidationMessage = (value: string) => {
  const normalizedValue = value.trim();
  if (!normalizedValue) return 'Enter an academic year.';

  const match = /^(\d{4})-(\d{4})$/.exec(normalizedValue);
  if (!match) return 'Use the format YYYY-YYYY with no spaces, for example 2027-2028.';

  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  if (endYear !== startYear + 1) {
    return `Academic years must cover one year. For a ${startYear} start, enter ${startYear}-${startYear + 1}.`;
  }

  return null;
};

export default function AdminAcademicPeriod() {
  const [data, setData] = useState<AcademicPeriodPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState('');
  const [isAddingAcademicYear, setIsAddingAcademicYear] = useState(false);
  const [yearTouched, setYearTouched] = useState(false);
  const [termName, setTermName] = useState('');
  const [reason, setReason] = useState('');
  const [pendingActivation, setPendingActivation] = useState<{ year: string; termName: string } | null>(null);

  const performLoadData = useCallback(async () => {
    
      return academicPeriodApi.get().then((response) => {
      const payload = response.data as AcademicPeriodPayload;
      setData(payload);
      const selectedYear = payload.current?.academicYear.year ?? payload.academicYears[0]?.year ?? '';
      setYear(selectedYear);
      setIsAddingAcademicYear(!selectedYear);
      setYearTouched(false);
      setTermName(payload.current?.term.name ?? payload.terms[0]?.name ?? payload.suggestedTerms[0] ?? defaultTerms[0]);
      setLastUpdated(new Date());
    
    }).catch((loadError) => {
      console.error('Failed to load academic period settings', loadError);
      setError('Academic period settings could not be loaded. Please refresh and try again.');
      setIsAddingAcademicYear(true);
      setYearTouched(false);
    }).finally(() => {
      setLoading(false);
      setRefreshing(false);
    });
  }, []);

  const loadData = useCallback(async (showRefreshState = false) => {
    if (showRefreshState) setRefreshing(true);
    setError(null);
    await performLoadData();
  }, [performLoadData]);
  useEffect(() => { void performLoadData(); }, [performLoadData]);

  const termOptions = useMemo(
    () => Array.from(new Set([...(data?.terms.map((term) => term.name) ?? []), ...(data?.suggestedTerms ?? defaultTerms)])),
    [data]
  );
  const nextAcademicYearSuggestion = useMemo(
    () => getNextAcademicYearSuggestion(data?.academicYears ?? []),
    [data?.academicYears]
  );
  const academicYearFieldError =
    isAddingAcademicYear && yearTouched
      ? getAcademicYearValidationMessage(year)
        ?? (data?.academicYears.some((academicYear) => academicYear.year === year.trim())
          ? 'That academic year already exists. Select it from the dropdown instead of adding it again.'
          : null)
      : null;

  const handleAcademicYearSelection = (value: string) => {
    if (value === NEW_ACADEMIC_YEAR_VALUE) {
      setIsAddingAcademicYear(true);
      setYear(nextAcademicYearSuggestion);
      setYearTouched(false);
      setError(null);
      return;
    }

    setIsAddingAcademicYear(false);
    setYear(value);
    setYearTouched(false);
    setError(null);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedYear = year.trim();
    const normalizedTerm = termName.trim();
    const academicYearError = getAcademicYearValidationMessage(normalizedYear);

    if (academicYearError) {
      setYearTouched(true);
      setError(academicYearError);
      return;
    }
    if (!normalizedTerm) {
      setError('Select a semester or enter a term name.');
      return;
    }
    if (isAddingAcademicYear && data?.academicYears.some((academicYear) => academicYear.year === normalizedYear)) {
      setError('That academic year already exists. Choose it from the academic-year dropdown instead.');
      return;
    }

    const isSamePeriod = data?.current?.academicYear.year === normalizedYear && data.current.term.name === normalizedTerm;
    if (isSamePeriod) {
      toast.info('That academic period is already active.');
      return;
    }

    setPendingActivation({ year: normalizedYear, termName: normalizedTerm });
  };

  const confirmActivation = async () => {
    if (!pendingActivation) return;
    setSaving(true);
    setError(null);
    try {
      const response = await academicPeriodApi.activate({
        year: pendingActivation.year,
        termName: pendingActivation.termName,
        reason: reason.trim() || undefined,
      });
      const current = (response.data as { current?: CurrentPeriod }).current;
      await loadData();
      setReason('');
      setPendingActivation(null);
      toast.success(current ? `${current.label} is now active.` : 'Academic period activated successfully.');
    } catch (saveError) {
      console.error('Failed to activate academic period', saveError);
      setError(getErrorMessage(saveError));
      setPendingActivation(null);
      toast.error(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="mx-auto flex min-h-[420px] responsive-workspace items-center justify-center">
          <div className="text-center">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#800000]" />
            <p className="mt-3 text-sm text-[#6b7280]">Loading academic period settings…</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto responsive-workspace space-y-4">
        {error && (
          <div data-testid="status-academic-period-error" className="flex items-start gap-3 rounded-2xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <section data-testid="card-current-academic-period" className="overflow-hidden rounded-2xl border border-[#ead7d3] bg-linear-to-br from-[#fff8f8] via-white to-[#fffdf5] shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#f1e3df] px-5 py-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#800000] text-white shadow-sm">
                <CalendarRange className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#9a7b4f]">Current active period</p>
                <h2 data-testid="text-current-academic-period" className="mt-1 text-xl font-bold text-[#1f2937]">
                  {data?.current?.label ?? 'No academic period configured'}
                </h2>
                <p className="mt-1 text-xs text-[#6b7280]">
                  {data?.current ? 'New schedules and requests will use this year and semester by default.' : 'Set a period below before creating new schedules or requests.'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <span data-testid="status-current-academic-period" className="inline-flex items-center gap-1.5 rounded-full bg-[#dcfce7] px-3 py-1.5 text-xs font-semibold text-[#166534]">
                <CheckCircle2 className="h-4 w-4" />
                {data?.current ? 'Active' : 'Needs setup'}
              </span>
              <div className="flex items-center gap-3">
                {lastUpdated && (
                  <span className="hidden text-xs text-[#6b7280] sm:inline">
                    Updated {lastUpdated.toLocaleTimeString([], { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })}
                  </span>
                )}
                <button
                  type="button"
                  data-testid="button-refresh-academic-period"
                  onClick={() => void loadData(true)}
                  disabled={refreshing || saving}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-medium text-[#4b5563] transition hover:bg-[#f8f9fa] disabled:cursor-wait disabled:opacity-50 lg:px-4 lg:py-2 lg:text-sm"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Academic year</p>
              <p data-testid="text-current-academic-year" className="mt-1 text-sm font-semibold text-[#1f2937]">{data?.current?.academicYear.year ?? '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Semester / term</p>
              <p data-testid="text-current-term" className="mt-1 text-sm font-semibold text-[#1f2937]">{data?.current?.term.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Available records</p>
              <p data-testid="text-academic-period-record-count" className="mt-1 text-sm font-semibold text-[#1f2937]">
                {(data?.academicYears.length ?? 0)} years · {(data?.terms.length ?? 0)} terms
              </p>
            </div>
          </div>
        </section>

        <div aria-hidden="true" className="h-0.5 w-full rounded-full bg-[#c8aaa2]" />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_2px_minmax(320px,0.85fr)]">
          <section className="rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
            <div className="border-b border-[#f3f4f6] px-5 py-4">
              <div className="flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-[#800000]" />
                <h2 className="text-sm font-semibold text-[#1f2937]">Change active period</h2>
              </div>
              <p className="mt-1 text-xs text-[#6b7280]">Existing records will not be moved or rewritten.</p>
            </div>
            <form onSubmit={submit} className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-[#4b5563]">Academic year</span>
                  <select
                    data-testid="select-academic-year"
                    aria-label="Academic year"
                    value={isAddingAcademicYear ? NEW_ACADEMIC_YEAR_VALUE : year}
                    onChange={(event) => handleAcademicYearSelection(event.target.value)}
                    disabled={saving}
                    required
                    className="h-11 w-full rounded-xl border border-[#d8c7c3] bg-white px-3 text-sm text-[#1f2937] outline-none transition focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/10"
                  >
                    {data?.academicYears.length ? (
                      data.academicYears.map((academicYear) => (
                        <option key={academicYear.id} value={academicYear.year}>
                          {academicYear.year}{academicYear.isActive ? ' · Active' : ''}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>No academic years yet</option>
                    )}
                    <option value={NEW_ACADEMIC_YEAR_VALUE}>+ Add new academic year</option>
                  </select>
                  {isAddingAcademicYear ? (
                    <>
                      <input
                        data-testid="input-new-academic-year"
                        aria-invalid={Boolean(academicYearFieldError)}
                        aria-describedby="academic-year-help"
                        value={year}
                        onChange={(event) => {
                          setYear(event.target.value);
                          setYearTouched(true);
                          setError(null);
                        }}
                        onBlur={() => setYearTouched(true)}
                        placeholder={nextAcademicYearSuggestion}
                        maxLength={9}
                        required
                        className={`mt-2 h-11 w-full rounded-xl border bg-white px-3 text-sm text-[#1f2937] outline-none transition placeholder:text-[#9ca3af] focus:ring-2 focus:ring-[#800000]/10 ${
                          academicYearFieldError
                            ? 'border-[#b91c1c] bg-[#fff7f7] focus:border-[#b91c1c]'
                            : 'border-[#d8c7c3] focus:border-[#800000]'
                        }`}
                      />
                      <span
                        id="academic-year-help"
                        role={academicYearFieldError ? 'alert' : undefined}
                        className={`mt-1.5 block text-[11px] ${academicYearFieldError ? 'text-[#991b1b]' : 'text-[#9ca3af]'}`}
                      >
                        {academicYearFieldError ?? `Suggested next year: ${nextAcademicYearSuggestion}. Use the format YYYY-YYYY.`}
                      </span>
                    </>
                  ) : (
                    <span className="mt-1.5 block text-[11px] text-[#9ca3af]">Choose an existing academic year or add a new one.</span>
                  )}
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-[#4b5563]">Semester / term</span>
                  <select
                    data-testid="select-academic-term"
                    value={termName}
                    onChange={(event) => setTermName(event.target.value)}
                    required
                    className="h-11 w-full rounded-xl border border-[#d8c7c3] bg-white px-3 text-sm text-[#1f2937] outline-none transition focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/10"
                  >
                    {termOptions.map((term) => <option key={term} value={term}>{term}</option>)}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[#4b5563]">Reason for change <span className="font-normal text-[#9ca3af]">(optional)</span></span>
                <input
                  data-testid="input-academic-period-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={240}
                  placeholder="Example: Opening the new academic year"
                  className="h-11 w-full rounded-xl border border-[#d8c7c3] bg-white px-3 text-sm text-[#1f2937] outline-none transition placeholder:text-[#9ca3af] focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/10"
                />
              </label>
              <div className="flex items-start gap-3 rounded-xl border border-[#f6e8b1] bg-[#fffdf5] px-3 py-3 text-xs text-[#92400e]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Only the default period changes. Historical schedules, requests, and reports remain attached to their original academic period.</p>
              </div>
              <button
                type="submit"
                data-testid="button-save-academic-period"
                disabled={saving || !year.trim() || !termName.trim()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#800000] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#650000] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
                {saving ? 'Saving…' : 'Save active period'}
              </button>
            </form>
          </section>

          <div aria-hidden="true" className="h-0.5 w-full rounded-full bg-[#c8aaa2] xl:-my-4 xl:h-auto xl:w-0.5 xl:self-stretch" />

          <section className="rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
            <div className="border-b border-[#f3f4f6] px-5 py-4">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-[#800000]" />
                <h2 className="text-sm font-semibold text-[#1f2937]">Available periods</h2>
              </div>
              <p className="mt-1 text-xs text-[#6b7280]">Records are kept for reporting and history.</p>
            </div>
            <div className="max-h-[320px] overflow-y-auto p-3">
              {(data?.academicYears ?? []).map((academicYear) => (
                <div key={academicYear.id} data-testid={`row-academic-year-${academicYear.id}`} className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-[#fff8f8]">
                  <div>
                    <p className="text-sm font-semibold text-[#1f2937]">{academicYear.year}</p>
                    <p className="text-[11px] text-[#9ca3af]">Academic year record</p>
                  </div>
                  {academicYear.isActive && <span className="rounded-full bg-[#dcfce7] px-2 py-1 text-[10px] font-semibold text-[#166534]">Active</span>}
                </div>
              ))}
              {(data?.academicYears.length ?? 0) === 0 && <p className="p-3 text-sm text-[#6b7280]">No academic years have been created yet.</p>}
            </div>
          </section>
        </div>

        <div aria-hidden="true" className="h-0.5 w-full rounded-full bg-[#c8aaa2]" />

        <section className="rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#f3f4f6] px-5 py-4">
            <History className="h-4 w-4 text-[#800000]" />
            <div>
              <h2 className="text-sm font-semibold text-[#1f2937]">Change history</h2>
              <p className="mt-1 text-xs text-[#6b7280]">Recent changes to the system-wide active period.</p>
            </div>
          </div>
          <div className="divide-y divide-[#f3f4f6]">
            {(data?.history ?? []).map((entry) => (
              <div key={entry.id} data-testid={`row-academic-period-history-${entry.id}`} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-lg bg-[#fef3e2] p-2 text-[#9a7b4f]"><Clock3 className="h-4 w-4" /></div>
                  <div>
                    <p className="text-sm font-semibold text-[#1f2937]">{historyLabel(entry)}</p>
                    <p className="mt-1 text-xs text-[#6b7280]">
                      {entry.actor.name} · {formatDateTime(entry.createdAt)}
                    </p>
                    {entry.details?.reason && <p className="mt-1 text-xs italic text-[#9ca3af]">“{entry.details.reason}”</p>}
                  </div>
                </div>
                {entry.details?.previous && <span className="text-xs text-[#9ca3af]">Previous: {entry.details.previous.year} · {entry.details.previous.term}</span>}
              </div>
            ))}
            {(data?.history.length ?? 0) === 0 && <p className="px-5 py-6 text-sm text-[#6b7280]">No changes have been recorded yet.</p>}
          </div>
        </section>
      </div>
      <div className="mx-auto mb-5 px-4">
        <section className="flex flex-col gap-4 rounded-2xl border border-[#ead7d3] bg-linear-to-r from-[#fff8f5] to-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><span className="rounded-xl bg-[#f8e9e5] p-2.5 text-[#800000]"><GraduationCap className="h-5 w-5" /></span><div><h2 className="font-semibold text-[#321d1d]">Student academic records</h2><p className="mt-1 max-w-2xl text-sm leading-5 text-[#786565]">Confirm yearly standing, prepare promotions, and review graduation separately from the active-period setting.</p></div></div>
          <Link to="/admin/student-records" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#800000] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#680000]">Manage student records <ArrowRight className="h-4 w-4" /></Link>
        </section>
      </div>
      <ConfirmationModal
        isOpen={pendingActivation !== null}
        title="Activate academic period?"
        message={
          pendingActivation
            ? `Set ${pendingActivation.year} · ${pendingActivation.termName} as the active academic period? Existing schedules, requests, and reports will keep their original academic period.`
            : ''
        }
        confirmLabel="Activate academic period"
        confirmingLabel="Activating…"
        isConfirming={saving}
        onConfirm={() => void confirmActivation()}
        onClose={() => setPendingActivation(null)}
      />
    </AdminLayout>
  );
}
