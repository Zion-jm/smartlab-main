import { TableScrollContext } from './tableScrollContext';
import { useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { getUserPreferences, usePreferencesStore } from '../../stores/preferencesStore';

type ControlRibbonProps = {
  children: ReactNode;
  activeSummary?: ReactNode;
  actions?: ReactNode;
  bottomControl?: ReactNode;
  reserveBottomClearance?: boolean;
  defaultExpanded?: boolean;
  label?: string;
  className?: string;
  sticky?: boolean;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  refreshError?: boolean;
  lastUpdated?: Date | null;
};

export default function ControlRibbon({
  children,
  activeSummary,
  actions,
  bottomControl,
  reserveBottomClearance = false,
  defaultExpanded,
  label = 'Page controls',
  className = '',
  sticky = false,
  onRefresh,
  refreshing = false,
  refreshError = false,
  lastUpdated,
}: ControlRibbonProps) {
  const ribbonRef = useRef<HTMLElement>(null);
  const { setInset } = useContext(TableScrollContext);
  useEffect(() => {
    const node = ribbonRef.current;
    if (!node) return;
    const update = () => setInset(node.getBoundingClientRect().height + 20);
    const observer = new ResizeObserver(update); observer.observe(node); update();
    return () => { observer.disconnect(); setInset(0); };
  }, [setInset]);
  const userId = useAuthStore((state) => state.user?.id ?? 'anonymous');
  const preferencesByUser = usePreferencesStore((state) => state.preferencesByUser);
  const ribbonExpandedByDefault = !getUserPreferences(preferencesByUser, userId).ribbonControlsHiddenByDefault;
  const [expanded, setExpanded] = useState(defaultExpanded ?? ribbonExpandedByDefault);
  const [trackedLastUpdated, setTrackedLastUpdated] = useState<Date | null>(null);
  const wasRefreshing = useRef(refreshing);
  const id = useId().replace(/:/g, '');
  const contentId = `${id}-control-ribbon`;
  const labelId = `${id}-control-ribbon-label`;
  const displayedLastUpdated = lastUpdated ?? trackedLastUpdated;

  useEffect(() => {
    if (wasRefreshing.current && !refreshing && !refreshError && !lastUpdated) {
      setTrackedLastUpdated(new Date());
    }
    wasRefreshing.current = refreshing;
  }, [lastUpdated, refreshError, refreshing]);

  const handleRefresh = () => {
    if (!onRefresh || refreshing) return;
    try {
      void Promise.resolve(onRefresh()).catch((error) => {
        console.error('Failed to refresh page data', error);
      });
    } catch (error) {
      console.error('Failed to refresh page data', error);
    }
  };

  return (
    <section
      ref={ribbonRef}
      aria-labelledby={labelId}
      className={`page-control-ribbon ${bottomControl && expanded ? 'page-control-ribbon--has-bottom-control' : ''} ${reserveBottomClearance && expanded ? 'page-control-ribbon--reserve-bottom-clearance' : ''} ${sticky ? 'page-control-ribbon--sticky' : ''} ${className}`}
    >
      <div className="page-control-ribbon__bar">
        <div className="min-w-0">
          <h2 id={labelId} className="page-control-ribbon__label">{label}</h2>
          <div className="page-control-ribbon__summary">
            {activeSummary ?? 'No active search or filters'}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onRefresh && (
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              <span role="status" aria-live="polite" className="whitespace-nowrap px-1 text-xs text-[#6b7280]">
                Updated{' '}
                {displayedLastUpdated?.toLocaleTimeString([], { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }) ?? '—'}
              </span>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                aria-label={refreshing ? 'Refreshing page data' : 'Refresh page data'}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 text-xs font-medium text-[#4b5563] transition hover:border-[#c9a5a5] hover:text-[#800000] disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw aria-hidden="true" className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          )}
          {actions}
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={contentId}
            onClick={() => setExpanded((current) => !current)}
            className="page-control-ribbon__toggle"
          >
            <span>{expanded ? 'Hide controls' : 'Show controls'}</span>
            <svg
              aria-hidden="true"
              className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="m5 7 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      <div
        id={contentId}
        className={`page-control-ribbon__content ${expanded ? '' : 'hidden'}`}
        hidden={!expanded}
      >
        <div className="page-control-ribbon__groups">{children}</div>
      </div>
      {expanded ? bottomControl : null}
    </section>
  );
}