import type { KeyboardEvent, ReactNode } from 'react';
import { getPageTabId } from './pageTabGroupUtils';

export type PageTabOption = {
  id: string;
  label: string;
  count?: ReactNode;
  description?: string;
};

type PageTabGroupProps = {
  tabs: readonly PageTabOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  panelId: string;
};

export default function PageTabGroup({
  tabs,
  value,
  onChange,
  ariaLabel,
  panelId,
}: PageTabGroupProps) {
  const focusTab = (index: number) => {
    const tab = tabs[index];
    if (!tab) return;
    onChange(tab.id);
    window.requestAnimationFrame(() => {
      document.getElementById(getPageTabId(panelId, tab.id))?.focus();
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (tabs.length < 2) return;

    let nextIndex = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    focusTab(nextIndex);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className="page-control-ribbon--tabs min-w-0 max-w-full flex w-full gap-1 overflow-x-auto rounded-xl border p-1"
    >
      {tabs.map((tab, index) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            id={getPageTabId(panelId, tab.id)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            data-testid={`tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`flex h-9 min-w-max flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#800000] focus-visible:ring-offset-2 lg:px-3 lg:text-xs ${
              active
                ? 'bg-[#800000] text-white shadow-sm'
                : 'text-[#4b5563] hover:bg-white hover:text-[#800000]'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  active ? 'bg-white/15 text-white' : 'bg-white text-[#6b7280]'
                }`}
              >
                {tab.count}
              </span>
            )}
            {tab.description && <span className="sr-only">{tab.description}</span>}
          </button>
        );
      })}
    </div>
  );
}