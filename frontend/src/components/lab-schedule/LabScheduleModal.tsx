import { combineManilaDateTime as combineDateTime, dateToDateKey, dateToTimeString, dateKeyToPickerDate, pickerDateToDateKey } from '../../utils/dateTime';
import { useState, useMemo, } from 'react';
import DropdownField from '../shared/DropdownField';
import { StyledDatePicker } from '../shared/StyledDatePicker';
import { labScheduleApi } from '../../services/api';
import type { ApiLabSchedule, ScheduleType, LabScheduleResources, AcademicContextSelection } from '../../types/labSchedule';
import {
  useScheduleConflictCheck,
  type ConflictCheckStatus,
  type ScheduleConflict,
} from '../../hooks/useScheduleConflictCheck';
import { toast } from '../../stores/toastStore';
import { YEAR_LEVELS } from '../../constants/yearLevels';

interface LabScheduleModalProps {
  onClose: () => void;
  resources: LabScheduleResources | null;
  academicContext: AcademicContextSelection | null;
  loading?: boolean;
  error?: string | null;
  onCreated?: () => void;
  onUpdated?: () => void;
  mode?: 'create' | 'edit';
  schedule?: ApiLabSchedule | null;
}

const timeOptions: { value: string; label: string }[] = (() => {
  const options: { value: string; label: string }[] = [];
  for (let hour = 7; hour <= 21; hour++) {
    const startMinute = hour === 7 ? 30 : 0;
    for (let minute = startMinute; minute < 60; minute += 30) {
      const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const ampm = hour < 12 ? 'AM' : 'PM';
      const label = `${h.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${ampm}`;
      const value = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      options.push({ value, label });
    }
  }
  return options;
})();

const weekdayOptions = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

type FormValues = {
  scheduleType: ScheduleType;
  scheduleDate: string;
  dayOfWeek: string;
  timeStart: string;
  timeEnd: string;
  roomId: string;
  facultyId: string;
  programId: string;
  subjectId: string;
  yearLevel: string;
};

const createEmptyFormValues = (): FormValues => ({
  scheduleType: 'ONE_TIME',
  scheduleDate: '',
  dayOfWeek: '',
  timeStart: '',
  timeEnd: '',
  roomId: '',
  facultyId: '',
  programId: '',
  subjectId: '',
  yearLevel: '',
});

const toDateInputValue = dateToDateKey;

const toTimeInputValue = dateToTimeString;

const buildFormValuesFromSchedule = (schedule: ApiLabSchedule): FormValues => {
  const result = {
    scheduleType: schedule.scheduleType,
    scheduleDate: schedule.scheduleType === 'ONE_TIME' ? toDateInputValue(schedule.scheduleDate) : '',
    dayOfWeek:
      schedule.scheduleType === 'WEEKLY' && typeof schedule.dayOfWeek === 'number'
        ? String(schedule.dayOfWeek)
        : '',
    timeStart: toTimeInputValue(schedule.timeStart),
    timeEnd: toTimeInputValue(schedule.timeEnd),
    roomId: schedule.room?.id ?? '',
    facultyId: schedule.faculty?.id ?? '',
    programId: schedule.program?.id ?? '',
    subjectId: schedule.subject?.id ?? '',
    yearLevel: schedule.yearLevel != null ? String(schedule.yearLevel) : '',
  };
  return result;
};

export default function LabScheduleModal({
  onClose,
  resources,
  academicContext,
  loading = false,
  error,
  onCreated,
  onUpdated,
  mode = 'create',
  schedule = null,
}: LabScheduleModalProps) {
  const isEditMode = mode === 'edit';
  const [formValues, setFormValues] = useState<FormValues>(() => createEmptyFormValues());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConflictModalOpen, setConflictModalOpen] = useState(false);

  const FormInputs = [isEditMode, schedule];
  const [FormPrevious, setFormPrevious] = useState<unknown[] | null>(null);
  if (!FormPrevious || FormInputs.some((value, index) => !Object.is(value, FormPrevious[index]))) {
    setFormPrevious(FormInputs);
    if (isEditMode && schedule) {
      setFormValues(buildFormValuesFromSchedule(schedule));
    } else if (!isEditMode) {
      setFormValues(createEmptyFormValues());
    }
    setSubmitError(null);
  }

  const roomOptions = useMemo(
    () => (resources?.rooms ?? []).filter((room) => room.isComputerLab === true),
    [resources?.rooms]
  );
  const facultyOptions = useMemo(() => resources?.faculty ?? [], [resources]);
  const programOptions = useMemo(() => resources?.programs ?? [], [resources]);
  const subjectOptions = useMemo(() => resources?.subjects ?? [], [resources]);
  const yearOptions = useMemo(() => YEAR_LEVELS.map((year) => ({ label: `Year ${year}`, value: year })), []);

  const selectedRoomOption = useMemo(
    () => roomOptions.find((room) => room.value === formValues.roomId) ?? null,
    [roomOptions, formValues.roomId]
  );

  const conflictParams = useMemo(() => {
    if (!academicContext) return null;
    if (!selectedRoomOption) return null;
    return {
      scheduleType: formValues.scheduleType,
      scheduleDate: formValues.scheduleType === 'ONE_TIME' ? formValues.scheduleDate || undefined : undefined,
      dayOfWeek: formValues.scheduleType === 'WEEKLY' ? formValues.dayOfWeek || undefined : undefined,
      timeStart: formValues.timeStart || undefined,
      timeEnd: formValues.timeEnd || undefined,
      roomId: formValues.roomId || undefined,
      roomLabel: selectedRoomOption.label,
      academicYearId: academicContext.academicYearId,
      termId: academicContext.termId,
      excludeScheduleId: isEditMode && schedule ? schedule.id : undefined,
    };
  }, [academicContext, formValues, selectedRoomOption, isEditMode, schedule]);

  const conflictCheck = useScheduleConflictCheck(conflictParams);
  const conflictBlocked = conflictCheck.status === 'danger';

  const handleSelectChange = (name: keyof typeof formValues, value: string) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleScheduleTypeChange = (value: ScheduleType) => {
    setFormValues((prev) => ({
      ...prev,
      scheduleType: value,
      scheduleDate: value === 'ONE_TIME' ? prev.scheduleDate : '',
      dayOfWeek: value === 'WEEKLY' ? prev.dayOfWeek : '',
    }));
  };

  const validateForm = () => {
    const requiredFields: { field: keyof typeof formValues; label: string }[] = [
      { field: 'timeStart', label: 'Start time' },
      { field: 'timeEnd', label: 'End time' },
      { field: 'roomId', label: 'Room' },
      { field: 'facultyId', label: 'Faculty' },
      { field: 'programId', label: 'Program' },
      { field: 'subjectId', label: 'Subject' },
    ];

    if (formValues.scheduleType === 'ONE_TIME') {
      requiredFields.unshift({ field: 'scheduleDate', label: 'Schedule date' });
    } else {
      requiredFields.unshift({ field: 'dayOfWeek', label: 'Day of week' });
    }

    for (const { field, label } of requiredFields) {
      if (!formValues[field]) {
        return `${label} is required.`;
      }
    }

    if (!academicContext) {
      return 'Academic context is unavailable. Please refresh and try again.';
    }

    const dateForCombination = formValues.scheduleType === 'ONE_TIME' ? formValues.scheduleDate : null;
    const startIso = combineDateTime(dateForCombination, formValues.timeStart);
    const endIso = combineDateTime(dateForCombination, formValues.timeEnd);
    if (!startIso || !endIso) {
      return 'Invalid date or time selection.';
    }
    if (new Date(startIso) >= new Date(endIso)) {
      return 'End time must be after start time.';
    }

    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    if (isEditMode && !schedule) {
      setSubmitError('No schedule selected for editing.');
      return;
    }

    const scheduleType = formValues.scheduleType;
    const scheduleDate = scheduleType === 'ONE_TIME' ? formValues.scheduleDate : null;
    const dayOfWeek = scheduleType === 'WEEKLY' ? Number(formValues.dayOfWeek) : null;
    const timeStart = combineDateTime(scheduleDate, formValues.timeStart)!;
    const timeEnd = combineDateTime(scheduleDate, formValues.timeEnd)!;

    if (!academicContext) {
      setSubmitError('Academic context is unavailable. Please refresh and try again.');
      return;
    }

    const payload: Record<string, unknown> = {
      roomId: formValues.roomId,
      facultyId: formValues.facultyId,
      programId: formValues.programId,
      subjectId: formValues.subjectId,
      yearLevel: formValues.yearLevel ? Number(formValues.yearLevel) : null,
      scheduleType,
      scheduleDate,
      dayOfWeek,
      timeStart,
      timeEnd,
      academicYearId: academicContext.academicYearId,
      termId: academicContext.termId,
    };

    try {
      setSubmitError(null);
      setIsSubmitting(true);
      if (isEditMode && schedule) {
        await labScheduleApi.update(schedule.id, payload);
        toast.success('Lab schedule updated successfully.');
        onUpdated?.();
      } else {
        await labScheduleApi.create(payload);
        toast.success('Lab schedule created successfully.');
        onCreated?.();
      }
    } catch (submitErr) {
      let message = isEditMode ? 'Failed to update schedule. Please try again.' : 'Failed to create schedule. Please try again.';
      if (typeof submitErr === 'object' && submitErr && 'response' in submitErr) {
        const apiErr = submitErr as { response?: { data?: { error?: string; message?: string } } };
        message = apiErr.response?.data?.message ?? apiErr.response?.data?.error ?? message;
      }
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFormFields = () => {
    if (loading) {
      return <div className="p-4 text-sm text-[#6b7280]">Loading schedule resources…</div>;
    }

    if (!resources || !academicContext) {
      return (
        <div className="p-4 text-sm text-red-600">
          {error ?? 'Unable to load schedule resources. Please try again later.'}
        </div>
      );
    }

    return (
      <>
        <div className="flex flex-col gap-1 rounded-xl border border-[#fef3e2] bg-[#fff8ec] px-4 py-3">
          <p className="text-[11px] font-semibold text-[#b45309] uppercase tracking-wide">Academic Context</p>
          <p className="text-sm font-medium text-[#92400e]">
            {academicContext.academicYearLabel} • {academicContext.termLabel}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280] mb-2">Schedule Type</p>
          
          {/* Check if schedule type can be changed */}
          {mode === 'edit' && schedule && schedule._meta?.isRequestDerived ? (
            <div className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">One Time</span>
                <span className="text-xs text-gray-500">(From request)</span>
              </div>
              <p className="mt-1 text-[11px] text-gray-500">
                Occurs on the specific date below. Schedule type is locked because this was created from a request.
              </p>
            </div>
          ) : (
            <div className="flex gap-2">
              {(['ONE_TIME', 'WEEKLY'] as ScheduleType[]).map((type) => {
                const isActive = formValues.scheduleType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleScheduleTypeChange(type)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      isActive ? 'border-[#800000] bg-[#800000] text-white' : 'border-[#e5e7eb] text-[#374151]'
                    }`}
                  >
                    {type === 'ONE_TIME' ? 'One Time' : 'Weekly'}
                  </button>
                );
              })}
            </div>
          )}
          {/* Show description for admin-created schedules or create mode */}
          {(mode === 'create' || (schedule && !schedule._meta?.isRequestDerived)) && (
            <p className="mt-1 text-[11px] text-[#6b7280]">
              {formValues.scheduleType === 'WEEKLY'
                ? 'Repeats on the selected weekday within the current academic context.'
                : 'Occurs on the specific date below.'}
            </p>
          )}
        </div>
        <DropdownField
          label="Laboratory room"
          value={formValues.roomId}
          options={roomOptions}
          placeholder="Select laboratory room"
          onChange={(value) => handleSelectChange('roomId', value)}
        />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {formValues.scheduleType === 'ONE_TIME' ? (
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Schedule date</label>
              <StyledDatePicker
                value={dateKeyToPickerDate(formValues.scheduleDate)}
                onChange={(date) => handleSelectChange('scheduleDate', pickerDateToDateKey(date))}
                placeholder="Select a date"
                className="w-full"
              />
            </div>
          ) : (
            <DropdownField
              label="Weekday"
              value={formValues.dayOfWeek}
              options={weekdayOptions}
              placeholder="Select weekday"
              onChange={(value) => handleSelectChange('dayOfWeek', value)}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <DropdownField
              label="Start time"
              value={formValues.timeStart}
              options={timeOptions}
              placeholder="Select start time"
              onChange={(value) => handleSelectChange('timeStart', value)}
              className="text-xs font-normal"
            />
            <DropdownField
              label="End time"
              value={formValues.timeEnd}
              options={timeOptions}
              placeholder="Select end time"
              onChange={(value) => handleSelectChange('timeEnd', value)}
              className="text-xs font-normal"
            />
          </div>
          <div className="lg:col-span-2">
            <ConflictStatusCard
              status={conflictCheck.status}
              ready={conflictCheck.ready}
              loading={conflictCheck.loading}
              error={conflictCheck.error}
              hasDetails={conflictCheck.conflicts.length > 0}
              onShowDetails={() => setConflictModalOpen(true)}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <DropdownField
            label="Faculty"
            value={formValues.facultyId}
            options={facultyOptions}
            placeholder="Assign faculty"
            onChange={(value) => handleSelectChange('facultyId', value)}
          />
          <DropdownField
            label="Subject"
            value={formValues.subjectId}
            options={subjectOptions}
            placeholder="Select subject"
            onChange={(value) => handleSelectChange('subjectId', value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <DropdownField
            label="Program"
            value={formValues.programId}
            options={programOptions}
            placeholder="Select program"
            onChange={(value) => handleSelectChange('programId', value)}
          />
          <DropdownField
            label="Year level"
            value={formValues.yearLevel}
            options={yearOptions}
            placeholder="Optional"
            onChange={(value) => handleSelectChange('yearLevel', value)}
          />
        </div>
        {submitError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{submitError}</p>
        )}
      </>
    );
  };

  const formId = 'lab-schedule-form';
  const submitDisabled =
    isSubmitting ||
    loading ||
    !resources ||
    !academicContext ||
    conflictBlocked;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full max-w-xl bg-white h-full shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-[#f3f4f6] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#111827]">{isEditMode ? 'Edit lab schedule' : 'Add lab schedule'}</p>
            <p className="text-xs text-[#6b7280]">
              {isEditMode ? 'Update schedule details and resolve conflicts.' : 'Reserve a lab slot for a faculty member.'}
            </p>
          </div>
          <button className="text-[#6b7280] hover:text-[#111827]" type="button" onClick={onClose}>
            ✕
          </button>
        </div>
        <form id={formId} className="flex-1 overflow-y-auto px-5 py-4 space-y-4" onSubmit={handleSubmit}>
          {renderFormFields()}
        </form>
        <div className="px-5 py-4 border-t border-[#f3f4f6] flex flex-col gap-2 sm:flex-row sm:justify-end sm:items-center">
          {conflictBlocked && (
            <p className="text-xs font-semibold text-[#b91c1c]">Resolve schedule conflicts to enable saving.</p>
          )}
          <div className="flex gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#374151] rounded-full border border-[#e5e7eb]"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              form={formId}
              disabled={submitDisabled}
              className={`px-4 py-2 text-xs font-semibold text-white rounded-full shadow-[0_4px_12px_rgba(128,0,0,0.25)] ${
                submitDisabled ? 'bg-[#b56565] cursor-not-allowed' : 'bg-[#800000]'
              }`}
            >
              {isSubmitting ? 'Saving…' : isEditMode ? 'Update schedule' : 'Save schedule'}
            </button>
          </div>
        </div>
      </div>
      {isConflictModalOpen && conflictCheck.conflicts.length > 0 && (
        <ConflictDetailModal conflicts={conflictCheck.conflicts} onClose={() => setConflictModalOpen(false)} />
      )}
    </div>
  );
}

type ConflictStatusCardProps = {
  status: ConflictCheckStatus;
  ready: boolean;
  loading: boolean;
  error: string | null;
  hasDetails: boolean;
  onShowDetails: () => void;
};

const statusTokens: Record<ConflictCheckStatus | 'waiting', { bg: string; text: string; icon: string; label: string }> = {
  waiting: {
    bg: 'bg-[#f9fafb]',
    text: 'text-[#6b7280]',
    icon: '⏳',
    label: 'Provide date, time, and room to check conflicts.',
  },
  idle: { bg: 'bg-[#f9fafb]', text: 'text-[#6b7280]', icon: '⏳', label: 'Ready to check conflicts.' },
  checking: { bg: 'bg-[#eff6ff]', text: 'text-[#1d4ed8]', icon: '🔄', label: 'Checking for conflicts…' },
  good: { bg: 'bg-[#ecfdf3]', text: 'text-[#047857]', icon: '✔️', label: 'No conflicts detected.' },
  warning: { bg: 'bg-[#fff7ed]', text: 'text-[#9a3412]', icon: '⚠️', label: 'Pending requests overlap this slot.' },
  danger: { bg: 'bg-[#fef2f2]', text: 'text-[#b91c1c]', icon: '⛔', label: 'Active schedule conflict detected.' },
  error: { bg: 'bg-[#fef2f2]', text: 'text-[#b91c1c]', icon: '❗', label: 'Unable to check conflicts. Try again.' },
};

function ConflictStatusCard({ status, ready, loading, error, hasDetails, onShowDetails }: ConflictStatusCardProps) {
  const token = ready ? statusTokens[status] : statusTokens.waiting;
  return (
    <div className={`rounded-2xl border border-[#e5e7eb] px-4 py-3 flex items-center justify-between gap-4 ${token.bg}`}>
      <div className={`flex items-center gap-2 text-sm font-semibold ${token.text}`}>
        <span aria-hidden>{token.icon}</span>
        <span>{status === 'error' && error ? error : token.label}</span>
      </div>
      {hasDetails && (
        <button type="button" onClick={onShowDetails} className="text-xs font-semibold text-[#800000] underline">
          View details
        </button>
      )}
      {loading && <span className="sr-only">Checking for conflicts…</span>}
    </div>
  );
}

type ConflictDetailModalProps = {
  conflicts: ScheduleConflict[];
  onClose: () => void;
};

function ConflictDetailModal({ conflicts, onClose }: ConflictDetailModalProps) {
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
