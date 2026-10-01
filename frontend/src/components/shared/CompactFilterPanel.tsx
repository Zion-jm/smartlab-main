import { createPortal } from 'react-dom';
import { useId, useState, type ReactNode } from 'react';
import ControlRibbon from './ControlRibbon';
import ResetFiltersButton from './ResetFiltersButton';

type CompactFilterPanelProps = {
  primary: ReactNode;
  advanced?: ReactNode;
  advancedCount?: number;
  defaultAdvancedOpen?: boolean;
  activeFilters?: ReactNode;
  hasActiveFilters?: boolean;
  onReset?: () => void;
  summary?: ReactNode;
  collapsible?: boolean;
  ribbonSummary?: ReactNode;
  actions?: ReactNode;
  className?: string;
  sticky?: boolean;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  refreshError?: boolean;
  lastUpdated?: Date | null;
  ribbonToggle?: boolean;
  /**
   * When provided, the advanced-filter handle is rendered only into this
   * target. An explicit null target renders no handle until the target is
   * available, preventing a duplicate during portal target setup.
   *
   * Advanced-filter handles use the outer ribbon's bottom-control placement.
   */
  advancedTogglePortalTarget?: HTMLDivElement | null;
  primaryPortalTarget?: HTMLDivElement | null;
  advancedPortalTarget?: HTMLDivElement | null;
};

const FilterIcon = () => (
  <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M3 5h14M6 10h8M9 15h2" strokeLinecap="round" />
  </svg>
);

export default function CompactFilterPanel({
  primary,
  advanced,
  advancedCount = 0,
  defaultAdvancedOpen = false,
  activeFilters,
  hasActiveFilters = false,
  onReset,
  summary,
  collapsible = false,
  ribbonSummary,
  actions,
  className = '',
  sticky = false,
  onRefresh,
  refreshing,
  refreshError,
  lastUpdated,
  ribbonToggle = false,
  advancedTogglePortalTarget,
  primaryPortalTarget = null,
  advancedPortalTarget = null,
}: CompactFilterPanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(defaultAdvancedOpen);
  const hasAdvancedFilters = Boolean(advanced);
  const advancedPanelId = `${useId().replace(/:/g, '')}-advanced-filters`;

  const ribbonToggleButton = hasAdvancedFilters && ribbonToggle ? (
    <button
      type="button"
      onClick={() => setAdvancedOpen((current) => !current)}
      aria-expanded={advancedOpen}
      aria-controls={advancedPanelId}
      aria-label={advancedOpen ? 'Hide more filters' : 'Show more filters'}
      title={advancedOpen ? 'Hide more filters' : 'Show more filters'}
      className="ribbon-bottom-control"
    >
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path
          d={advancedOpen ? 'm5 12 5-5 5 5' : 'm5 8 5 5 5-5'}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="sr-only">
        {advancedOpen ? 'Hide' : 'Show'} more filters
        {advancedCount > 0 ? `, ${advancedCount} active` : ''}
      </span>
    </button>
  ) : null;

  const usesExplicitAdvancedToggleTarget = advancedTogglePortalTarget !== undefined;
  const advancedTogglePortal = usesExplicitAdvancedToggleTarget && advancedTogglePortalTarget && ribbonToggleButton
    ? createPortal(ribbonToggleButton, advancedTogglePortalTarget)
    : null;

  const advancedContent = (
    <>
      {hasAdvancedFilters && (
        <div
          id={advancedPanelId}
          role="group"
          aria-label="Additional filters"
          hidden={!advancedOpen}
          className="border-t border-[#f1e4e1] pt-3"
        >
          {advanced}
        </div>
      )}

      {(activeFilters || summary || (hasActiveFilters && onReset)) && (
        <div className="compact-filter-panel__active-filter-area">
          {activeFilters}

          {(summary || (hasActiveFilters && onReset)) && (
            <div className="compact-filter-panel__active-filter-summary flex flex-wrap items-center justify-end gap-2 text-[11px] text-[#8b929b]">
              {summary ?? <span />}
              {hasActiveFilters && onReset && (
                <ResetFiltersButton onClick={onReset} />
              )}
            </div>
          )}
        </div>
      )}

    </>
  );

  const panel = (
    <div
      role="group"
      aria-label="Filters"
      className={`ribbon-control-group compact-filter-panel w-full space-y-3 ${className}`}
    >
      <div className="grid grid-cols-1 items-end gap-2.5 md:grid-cols-[minmax(0,1fr)_auto]">
        <div role="group" aria-label="Primary filters" className="min-w-0">{primary}</div>
        {hasAdvancedFilters && !ribbonToggle && (
          <button
            type="button"
            onClick={() => setAdvancedOpen((current) => !current)}
            aria-expanded={advancedOpen}
            aria-controls={advancedPanelId}
            data-testid={`button-toggle-advanced-filters-${advancedPanelId}`}
            className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold shadow-sm transition-colors md:w-auto md:min-w-[9.5rem] ${
              advancedOpen
                ? 'border-[#800000] bg-[#fffaf8] text-[#800000]'
                : 'border-[#d1d5db] bg-white text-[#374151] hover:border-[#800000] hover:text-[#800000]'
            }`}
          >
            <FilterIcon />
            More filters
            {advancedCount > 0 && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#800000] px-1.5 py-0.5 text-[10px] font-bold text-white">
                {advancedCount}
              </span>
            )}
          </button>
        )}
      </div>
      {advancedContent}
    </div>
  );

  const splitPanel = primaryPortalTarget && advancedPortalTarget ? (
    <>
      {createPortal(
        <div role="group" aria-label="Primary filters" className="min-w-0">
          {primary}
        </div>,
        primaryPortalTarget
      )}
      {createPortal(
        <div
          role="group"
          aria-label="Additional report filters"
          className={`ribbon-control-group compact-filter-panel w-full space-y-3 ${className}`}
        >
          {advancedContent}
        </div>,
        advancedPortalTarget
      )}
    </>
  ) : null;

  const renderedPanel = splitPanel ?? panel;

  return collapsible ? (
    <>
      <ControlRibbon
        activeSummary={ribbonSummary ?? summary}
        actions={actions}
        sticky={sticky}
        onRefresh={onRefresh}
        refreshing={refreshing}
        refreshError={refreshError}
        lastUpdated={lastUpdated}
      >
        {renderedPanel}
      </ControlRibbon>
      {advancedTogglePortal}
    </>
  ) : (
    <>
      {renderedPanel}
      {advancedTogglePortal}
    </>
  );
}