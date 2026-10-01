import { InputField } from './InputField';
import { getDateRangePreset, type DateRangePreset, type DateRangeValue } from './dateRangeUtils';
import type { InputHTMLAttributes } from 'react';

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
  fromInputProps,
  toInputProps,
}: DateRangeFilterProps) {
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

  return (
    <div className={`ribbon-date-range-filter ${className}`} role="group" aria-label={label}>
      <div className="ribbon-filter-label flex flex-wrap items-center gap-x-6 gap-y-1">
        <span>{label}</span>
      </div>
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)]">
        <InputField
          {...fromInputProps}
          type="date"
          aria-label="Start date"
          value={value.from}
          max={value.to || undefined}
          onChange={(event) => onChange({ ...value, from: event.target.value })}
          size="md"
        />
        <InputField
          {...toInputProps}
          type="date"
          aria-label="End date"
          value={value.to}
          min={value.from || undefined}
          onChange={(event) => onChange({ ...value, to: event.target.value })}
          size="md"
        />
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