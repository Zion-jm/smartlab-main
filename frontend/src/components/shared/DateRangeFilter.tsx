import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { InputField } from './InputField';
import { getDateRangePreset, type DateRangePreset, type DateRangeValue } from './dateRangeUtils';
import { useId, type InputHTMLAttributes } from 'react';

type DateRangeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  'data-testid'?: string;
};

export type DateRangeAction = {
  id: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
};

type DateRangeFilterProps = {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  label?: string;
  styledDates?: boolean;
  className?: string;
  presets?: readonly DateRangePreset[];
  actions?: readonly DateRangeAction[];
  fromInputProps?: DateRangeInputProps;
  toInputProps?: DateRangeInputProps;
};

const DEFAULT_PRESETS: readonly DateRangePreset[] = ['today', 'week', 'month'];

const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
};

export default function DateRangeFilter({
  value,
  onChange,
  label = 'DATE RANGE: FROM - TO',
  className = 'w-full min-w-0 md:w-3/4',
  presets = DEFAULT_PRESETS,
  actions,
  styledDates = true,
  fromInputProps,
  toInputProps,
}: DateRangeFilterProps) {
  const dateId = useId();
  const activePreset = actions
    ? null
    : presets.find((preset) => {
        const range = getDateRangePreset(preset);
        return range.from === value.from && range.to === value.to;
      }) ?? null;

  const dateRangeActions: DateRangeAction[] = actions
    ? [...actions]
    : presets.map((preset) => ({
        id: preset,
        label: PRESET_LABELS[preset],
        active: activePreset === preset,
        onClick: () => onChange(getDateRangePreset(preset)),
      }));

  const parseDate = (key: string) => key ? new Date(key + 'T00:00:00') : null;
  const dateKey = (date: Date | null) => date ? [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-') : '';
  const dateControl = (side: 'from' | 'to') => <div className="schedule-date-control min-w-0">
    <span id={`${dateId}-${side}-label`} className="mb-1 block text-xs font-medium text-[#74615e]">{side === 'from' ? 'From' : 'To'}</span>
    <DatePicker
      selected={parseDate(value[side])}
      onChange={(date: Date | null) => onChange({ ...value, [side]: dateKey(date) })}
      minDate={side === 'to' ? parseDate(value.from) ?? undefined : undefined}
      maxDate={side === 'from' ? parseDate(value.to) ?? undefined : undefined}
      ariaLabelledBy={`${dateId}-${side}-label`}
      ariaLabelClose="Close calendar"
      placeholderText={side === 'from' ? 'From date' : 'To date'}
      dateFormat="dd/MM/yyyy"
      className="schedule-date-input"
      wrapperClassName="w-full"
      calendarClassName="schedule-date-calendar"
      popperClassName="schedule-date-popper"
      popperProps={{ strategy: 'fixed' }}
      popperPlacement="bottom-start"
      showPopperArrow={false}
      showMonthDropdown showYearDropdown dropdownMode="select"
      isClearable
      strictParsing
      id={side === 'from' ? fromInputProps?.id : toInputProps?.id}
    />
  </div>;

  return (
    <div className={`ribbon-date-range-filter ${styledDates ? 'ribbon-date-range-filter--styled' : ''} ${className}`} role="group" aria-label={label}>
      <div className="ribbon-filter-label flex flex-wrap items-center gap-x-6 gap-y-1">
        <span>{label}</span>
      </div>
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)]">
        {styledDates ? dateControl('from') : <InputField
          {...fromInputProps}
          type="date"
          aria-label="Start date"
          value={value.from}
          max={value.to || undefined}
          onChange={(event) => onChange({ ...value, from: event.target.value })}
          size="md"
        />}
        {styledDates ? dateControl('to') : <InputField
          {...toInputProps}
          type="date"
          aria-label="End date"
          value={value.to}
          min={value.from || undefined}
          onChange={(event) => onChange({ ...value, to: event.target.value })}
          size="md"
        />}
        <div
          role="group"
          aria-label={actions ? 'Date range actions' : 'Quick date ranges'}
          className="ribbon-date-range-actions flex h-9 w-full max-w-full self-end overflow-hidden rounded-lg border border-[#d8c7c3]"
        >
          {dateRangeActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              aria-pressed={action.active}
              className={`inline-flex h-9 flex-1 items-center justify-center whitespace-nowrap border-r border-[#d8c7c3] px-2 text-[10px] font-semibold transition-colors last:border-r-0 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#800000] focus-visible:ring-inset ${
                action.active
                  ? 'bg-[#800000] text-white'
                  : 'bg-white text-[#4b5563] hover:bg-[#fff7f5] hover:text-[#800000]'
              } disabled:cursor-not-allowed disabled:bg-[#f3f4f6] disabled:text-[#9ca3af]`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
