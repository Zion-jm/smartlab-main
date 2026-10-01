import { RotateCcw } from 'lucide-react';

type ResetFiltersButtonProps = {
  onClick: () => void;
  label?: string;
  className?: string;
  'data-testid'?: string;
};

export default function ResetFiltersButton({
  onClick,
  label = 'Reset filters',
  className = '',
  'data-testid': dataTestId,
}: ResetFiltersButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={dataTestId}
      className={`inline-flex h-10 min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#e5caca] bg-white px-3 text-xs font-semibold text-[#800000] shadow-sm transition-colors hover:border-[#800000] hover:bg-[#fff8f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#800000] focus-visible:ring-offset-1 ${className}`}
    >
      <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}