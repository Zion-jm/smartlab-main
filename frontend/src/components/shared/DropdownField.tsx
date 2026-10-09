import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

type DropdownOption<T extends string> = {
  label: string;
  value: T;
};

interface DropdownFieldProps<T extends string> {
  label?: ReactNode;
  value: T | '';
  options: DropdownOption<T>[];
  placeholder?: string;
  onChange: (value: T) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  testId?: string;
  portal?: boolean;
  menuMinWidth?: number;
  nowrapOptions?: boolean;
  selectedLabel?: string;
}

export default function DropdownField<T extends string>({
  label: labelText,
  value,
  options,
  placeholder = 'Select an option',
  onChange,
  className = '',
  disabled = false,
  id,
  testId,
  portal = false,
  menuMinWidth = 112,
  nowrapOptions = false,
  selectedLabel,
}: DropdownFieldProps<T>) {
  const generatedSelectId = useId();
  const selectId = id ?? generatedSelectId;
  const listboxId = `${selectId}-options`;
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0, width: 112, maxHeight: 240 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(() => {
    const selectedIndex = options.findIndex((option) => option.value === value);
    return selectedIndex >= 0 ? selectedIndex : 0;
  });
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const DisabledInputs = [disabled];
  const [DisabledPrevious, setDisabledPrevious] = useState<unknown[] | null>(null);
  if (!DisabledPrevious || DisabledInputs.some((value, index) => !Object.is(value, DisabledPrevious[index]))) {
    setDisabledPrevious(DisabledInputs);
    if (disabled) setOpen(false);
  }

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const SelectionInputs = [selectedIndex];
  const [SelectionPrevious, setSelectionPrevious] = useState<unknown[] | null>(null);
  if (!SelectionPrevious || SelectionInputs.some((value, index) => !Object.is(value, SelectionPrevious[index]))) {
    setSelectionPrevious(SelectionInputs);
    if (selectedIndex >= 0) setHighlightedIndex(selectedIndex);
  }

  const openMenu = () => {
    if (portal && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const upward = below < 240 && above > below;
      const maxHeight = Math.max(40, Math.min(240, upward ? above : below));
      const height = Math.min(maxHeight, options.length * 40 + 10);
      const width = Math.min(Math.max(rect.width, menuMinWidth), window.innerWidth - 16);
      setMenuPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top: upward ? rect.top - height - 4 : rect.bottom + 4, width, maxHeight: height });
    }
    setOpen(true);
  };
  useEffect(() => {
    if (!portal || !open) return;
    const close = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [portal, open]);

  const selectOption = (option: DropdownOption<T>) => {
    onChange(option.value);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openMenu();
        setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
        return;
      }

      if (options.length === 0) return;
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setHighlightedIndex((current) => (current + direction + options.length) % options.length);
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      if (!open || options.length === 0) return;
      event.preventDefault();
      setHighlightedIndex(event.key === 'Home' ? 0 : options.length - 1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
      } else if (options[highlightedIndex]) {
        selectOption(options[highlightedIndex]);
      }
      return;
    }

    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
      return;
    }

    if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  const renderMenu = (menu: ReactNode) => portal ? createPortal(menu, document.body) : menu;

  return (
    <div ref={containerRef} className={`flex min-w-0 max-w-full flex-col gap-1 ${className}`}>
      {labelText && <label htmlFor={selectId} className="block text-xs font-semibold text-[#4b5563]">{labelText}</label>}
      <div className="relative min-w-0 max-w-full">
        <select
          aria-hidden="true"
          tabIndex={-1}
          value={value}
          disabled={disabled}
          data-testid={testId ?? `select-dropdown-${generatedSelectId}`}
          onChange={(event) => {
            const nextValue = event.currentTarget.value as T | '';
            if (nextValue !== '') onChange(nextValue);
          }}
          className="sr-only"
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          ref={triggerRef}
          id={selectId}
          type="button"
          aria-label={labelText ? undefined : placeholder}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          disabled={disabled}
          onClick={() => {
            if (open) setOpen(false); else openMenu();
            setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
          }}
          onKeyDown={handleKeyDown}
          className={`flex h-11 min-w-0 w-full max-w-full items-center justify-between rounded-xl border bg-white px-3 pr-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#800000] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-[#e5e7eb] disabled:bg-[#f3f4f6] disabled:text-[#9ca3af] ${
            open
              ? 'border-[#800000] ring-2 ring-[#800000]/20'
              : 'border-[#d1d5db] hover:border-[#800000]'
          }`}
        >
          <span className={selectedOption ? 'min-w-0 flex-1 truncate text-[#1f2937]' : 'truncate text-[#9ca3af]'}>
            {selectedLabel ?? selectedOption?.label ?? placeholder}
          </span>
          <svg
            aria-hidden="true"
            className={`ml-3 h-3.5 w-3.5 shrink-0 text-[#9ca3af] transition-transform ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open && options.length > 0 && (
          renderMenu(
          <div
            ref={menuRef}
            style={portal ? { position: 'fixed', ...menuPosition, zIndex: 1000, marginTop: 0 } : undefined}
            id={listboxId}
            role="listbox"
            aria-label={labelText ? String(labelText) : placeholder}
            className="absolute left-0 top-full z-[1000] mt-1 max-h-60 w-full overflow-y-auto overflow-x-hidden rounded-xl border border-[#d1d5db] bg-white p-1 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1)]"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isHighlighted = index === highlightedIndex;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => selectOption(option)}
                  className={`flex min-w-0 w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? 'bg-[#800000] font-semibold text-white'
                      : isHighlighted
                        ? 'bg-[#fff8f8] text-[#800000]'
                        : 'text-[#1f2937] hover:bg-[#fff8f8] hover:text-[#800000]'
                  }`}
                >
                  <span className={nowrapOptions ? "min-w-0 flex-1 whitespace-nowrap" : "min-w-0 flex-1 whitespace-normal [overflow-wrap:anywhere]"}>{option.label}</span>
                  {isSelected && (
                    <svg aria-hidden="true" className="ml-3 h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m4.5 10 3.5 3.5L15.5 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
          )
        )}
      </div>
    </div>
  );
}
