import { useEffect, useId, useMemo, useState } from 'react';
import { academicPeriodApi } from '../../services/api';
import DropdownField from './DropdownField';

export type AcademicPeriodSelection = {
  academicYearId: string;
  termId: string;
};

type AcademicYearOption = {
  id: string;
  year: string;
  isActive?: boolean;
};

type TermOption = {
  id: string;
  name: string;
  isActive?: boolean;
};

type AcademicPeriodPayload = {
  current?: {
    academicYear: AcademicYearOption;
    term: TermOption;
  } | null;
  academicYears?: AcademicYearOption[];
  terms?: TermOption[];
};

type AcademicPeriodFilterProps = {
  value: AcademicPeriodSelection;
  onChange: (selection: AcademicPeriodSelection) => void;
  className?: string;
  compact?: boolean;
  compactDropdown?: boolean;
  showCompactDropdownLabel?: boolean;
};

export default function AcademicPeriodFilter({
  value,
  onChange,
  className = '',
  compact = false,
  compactDropdown = false,
  showCompactDropdownLabel = true,
}: AcademicPeriodFilterProps) {
  const controlsId = `${useId().replace(/:/g, '')}-academic-period-controls`;
  const [data, setData] = useState<AcademicPeriodPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    let mounted = true;
    academicPeriodApi.get()
      .then((response) => {
        if (mounted) setData(response.data as AcademicPeriodPayload);
      })
      .catch(() => {
        if (mounted) setData(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const years = data?.academicYears ?? [];
  const terms = data?.terms ?? [];
  const activeAcademicYearId = data?.current?.academicYear.id;
  const activeTermId = data?.current?.term.id;
  const activeSelection = useMemo<AcademicPeriodSelection | null>(() => {
    if (!activeAcademicYearId || !activeTermId) return null;
    return {
      academicYearId: activeAcademicYearId,
      termId: activeTermId,
    };
  }, [activeAcademicYearId, activeTermId]);

  useEffect(() => {
    if (!data || value.academicYearId || value.termId || !activeSelection) return;
    onChange(activeSelection);
  }, [activeSelection, data, onChange, value.academicYearId, value.termId]);

  const selectedYearExists = years.some((year) => year.id === value.academicYearId);
  const selectedTermExists = terms.some((term) => term.id === value.termId);

  useEffect(() => {
    if (!data || !activeSelection) return;
    if ((value.academicYearId && !selectedYearExists) || (value.termId && !selectedTermExists)) {
      onChange(activeSelection);
    }
  }, [
    activeSelection,
    data,
    onChange,
    selectedTermExists,
    selectedYearExists,
    value.academicYearId,
    value.termId,
  ]);

  const activeLabel = data?.current
    ? `${data.current.academicYear.year} · ${data.current.term.name}`
    : 'Active period';

  const selectedYear = years.find((year) => year.id === value.academicYearId);
  const selectedTerm = terms.find((term) => term.id === value.termId);
  const selectedLabel =
    selectedYear && selectedTerm
      ? `${selectedYear.year} · ${selectedTerm.name}`
      : loading
        ? 'Loading period…'
        : activeLabel;
  if (compact) {
    if (compactDropdown) {
      return (
        <div className={`academic-period-filter--compact min-h-10 rounded-xl border border-[#ead7d3] bg-transparent px-3 ${className}`}>
          <div className="flex min-h-10 flex-wrap items-center gap-2">
            {showCompactDropdownLabel && (
              <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-[#800000]">
                Academic period
              </span>
            )}
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
              <DropdownField
                value={value.academicYearId}
                onChange={(academicYearId) => onChange({ ...value, academicYearId })}
                options={years.map((year) => ({
                  value: year.id,
                  label: `${year.year}${year.isActive ? ' · Active' : ''}`,
                }))}
                placeholder={loading ? 'Loading year…' : 'No academic years'}
                disabled={loading || years.length === 0}
                className="min-w-0"
                id={`${controlsId}-academic-year-compact`}
                testId={`select-academic-year-filter-${controlsId}`}
              />
              <DropdownField
                value={value.termId}
                onChange={(termId) => onChange({ ...value, termId })}
                options={terms.map((term) => ({
                  value: term.id,
                  label: `${term.name}${term.isActive ? ' · Active' : ''}`,
                }))}
                placeholder={loading ? 'Loading term…' : 'No terms'}
                disabled={loading || terms.length === 0}
                className="min-w-0"
                id={`${controlsId}-term-compact`}
                testId={`select-term-filter-${controlsId}`}
              />
            </div>
            <button
              type="button"
              onClick={() => activeSelection && onChange(activeSelection)}
              disabled={loading || !activeSelection}
              aria-label="Use active academic period"
              data-testid={`button-use-active-period-${controlsId}`}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#ead7d3] bg-[#fffaf8] px-3 text-[11px] font-semibold text-[#800000] transition-colors hover:border-[#c9a5a0] hover:bg-[#f4e2df] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#800000] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m4.5 10 3.5 3.5L15.5 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Use active
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className={`academic-period-filter--compact min-h-10 rounded-xl border border-[#ead7d3] bg-[#fffaf8] px-3 ${className}`}>
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
            <p className="shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-[#800000]">Academic period</p>
            <p className="min-w-0 truncate text-xs font-semibold text-[#374151]" title={selectedLabel}>{selectedLabel}</p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => activeSelection && onChange(activeSelection)}
              disabled={loading || !activeSelection}
              data-testid={`button-use-active-period-${controlsId}`}
              className="inline-flex min-h-10 items-center whitespace-nowrap rounded-lg px-2 text-[11px] font-semibold text-[#800000] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              Use active
            </button>
            <button
              type="button"
              onClick={() => setShowControls((current) => !current)}
              aria-expanded={showControls}
              aria-controls={controlsId}
              data-testid={`button-toggle-academic-period-${controlsId}`}
              className={`inline-flex min-h-10 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors ${
                showControls
                  ? 'border-[#800000] bg-white text-[#800000]'
                  : 'border-[#d8c7c3] bg-white text-[#4b5563] hover:border-[#800000] hover:text-[#800000]'
              }`}
            >
              {showControls ? 'Hide' : 'Change'}
              <svg
                aria-hidden="true"
                className={`h-3.5 w-3.5 transition-transform ${showControls ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
        <div
          id={controlsId}
          hidden={!showControls}
          className="mt-2.5 grid gap-2.5 border-t border-[#ead7d3] pt-2.5 sm:grid-cols-2"
        >
            <label className="text-[11px] font-semibold text-[#4b5563]">
              Academic year
              <DropdownField
                value={value.academicYearId}
                onChange={(academicYearId) => onChange({ ...value, academicYearId })}
                options={years.map((year) => ({
                  value: year.id,
                  label: `${year.year}${year.isActive ? ' · Active' : ''}`,
                }))}
                placeholder={loading ? 'Loading year…' : 'No academic years'}
                disabled={loading || years.length === 0}
                className="mt-1"
                id={`${controlsId}-academic-year`}
                testId={`select-academic-year-filter-${controlsId}`}
              />
            </label>
            <label className="text-[11px] font-semibold text-[#4b5563]">
              Term
              <DropdownField
                value={value.termId}
                onChange={(termId) => onChange({ ...value, termId })}
                options={terms.map((term) => ({
                  value: term.id,
                  label: `${term.name}${term.isActive ? ' · Active' : ''}`,
                }))}
                placeholder={loading ? 'Loading term…' : 'No terms'}
                disabled={loading || terms.length === 0}
                className="mt-1"
                id={`${controlsId}-term`}
                testId={`select-term-filter-${controlsId}`}
              />
            </label>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-[#ead7d3] bg-[#fffaf8] p-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#800000]">Academic period</p>
          <p className="mt-1 text-xs text-[#6b7280]">
            Defaults to the active period. Select an older period to view historical records.
          </p>
        </div>
        <button
          type="button"
          onClick={() => activeSelection && onChange(activeSelection)}
          disabled={loading || !activeSelection}
          data-testid={`button-use-active-period-${controlsId}`}
          className="inline-flex min-h-10 items-center rounded-lg px-2 text-xs font-semibold text-[#800000] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          Use active period
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-[#4b5563]">
          Academic year
          <select
            aria-label="Academic year filter"
            value={value.academicYearId}
            onChange={(event) => onChange({ ...value, academicYearId: event.target.value })}
            disabled={loading || years.length === 0}
            className="mt-1 h-10 w-full rounded-xl border border-[#d8c7c3] bg-white px-3 text-sm font-normal text-[#1f2937] outline-none focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/10"
          >
            {years.length === 0 && <option value="">No academic years</option>}
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.year}{year.isActive ? ' · Active' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-[#4b5563]">
          Term
          <select
            aria-label="Term filter"
            value={value.termId}
            onChange={(event) => onChange({ ...value, termId: event.target.value })}
            disabled={loading || terms.length === 0}
            className="mt-1 h-10 w-full rounded-xl border border-[#d8c7c3] bg-white px-3 text-sm font-normal text-[#1f2937] outline-none focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/10"
          >
            {terms.length === 0 && <option value="">No terms</option>}
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name}{term.isActive ? ' · Active' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-2 text-[11px] text-[#9ca3af]">
        Current default: {activeLabel}
      </p>
    </div>
  );
}