import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './shared/Button';
import ControlRibbon from './shared/ControlRibbon';
import { InputField } from './shared/InputField';

const SearchIcon = () => (
  <svg className="w-4 h-4 text-[#9ca3af]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="9" cy="9" r="6" />
    <path d="m14 14 4 4" strokeLinecap="round" />
  </svg>
);

const FilterIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 5h14" strokeLinecap="round" />
    <path d="M6 10h8" strokeLinecap="round" />
    <path d="M9 15h2" strokeLinecap="round" />
  </svg>
);

interface PrimaryAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
}

interface FilterToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchInFilters?: boolean;
  primaryAction?: PrimaryAction;
  filters?: ReactNode;
  filtersActiveCount?: number;
  defaultFiltersOpen?: boolean;
  compactFilters?: boolean;
  extraContent?: ReactNode;
  ribbonSummary?: ReactNode;
  actions?: ReactNode;
  bottomControl?: ReactNode;
  reserveBottomClearance?: boolean;
  className?: string;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  refreshError?: boolean;
  lastUpdated?: Date | null;
}

export default function FilterToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search',
  searchInFilters = false,
  primaryAction,
  filters,
  filtersActiveCount = 0,
  defaultFiltersOpen = false,
  compactFilters = false,
  extraContent,
  ribbonSummary,
  actions,
  bottomControl,
  reserveBottomClearance = false,
  className,
  onRefresh,
  refreshing,
  refreshError,
  lastUpdated,
}: FilterToolbarProps) {
  const [showFilters, setShowFilters] = useState(defaultFiltersOpen);
  const filtersPanelId = `${useId().replace(/:/g, '')}-filters`;
  const summaryParts = [
    searchValue.trim() ? 'Search active' : '',
    filtersActiveCount > 0 ? `${filtersActiveCount} filter${filtersActiveCount === 1 ? '' : 's'} active` : '',
    ribbonSummary,
  ].filter(Boolean);

  return (
    <div className={`filter-toolbar filter-toolbar--sticky ${className ?? ''}`}>
      <ControlRibbon
        onRefresh={onRefresh}
        refreshing={refreshing}
        refreshError={refreshError}
        lastUpdated={lastUpdated}
        activeSummary={
          summaryParts.length > 0
            ? summaryParts.map((part, index) => (
                <span key={index}>
                  {index > 0 && <span aria-hidden="true"> · </span>}
                  {part}
                </span>
              ))
            : undefined
        }
        bottomControl={bottomControl}
        reserveBottomClearance={reserveBottomClearance}
        actions={
          <>
            {actions}
            {primaryAction && (
              <Button
                variant="primary"
                size="sm"
                onClick={primaryAction.onClick}
                leftIcon={primaryAction.icon}
                className="rounded-lg"
                style={{ borderRadius: '0.55rem' }}
              >
                {primaryAction.label}
              </Button>
            )}
          </>
        }
      >
        <div role="group" aria-label="Search and filter controls" className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {!searchInFilters && (
              <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none lg:w-64">
                <InputField
                  type="search"
                  aria-label="Search"
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={(event) => onSearchChange(event.target.value)}
                  icon={<SearchIcon />}
                  iconPosition="left"
                  size="md"
                  className="rounded-full"
                />
              </div>
            )}
            {filters && !compactFilters && (
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                aria-expanded={showFilters}
                aria-controls={filtersPanelId}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors ${
                  showFilters
                    ? 'border-[#800000] bg-[#fffaf8] text-[#800000]'
                    : 'border-[#e5e7eb] bg-white text-[#1f2937] hover:border-[#800000] hover:text-[#800000]'
                }`}
              >
                <FilterIcon />
                Filters
                {filtersActiveCount > 0 && (
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#800000] px-1 text-[11px] font-bold text-white">
                    {filtersActiveCount}
                  </span>
                )}
              </button>
            )}
          </div>
            {extraContent && (
              <div role="group" aria-label="Additional controls" className="flex flex-wrap gap-2">
                {extraContent}
              </div>
            )}
          {filters && (
            <div
              role="group"
              aria-label="Filters"
              id={filtersPanelId}
              className={`${compactFilters ? 'flex' : showFilters ? 'flex' : 'hidden'} ribbon-control-group flex-wrap gap-2`}
            >
              {filters}
            </div>
          )}
        </div>
      </ControlRibbon>
    </div>
  );
}
