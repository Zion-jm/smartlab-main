import UsageLocationField from '../features/requests/UsageLocationField';
import RequestSubmittedDialog from '../features/requests/RequestSubmittedDialog';
import DateRangeFilter from '../components/shared/DateRangeFilter';
import MobileScheduleExplorer from '../features/requests/MobileScheduleExplorer';
import { CalendarDays as RequestCalendarIcon, GraduationCap as RequestAcademicIcon, FileText as RequestPurposeIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import UnifiedEquipmentSection from '../components/equipment/UnifiedEquipmentSection';
import FilterToolbar from '../components/FilterToolbar';
import ScheduleDataTable from '../components/lab-schedule/ScheduleDataTable';
import { CalendarView, ChartView } from '../components/lab-schedule/ScheduleViews';
import PortalLayout, { type PortalNavItem } from '../components/PortalLayout';
import ConfirmationModal from '../components/shared/ConfirmationModal';
import { ConflictDetailModal } from '../components/shared/ConflictDetailModal';
import { ConflictStatusCard } from '../components/shared/ConflictStatusCard';
import DropdownField from '../components/shared/DropdownField';
import { EmptyState, ErrorState, LoadingState } from '../components/shared/EmptyState';
import PageTabGroup from '../components/shared/PageTabGroup';
import { getPageTabId } from '../components/shared/pageTabGroupUtils';
import ResetFiltersButton from '../components/shared/ResetFiltersButton';
import { StyledDatePicker } from '../components/shared/StyledDatePicker';
import { YEAR_LEVELS } from '../constants/yearLevels';
import { MyRequestsPreview } from '../features/requests/MyRequestsPreview';
import { PanelSection } from '../features/requests/PanelSection';
import { formatReference, timeOptions, toDateInputValue, toManilaTimeInputValue, type ApiBorrowRequest, type RequestResources, type RequestRow } from '../features/requests/requestModels';
import { useLabSchedules, useMyBorrowRequests, useRequestResources, type SchedulesState } from '../features/requests/useRequestData';
import { useScheduleConflictCheck } from '../hooks/useScheduleConflictCheck';
import { borrowRequestApi } from '../services/api';
import { toast } from '../stores/toastStore';
import type { AcademicContextSelection } from '../types/labSchedule';
import { combineManilaDateTime as combineDateTime } from '../utils/dateTime';

const tabs = [
  {
    id: 'request',
    label: 'New Request',
    description: 'File a lab or equipment request at least 3 days in advance.',
  },
  {
    id: 'requests',
    label: 'My Requests',
    description: 'Track approvals, borrowed items, and quick actions.',
  },
  {
    id: 'schedule',
    label: 'View Schedules',
    description: 'Browse active lab schedules to avoid conflicts.',
  },
] as const;

type TabId = (typeof tabs)[number]['id'];

const facultyScheduleViewTabs = [
  { id: 'table', label: 'Table View', description: 'View schedules in a detailed table.' },
  { id: 'chart', label: 'Chart View', description: 'View schedules on a weekly utilization chart.' },
  { id: 'calendar', label: 'Calendar', description: 'View schedules in a calendar layout.' },
] as const;

const FieldLabel = ({
  text,
  required,
  showMissing,
  optional,
}: {
  text: string;
  required?: boolean;
  showMissing?: boolean;
  optional?: boolean;
}) => (
  <span className="inline-flex items-center gap-1">
    <span>{text}</span>
    {optional && <sup className="text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">Optional</sup>}
    {required && showMissing && <span className="text-[#dc2626]">*</span>}
  </span>
);

type RequiredFieldKey =
  | 'facultyId'
  | 'dateNeeded'
  | 'timeStart'
  | 'timeEnd'
  | 'purpose'
  | 'programId'
  | 'yearLevel'
  | 'subjectId'
  | 'labId'
  | 'location';

const requiredFieldLabels: Record<RequiredFieldKey, string> = {
  facultyId: 'Faculty in charge',
  dateNeeded: 'Date of use',
  timeStart: 'Time start',
  timeEnd: 'Time end',
  purpose: 'Purpose',
  programId: 'Program',
  yearLevel: 'Year level',
  subjectId: 'Subject',
  labId: 'Laboratory room',
  location: 'Location / room',
};

const ClipboardIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="4" y="4" width="16" height="18" rx="2" />
    <path d="M9 2h6v4H9z" />
  </svg>
);

const ListIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <circle cx="4" cy="6" r="1" />
    <circle cx="4" cy="12" r="1" />
    <circle cx="4" cy="18" r="1" />
  </svg>
);

const CalendarIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

export default function FacultyPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('request');
  const [editingRequest, setEditingRequest] = useState<ApiBorrowRequest | null>(null);
  const [requestToCancel, setRequestToCancel] = useState<RequestRow | null>(null);
  const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null);
  const { resources, academicContext, loading, error, reload } = useRequestResources();
  const myRequestsState = useMyBorrowRequests();
  const { reload: reloadMyRequests } = myRequestsState;
  const scheduleState = useLabSchedules();

  const handleCancelRequest = useCallback((request: RequestRow) => {
    setRequestToCancel(request);
  }, []);

  const confirmCancelRequest = useCallback(async () => {
    if (!requestToCancel) return;

    setCancellingRequestId(requestToCancel.id);
    try {
      await borrowRequestApi.cancel(requestToCancel.id);
      toast.success(`${requestToCancel.reference} was cancelled.`);
      await reloadMyRequests();
    } catch (cancelErr) {
      let message = 'Failed to cancel the request. Please try again.';
      if (typeof cancelErr === 'object' && cancelErr && 'response' in cancelErr) {
        const apiErr = cancelErr as { response?: { data?: { error?: string; message?: string } } };
        message = apiErr.response?.data?.message ?? apiErr.response?.data?.error ?? message;
      }
      toast.error(message);
    } finally {
      setCancellingRequestId(null);
      setRequestToCancel(null);
    }
  }, [reloadMyRequests, requestToCancel]);
  const computerLabNames = useMemo(
    () => (resources?.rooms ?? []).filter((room) => room.isComputerLab).map((room) => room.label),
    [resources]
  );

  const contextLabel = academicContext
    ? `${academicContext.academicYearLabel} · ${academicContext.termLabel}`
    : 'Context not set';

  const navItems = useMemo<PortalNavItem[]>(
    () =>
      tabs.map((tab) => ({
        id: tab.id,
        label: tab.label,
        icon: tab.id === 'request' ? ClipboardIcon : tab.id === 'requests' ? ListIcon : CalendarIcon,
        description: tab.description,
        onClick: () => setActiveTab(tab.id),
        isActive: tab.id === activeTab,
      })),
    [activeTab]
  );

  const sidebarExtras = (
    <div className="mx-4 mt-4 p-3 bg-[#fef3e2] rounded-lg border border-[rgba(255,184,28,0.3)]">
      <p className="text-xs text-[#9a7b4f] font-medium">{contextLabel}</p>
    </div>
  );

  return (
    <PortalLayout
      navItems={navItems}
      portalLabel="Faculty Portal"
      portalSubLabel="smartlab."
      sidebarExtras={sidebarExtras}
    >
      <div className="space-y-4">
        {activeTab === 'request' && (
          <RequestFormScaffold
            key="new-request"
            academicContext={academicContext}
            resources={resources}
            loading={loading}
            error={error}
            onRetry={reload}
            onSubmitted={reloadMyRequests}
            onViewRequests={() => setActiveTab('requests')}
          />
        )}
        {activeTab === 'requests' && editingRequest ? (
          <RequestFormScaffold
            key={editingRequest.id}
            editingRequest={editingRequest}
            academicContext={academicContext}
            resources={resources}
            loading={loading}
            error={error}
            onRetry={reload}
            onUpdated={async () => {
              setEditingRequest(null);
              await reloadMyRequests();
            }}
            onCancel={() => setEditingRequest(null)}
          />
        ) : activeTab === 'requests' ? (
          <MyRequestsPreview
            {...myRequestsState}
            onEdit={setEditingRequest}
            onCancelRequest={handleCancelRequest}
            cancellingRequestId={cancellingRequestId}
          />
        ) : null}
        {activeTab === 'schedule' && (
          <FacultyScheduleExplorer {...scheduleState} computerLabNames={computerLabNames} />
        )}
      </div>
      <ConfirmationModal
        isOpen={requestToCancel !== null}
        title="Cancel this request?"
        message={
          requestToCancel
            ? `${requestToCancel.reference} is still pending. Cancelling it means it will no longer be reviewed for approval.`
            : ''
        }
        confirmLabel="Yes, cancel request"
        confirmingLabel="Cancelling…"
        isConfirming={cancellingRequestId !== null}
        onConfirm={() => void confirmCancelRequest()}
        onClose={() => setRequestToCancel(null)}
      />
    </PortalLayout>
  );
}

type FacultyScheduleExplorerProps = SchedulesState & { computerLabNames: string[] };

function FacultyScheduleExplorer({ schedules, loading, error, dateFilter, setDateFilter, reload, computerLabNames }: FacultyScheduleExplorerProps) {
  const [search, setSearch] = useState('');
  const [range, setRange] = useState({from:'',to:''});
  const [viewMode, setViewMode] = useState<'table' | 'chart' | 'calendar'>('table');

  const filteredSchedules = useMemo(() => {
    const query = search.trim().toLowerCase();
    const dated = schedules.filter(schedule => {
      if (viewMode === 'chart' || (!range.from && !range.to)) return true;
      if (schedule.scheduleType !== 'WEEKLY') { const key = schedule.date?.slice(0,10); return !!key && (!range.from || key >= range.from) && (!range.to || key <= range.to); }
      if (!range.from || !range.to) return true;
      const start = new Date(range.from + 'T00:00:00Z');
      const end = new Date(range.to + 'T00:00:00Z');
      const offset = ((schedule.dayOfWeekIndex ?? -7) - start.getUTCDay() + 7) % 7;
      return schedule.dayOfWeekIndex !== null && start.getTime() + offset * 86400000 <= end.getTime();
    });
    if (viewMode === 'chart') return schedules;
    if (!query) return dated;
    return dated.filter((schedule) =>
      [
        schedule.roomLabel,
        schedule.facultyName,
        schedule.programLabel,
        schedule.subjectLabel,
        schedule.displayDay,
        schedule.displayDate,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [schedules, search, range, viewMode]);

  return (
    <>
    <MobileScheduleExplorer schedules={schedules} loading={loading} error={error} dateFilter={dateFilter} setDateFilter={setDateFilter} reload={reload} computerLabNames={computerLabNames} />
    <section className="hidden md:block mx-auto responsive-workspace space-y-4 p-2 lg:p-3">
      <FilterToolbar
        compactFilters
        searchValue={search}
        onSearchChange={setSearch}
        searchInFilters
        filters={
          <div className="schedule-ribbon-filters compact-filter-panel grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            <label className="flex min-w-0 flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">Search<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Subject, room, or faculty" className="h-10 rounded-lg border border-[#d8c7c3] bg-white px-3 text-sm font-normal normal-case" /></label>
            <div className="flex w-full items-end gap-2 md:col-span-2">
            <DateRangeFilter value={range} onChange={setRange} className="min-w-0 flex-1" />
            {(range.from || range.to) && <ResetFiltersButton onClick={() => setRange({from:'',to:''})} label="Clear dates" className="mb-0 whitespace-nowrap" />}
            </div>
          </div>
        }
        filtersActiveCount={range.from || range.to ? 1 : 0}
        ribbonSummary={`View: ${facultyScheduleViewTabs.find((tab) => tab.id === viewMode)?.label ?? 'Schedule'}${range.from || range.to ? ` · Dates: ${range.from || 'Any'} – ${range.to || 'Any'}` : ''}`}
        onRefresh={reload}
        refreshing={loading}
        refreshError={Boolean(error)}
        className="mb-1"
      />
      <div className="page-control-ribbon--flush px-0 pt-3 pb-0">
          <PageTabGroup
            tabs={facultyScheduleViewTabs}
            value={viewMode}
            onChange={(value) => setViewMode(value as 'table' | 'chart' | 'calendar')}
            ariaLabel="Faculty schedule views"
            panelId="faculty-schedule-tabpanel"
          />
      </div>
      <div aria-hidden="true" className="h-0.5 w-full rounded-full bg-[#c8aaa2]" />
      <div
        className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm"
        id="faculty-schedule-tabpanel"
        role="tabpanel"
        aria-labelledby={getPageTabId('faculty-schedule-tabpanel', viewMode)}
        tabIndex={0}
      >
        {loading ? (
          <LoadingState message="Loading schedules…" />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : filteredSchedules.length === 0 ? (
          <EmptyState
            title="No schedules found"
            description="No schedules match your filters yet."
            variant="minimal"
          />
        ) : viewMode === 'table' ? (
          <ScheduleDataTable schedules={filteredSchedules} />
        ) : viewMode === 'chart' ? (
          <ChartView schedules={schedules} computerLabNames={computerLabNames} />
        ) : (
          <CalendarView schedules={filteredSchedules} />
        )}
      </div>
    </section>
    </>
  );
}

function RequestFormScaffold({
  academicContext,
  resources,
  loading,
  error,
  onRetry,
  onSubmitted,
  onViewRequests,
  editingRequest,
  onUpdated,
  onCancel,
}: {
  academicContext: AcademicContextSelection | null;
  resources: RequestResources | null;
  loading: boolean;
  error: string | null;
  onRetry: () => Promise<void>;
  onSubmitted?: () => void;
  onViewRequests?: () => void;
  editingRequest?: ApiBorrowRequest | null;
  onUpdated?: () => void | Promise<void>;
  onCancel?: () => void;
}) {
  const selfFacultyProfileId = resources?.selfFacultyProfileId ?? null;

  const [useLabRoom, setUseLabRoom] = useState(editingRequest ? editingRequest.requestType === 'LABORATORY' || (editingRequest.requestType === 'LEGACY' && Boolean(editingRequest.room?.id)) : false);
  const [selectedEquipment, setSelectedEquipment] = useState<Record<string, number>>(() =>
    (editingRequest?.items ?? []).reduce<Record<string, number>>((selected, item) => {
      selected[item.equipmentId] = item.quantity;
      return selected;
    }, {})
  );
  const [form, setForm] = useState(() => ({
    facultyId: editingRequest?.faculty?.id ?? (selfFacultyProfileId ? 'self' : ''),
    programId: editingRequest?.program?.id ?? '',
    yearLevel: editingRequest?.yearLevel != null ? String(editingRequest.yearLevel) : '',
    subjectId: editingRequest?.subject?.id ?? '',
    dateNeeded: toDateInputValue(editingRequest?.dateNeeded),
    timeStart: toManilaTimeInputValue(editingRequest?.timeStart),
    timeEnd: toManilaTimeInputValue(editingRequest?.timeEnd),
    location: editingRequest?.usageLocation ?? editingRequest?.usageRoom?.name ?? editingRequest?.location ?? '',
    labId: editingRequest?.room?.id ?? '',
    contactDetails: editingRequest?.contactDetails ?? '',
    purpose: editingRequest?.purpose ?? '',
  }));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [locationReset, setLocationReset] = useState(0);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const missingFields = useMemo<RequiredFieldKey[]>(() => {
    const required: RequiredFieldKey[] = [];
    if (!form.facultyId) required.push('facultyId');
    if (!form.dateNeeded) required.push('dateNeeded');
    if (!form.timeStart) required.push('timeStart');
    if (!form.timeEnd) required.push('timeEnd');
    if (!form.purpose.trim()) required.push('purpose');
    if (!form.programId) required.push('programId');
    if (!form.yearLevel) required.push('yearLevel');
    if (!form.subjectId) required.push('subjectId');
    if (useLabRoom) {
      if (!form.labId) required.push('labId');
    } else if (!form.location.trim()) {
      required.push('location');
    }
    return required;
  }, [form, useLabRoom]);

  const focusField = useCallback((field: RequiredFieldKey) => {
    requestAnimationFrame(() => {
      const container = document.querySelector<HTMLElement>(`[data-field="${field}"]`);
      if (container) {
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const focusable = container.querySelector<HTMLElement>('input, textarea, select, button:not([aria-disabled="true"])');
        focusable?.focus();
      }
    });
  }, []);

  const FacultyInputs = [editingRequest, selfFacultyProfileId];
  const [FacultyPrevious, setFacultyPrevious] = useState<unknown[] | null>(null);
  if (!FacultyPrevious || FacultyInputs.some((value, index) => !Object.is(value, FacultyPrevious[index]))) {
    setFacultyPrevious(FacultyInputs);
    if (selfFacultyProfileId && !editingRequest) {
      setForm((previous) => {
        if (previous.facultyId === 'self') return previous;
        return { ...previous, facultyId: 'self' };
      });
    }
  }

  const equipmentSelections = Object.entries(selectedEquipment).filter(([, qty]) => qty > 0);
  const equipmentList = resources?.equipment ?? [];
  const roomOptions = useMemo(() => resources?.rooms ?? [], [resources?.rooms]);
  const labRoomOptions = useMemo(
    () => roomOptions.filter((room) => room.isComputerLab === true),
    [roomOptions]
  );
  const generalRoomOptions = useMemo(
    () => roomOptions,
    [roomOptions]
  );
  const programOptions = resources?.programs ?? [];
  const subjectOptions = resources?.subjects ?? [];
  const selectedEquipmentDetails = equipmentSelections.map(([id, qty]) => {
    const details = equipmentList.find((item) => String(item.id) === id);
    return { id, qty, name: details?.name ?? 'Equipment item' };
  });

  const selectedRoomOption = useMemo(() => {
    if (!useLabRoom || !form.labId) return null;
    return labRoomOptions.find((r) => r.value === form.labId) ?? null;
  }, [useLabRoom, form.labId, labRoomOptions]);

  const timeRangeError = useMemo(() => {
    if (!form.timeStart || !form.timeEnd || form.timeStart < form.timeEnd) return null;
    return 'Choose an end time later than the start time so your session has a duration.';
  }, [form.timeStart, form.timeEnd]);

  const conflictParams = useMemo(() => {
    const params = {
      scheduleType: 'ONE_TIME' as const,
      scheduleDate: form.dateNeeded,
      dayOfWeek: undefined,
      timeStart: form.timeStart,
      timeEnd: form.timeEnd,
      roomId: form.labId,
      roomLabel: selectedRoomOption?.label ?? '',
      academicYearId: academicContext?.academicYearId ?? '',
      termId: academicContext?.termId ?? '',
      excludeRequestId: editingRequest?.id,
    };
    if (!academicContext) return null;
    if (!useLabRoom) return null; // Only check conflicts for lab room requests
    if (!selectedRoomOption) return null;
    if (!form.dateNeeded || !form.timeStart || !form.timeEnd) return null;
    if (timeRangeError) return null;
    return params;
  }, [academicContext, editingRequest?.id, form, selectedRoomOption, timeRangeError, useLabRoom]);

  const conflictCheck = useScheduleConflictCheck(conflictParams);
  const conflictBlocked = useLabRoom && conflictCheck.status === 'danger';

  const [conflictModalOpen, setConflictModalOpen] = useState(false);

  const updateForm = (field: keyof typeof form, value: string) => {
    setSubmitError(null);
    setSubmitSuccess(null);
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEquipmentChange = (id: string, quantity: number, max: number) => {
    const safeQuantity = Number.isNaN(quantity) ? 0 : Math.max(0, Math.min(quantity, Math.max(max, 0)));
    setSelectedEquipment((prev) => {
      if (!safeQuantity) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: safeQuantity };
    });
  };

  const resetForm = () => {
    setLocationReset(value => value + 1);
    setUseLabRoom(false);
    setSelectedEquipment({});
    setSubmitError(null);
    setSubmitSuccess(null);
    setForm({
      facultyId: selfFacultyProfileId ? 'self' : '',
      programId: '',
      yearLevel: '',
      subjectId: '',
      dateNeeded: '',
      timeStart: '',
      timeEnd: '',
      location: '',
      labId: '',
      contactDetails: '',
      purpose: '',
    });
  };

  const submitDisabled = submitting || loading || !academicContext || conflictBlocked || Boolean(timeRangeError);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!academicContext) {
      setSubmitError('Academic context is unavailable. Please refresh and try again.');
      return;
    }

    if (missingFields.length > 0) {
      const first = missingFields[0];
      setSubmitError(`${requiredFieldLabels[first]} is required.`);
      focusField(first);
      return;
    }

    if (timeRangeError) {
      setSubmitError(timeRangeError);
      focusField('timeEnd');
      return;
    }

    if (!useLabRoom && !equipmentSelections.length) { setSubmitError('Select at least one equipment item.'); return; }

    const timeStartIso = combineDateTime(form.dateNeeded, form.timeStart);
    const timeEndIso = combineDateTime(form.dateNeeded, form.timeEnd);
    if (!timeStartIso || !timeEndIso) {
      setSubmitError('Invalid time range. Please double-check your dates and times.');
      return;
    }

    const resolvedFacultyProfileId = form.facultyId === 'self' ? selfFacultyProfileId : form.facultyId;
    if (!resolvedFacultyProfileId) {
      setSubmitError('Select a faculty profile in charge of this request.');
      return;
    }

    const payload = {
      facultyId: resolvedFacultyProfileId,
      programId: form.programId,
      subjectId: form.subjectId,
      yearLevel: Number(form.yearLevel) || null,
      dateNeeded: form.dateNeeded,
      roomId: useLabRoom ? form.labId || null : null,
      requestType: useLabRoom ? 'LABORATORY' : 'EQUIPMENT',
      usageRoomId: !useLabRoom ? generalRoomOptions.find(option => option.label === form.location)?.value ?? null : null,
      usageLocation: !useLabRoom ? form.location.trim() : null,
      timeStart: timeStartIso,
      timeEnd: timeEndIso,
      purpose: form.purpose.trim(),
      contactDetails: form.contactDetails.trim() || null,
      academicYearId: academicContext.academicYearId,
      termId: academicContext.termId,
      items: equipmentSelections.map(([equipmentId, qty]) => ({ equipmentId, quantity: qty })),
    };

    try {
      setSubmitError(null);
      setSubmitSuccess(null);
      setSubmitting(true);
      if (editingRequest) {
        await borrowRequestApi.update(editingRequest.id, payload);
        setSubmitSuccess('Request updated successfully. The administrator will review the revised request.');
        toast.success('Request updated successfully.');
        await onUpdated?.();
      } else {
        const response = await borrowRequestApi.create(payload);
        resetForm();
        setSubmittedId(response.data.request.id);
        onSubmitted?.();
      }
    } catch (submitErr) {
      let message = 'Failed to submit request. Please try again.';
      if (typeof submitErr === 'object' && submitErr && 'response' in submitErr) {
        const apiErr = submitErr as { response?: { data?: { error?: string; message?: string } } };
        message = apiErr.response?.data?.message ?? apiErr.response?.data?.error ?? message;
      }
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <form className="space-y-4" onSubmit={handleSubmit}>
      {(loading || error) && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            loading
              ? 'bg-[#f8fafc] border-[#e2e8f0] text-[#475569]'
              : 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
          }`}
        >
          {loading ? 'Loading request resources…' : error}
          {!loading && error && (
            <button type="button" onClick={onRetry} className="ml-3 text-xs font-semibold underline">
              Retry
            </button>
          )}
        </div>
      )}
      {submitError && (
        <div className="rounded-2xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-xs text-[#991b1b]">{submitError}</div>
      )}
      {submittedId && <RequestSubmittedDialog id={submittedId} onClose={() => setSubmittedId(null)} onView={() => { setSubmittedId(null); onViewRequests?.(); }} />}
      {submitSuccess && (
        <div className="rounded-2xl border border-[#bbf7d0] bg-[#ecfdf5] px-4 py-3 text-xs text-[#166534]">{submitSuccess}</div>
      )}

      <PanelSection
        title={editingRequest ? `Edit ${formatReference(editingRequest.id)}` : 'Request details'}
        helper={editingRequest
          ? 'Edit your request below. Your changes will be sent to the administrator for review.'
          : 'Choose a request type and complete the details. Submit at least 3 days in advance.'}
      >
        {editingRequest && (!editingRequest.requestType || editingRequest.requestType === 'LEGACY') && (
          <p className="mb-4 rounded-xl border border-[#ead7d3] bg-[#fff8f3] p-3 text-sm text-[#800000]">This is an older request. Saving applies the new request rules. Confirm the request type, equipment, and location before submitting.</p>
        )}
        <div className="request-form-sections rounded-2xl border border-[#f1f5f9] bg-[#fdfdfd] divide-y divide-[#f1f5f9]">
          <section className="space-y-4 p-4 lg:p-5">
            <div>
              <h4 className="request-section-heading text-sm font-semibold text-[#111827]"><RequestCalendarIcon size={18} aria-hidden="true" className="md:hidden" />Request type & schedule</h4>
              <p className="text-xs text-[#6b7280]">Equipment usage locations do not reserve rooms. Faculty laboratory reservations can include equipment.</p>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280] mb-2">Request type</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: true, label: 'Computer Lab' },
                    { value: false, label: 'Equipment' },
                  ].map((option) => {
                    const active = useLabRoom === option.value;
                    return (
                      <button
                        key={String(option.value)}
                        type="button"
                        onClick={() => setUseLabRoom(option.value)}
                        className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-[#800000] ${
                          active ? 'bg-[#800000] text-white border-[#800000] shadow-[0_8px_16px_rgba(128,0,0,0.25)]' : 'bg-white text-[#374151] border-[#e5e7eb] hover:border-[#cbd5f5]'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {useLabRoom ? (
                <div data-field="labId">
                  <DropdownField
                    label={<FieldLabel text="Laboratory room" required showMissing={missingFields.includes('labId')} />}
                    value={form.labId}
                    options={labRoomOptions.map((option) => ({ value: option.value, label: option.label }))}
                    placeholder="Select laboratory room"
                    disabled={!labRoomOptions.length || loading}
                    onChange={(value) => updateForm('labId', value)}
                  />
                </div>
              ) : (
                <div data-field="location">
                  <UsageLocationField key={locationReset} label={<FieldLabel text="Usage Location" required showMissing={missingFields.includes('location')} />} value={form.location} options={generalRoomOptions} loading={loading} onChange={value => updateForm('location', value)} />
                </div>
              )}
              {!labRoomOptions.length && useLabRoom && !loading && (
                <p className="text-xs text-[#b45309] bg-[#fff7ed] border border-[#fde68a] rounded-lg px-3 py-2">
                  No computer labs available yet. Ask the admin to publish them via the academic directory.
                </p>
              )}
              {!generalRoomOptions.length && !useLabRoom && !loading && (
                <p className="text-xs text-[#b45309] bg-[#fff7ed] border border-[#fde68a] rounded-lg px-3 py-2">
                  No rooms are listed yet. Enter your intended venue or address above.
                </p>
              )}
            </div>

            {/* Date and Time Selection */}
            <div className="mt-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-[#6b7280]">
                    <FieldLabel text="Date of use" required showMissing={missingFields.includes('dateNeeded')} />
                  </label>
                  <StyledDatePicker
                    value={form.dateNeeded ? new Date(form.dateNeeded + 'T00:00:00') : null}
                    onChange={(date) => updateForm('dateNeeded', date ? date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0') : '')}
                    placeholder="Select a date"
                    className="w-full"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-[#6b7280]">
                      <FieldLabel text="Time start" required showMissing={missingFields.includes('timeStart')} />
                    </label>
                    <DropdownField
                      value={form.timeStart}
                      options={timeOptions}
                      placeholder="Select start time"
                      onChange={(value) => updateForm('timeStart', value)}
                      className="text-xs font-normal"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-[#6b7280]">
                      <FieldLabel text="Time end" required showMissing={missingFields.includes('timeEnd')} />
                    </label>
                    <DropdownField
                      value={form.timeEnd}
                      options={timeOptions}
                      placeholder="Select end time"
                      onChange={(value) => updateForm('timeEnd', value)}
                      className="text-xs font-normal"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule Conflict Status */}
            {useLabRoom && (
              <ConflictStatusCard requestGuidance
                status={conflictCheck.status}
                ready={conflictCheck.ready}
                loading={conflictCheck.loading}
                error={conflictCheck.error}
                hasDetails={conflictCheck.conflicts.length > 0}
                onShowDetails={() => setConflictModalOpen(true)}
                onRetry={conflictCheck.refetch}
              />
            )}

            <div className="request-equipment-section mt-4">
              <UnifiedEquipmentSection
                equipment={equipmentList}
                selectedEquipment={selectedEquipment}
                onEquipmentChange={handleEquipmentChange}
                onEquipmentClear={(equipmentId) => handleEquipmentChange(equipmentId, 0, 0)}
                academicContext={academicContext}
                dateNeeded={form.dateNeeded}
                timeStart={form.timeStart}
                timeEnd={form.timeEnd}
                loading={loading}
                excludeRequestId={editingRequest?.id}
              />
            </div>
          </section>

          <section className="space-y-4 p-4 lg:p-5">
            <div>
              <h4 className="request-section-heading text-sm font-semibold text-[#111827]"><RequestAcademicIcon size={18} aria-hidden="true" className="md:hidden" />Academic details</h4>
              <p className="text-xs text-[#6b7280]">Specify the supervising faculty, program, year level, and subject.</p>
            </div>
            <div className="space-y-3">
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1" data-field="facultyId">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                    <FieldLabel text="Faculty in charge" required showMissing={missingFields.includes('facultyId')} />
                  </label>
                  <div className="rounded-xl border border-[#d1d5db] bg-[#f3f4f6] px-3 py-2 text-sm text-[#6b7280]">
                    <span className="font-semibold text-[#111827]">
                      {resources?.faculty.find((option) => option.value === resources?.selfFacultyProfileId)?.label || 'Your faculty profile'}
                    </span>
                    <span className="ml-2 text-[11px] uppercase tracking-wide">Read only</span>
                  </div>
                  <p className="text-[11px] text-[#6b7280]">Contact the admin if you need another faculty assigned.</p>
                </div>
                <div className="min-w-0" data-field="subjectId">
                  <DropdownField
                    label={<FieldLabel text="Subject" required showMissing={missingFields.includes('subjectId')} />}
                    value={form.subjectId}
                    options={subjectOptions.map((option) => ({ value: option.value, label: option.label }))}
                    placeholder="Select subject"
                    disabled={!subjectOptions.length || loading}
                    onChange={(value) => updateForm('subjectId', value)}
                  />
                </div>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="min-w-0" data-field="programId">
                  <DropdownField
                    label={<FieldLabel text="Program" required showMissing={missingFields.includes('programId')} />}
                    value={form.programId}
                    options={programOptions.map((option) => ({ value: option.value, label: option.label }))}
                    placeholder="Select program"
                    disabled={!programOptions.length || loading}
                    onChange={(value) => updateForm('programId', value)}
                  />
                </div>
                <div className="min-w-0" data-field="yearLevel">
                  <DropdownField
                    label={<FieldLabel text="Year level" required showMissing={missingFields.includes('yearLevel')} />}
                    value={form.yearLevel}
                    options={YEAR_LEVELS.map((year) => ({ value: year, label: `Year ${year}` }))}
                    placeholder="Select year"
                    disabled={loading}
                    onChange={(value) => updateForm('yearLevel', value)}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4 p-4 lg:p-5">
            <div>
              <h4 className="request-section-heading text-sm font-semibold text-[#111827]"><RequestPurposeIcon size={18} aria-hidden="true" className="md:hidden" />Purpose & contact</h4>
              <p className="text-xs text-[#6b7280]">Provide contacts plus rationale for your request.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[#6b7280]">
                  <FieldLabel text="Contact details" optional />
                </label>
                <input
                  type="text"
                  placeholder="Mobile number or email"
                  value={form.contactDetails}
                  onChange={(event) => updateForm('contactDetails', event.target.value)}
                  className="rounded-xl border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#800000]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[#6b7280]">
                  <FieldLabel text="Purpose" required showMissing={missingFields.includes('purpose')} />
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex: Capstone rehearsal, board exam review..."
                  value={form.purpose}
                  onChange={(event) => updateForm('purpose', event.target.value)}
                  className="rounded-xl border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#800000]"
                  data-field="purpose"
                />
              </div>
            </div>
          </section>
        </div>
      </PanelSection>

      <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#111827]">Request summary</p>
          <div className="text-xs text-[#6b7280] space-y-1">
            <p>
              {equipmentSelections.length === 0
                ? 'No equipment reserved. You can still submit a request without equipment.'
                : `${equipmentSelections.length} equipment types · ${equipmentSelections.reduce((sum, [, qty]) => sum + qty, 0)} units selected.`}
            </p>
            {selectedEquipmentDetails.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer py-3 text-xs font-semibold text-[#800000]">Review selected equipment</summary>
                <ul className="divide-y divide-[#ead7d3]">
                  {selectedEquipmentDetails.map(item => <li key={item.id} className="flex justify-between gap-3 py-2"><span>{item.name}</span><span className="shrink-0 font-semibold">×{item.qty}</span></li>)}
                </ul>
              </details>
            )}
            {missingFields.length > 0 && (
              <button
                type="button"
                onClick={() => focusField(missingFields[0])}
                className="mt-2 min-h-11 rounded-xl border border-[#f4dfac] bg-[#fffaf0] px-3 py-2 text-left text-xs font-medium leading-relaxed text-[#92400e]"
              >
                Complete these fields: {missingFields.map((field) => requiredFieldLabels[field]).join(', ')}
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {editingRequest ? (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold rounded-full border border-[#e5e7eb] text-[#374151]"
            >
              Cancel editing
            </button>
          ) : (
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-xs font-semibold rounded-full border border-[#e5e7eb] text-[#374151]"
            >
              Clear form
            </button>
          )}
          <button
            type="submit"
            disabled={submitDisabled}
            className={`px-5 py-2 text-xs font-semibold rounded-full text-white transition shadow-[0_6px_20px_rgba(128,0,0,0.25)]
              ${submitDisabled ? 'bg-[#b56565] cursor-not-allowed' : 'bg-[#800000] hover:bg-[#6b0000]'}
            `}
          >
            {submitting ? (editingRequest ? 'Saving…' : 'Submitting…') : editingRequest ? 'Save changes' : 'Submit request draft'}
          </button>
        </div>
      </div>
    </form>
    {conflictModalOpen && (
      <ConflictDetailModal
        conflicts={conflictCheck.conflicts}
        onClose={() => setConflictModalOpen(false)}
      />
    )}
    </>
  );
}
