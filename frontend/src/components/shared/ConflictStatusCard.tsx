import type { ConflictCheckStatus } from '../../hooks/useScheduleConflictCheck';


export type ConflictStatusCardProps = {
  status: ConflictCheckStatus;
  ready: boolean;
  loading: boolean;
  error: string | null;
  hasDetails: boolean;
  onShowDetails: () => void;
  onRetry?: () => void;
  requestGuidance?: boolean;
};

const statusTokens: Record<ConflictCheckStatus | 'waiting', { bg: string; text: string; icon: string; label: string }> = {
  waiting: {
    bg: 'bg-[#f9fafb]',
    text: 'text-[#6b7280]',
    icon: '⏳',
    label: 'Choose a room, date, and valid time to check availability.',
  },
  idle: { bg: 'bg-[#f9fafb]', text: 'text-[#6b7280]', icon: '⏳', label: 'Ready to check room availability.' },
  checking: { bg: 'bg-[#eff6ff]', text: 'text-[#1d4ed8]', icon: '🔄', label: 'Checking whether this room is available…' },
  good: { bg: 'bg-[#ecfdf3]', text: 'text-[#047857]', icon: '✔️', label: 'This room is available for your selected time.' },
  warning: { bg: 'bg-[#fff7ed]', text: 'text-[#9a3412]', icon: '⚠️', label: 'Another request is waiting for this time.' },
  danger: { bg: 'bg-[#fef2f2]', text: 'text-[#b91c1c]', icon: '⛔', label: 'This room is already booked for this time.' },
  error: { bg: 'bg-[#fef2f2]', text: 'text-[#b91c1c]', icon: '❗', label: 'We couldn’t check room availability.' },
};

export function ConflictStatusCard({ status, ready, loading, error, hasDetails, onShowDetails, onRetry, requestGuidance = false }: ConflictStatusCardProps) {
  const token = ready ? statusTokens[status] : statusTokens.waiting;
  const labels: Record<ConflictCheckStatus | 'waiting', string> = {
    waiting: 'Provide date, time, and room to check conflicts.',
    idle: 'Ready to check conflicts.', checking: 'Checking for conflicts…',
    good: 'No conflicts detected.', warning: 'Pending requests overlap this slot.',
    danger: 'Active schedule conflict detected.', error: 'Unable to check conflicts. Try again.',
  };
  return (
    <div className={`rounded-2xl border border-[#e5e7eb] px-4 py-3 flex items-center justify-between gap-4 ${token.bg}`}>
      <div className={`flex items-start gap-2 text-sm font-semibold ${token.text}`}>
        <span aria-hidden>{token.icon}</span>
        <div>
          <p>{requestGuidance ? token.label : labels[ready ? status : 'waiting']}</p>
          {requestGuidance && status === 'warning' && <p className="mt-1 text-xs font-normal opacity-90">You may continue, but an administrator will review the request.</p>}
          {requestGuidance && status === 'danger' && <p className="mt-1 text-xs font-normal opacity-90">Choose a different room or time before submitting.</p>}
          {status === 'error' && error && <p className="mt-1 text-xs font-normal opacity-90">{error}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {hasDetails && (
          <button type="button" onClick={onShowDetails} className="text-xs font-semibold text-[#800000] underline">
            View details
          </button>
        )}
        {status === 'error' && onRetry && (
          <button type="button" onClick={onRetry} className="text-xs font-semibold text-[#800000] underline">
            Try again
          </button>
        )}
      </div>
      {loading && <span className="sr-only">Checking for conflicts…</span>}
    </div>
  );
}

export default ConflictStatusCard;
