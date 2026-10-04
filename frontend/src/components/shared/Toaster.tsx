import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore, type ToastVariant } from '../../stores/toastStore';

const VARIANT_STYLES: Record<
  ToastVariant,
  { bg: string; border: string; text: string; iconColor: string; Icon: typeof CheckCircle2 }
> = {
  success: {
    bg: 'bg-[#ecfdf5]',
    border: 'border-[#bbf7d0]',
    text: 'text-[#065f46]',
    iconColor: 'text-[#16a34a]',
    Icon: CheckCircle2,
  },
  error: {
    bg: 'bg-[#fef2f2]',
    border: 'border-[#fecaca]',
    text: 'text-[#991b1b]',
    iconColor: 'text-[#dc2626]',
    Icon: AlertCircle,
  },
  warning: {
    bg: 'bg-[#fffbeb]',
    border: 'border-[#fde68a]',
    text: 'text-[#92400e]',
    iconColor: 'text-[#d97706]',
    Icon: AlertTriangle,
  },
  info: {
    bg: 'bg-[#eff6ff]',
    border: 'border-[#bfdbfe]',
    text: 'text-[#1e40af]',
    iconColor: 'text-[#2563eb]',
    Icon: Info,
  },
};

/**
 * Global toast notification host. Mount once near the root of the app
 * (see main.tsx). Trigger toasts from anywhere via the `toast` helper in
 * `stores/toastStore.ts` — no need to pass props or wire per-page state.
 */
export default function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))] right-[max(1rem,env(safe-area-inset-right))] z-[1000] flex flex-col gap-2 sm:left-auto sm:w-96 sm:max-w-sm pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => {
        const style = VARIANT_STYLES[t.variant];
        const { Icon } = style;
        return (
          <div
            key={t.id}
            role="alert"
            className={`pointer-events-auto min-w-0 w-full flex items-start gap-3 rounded-2xl border ${style.border} ${style.bg} px-4 py-3 shadow-lg animate-in fade-in slide-in-from-top-2`}
          >
            <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${style.iconColor}`} />
            <div className={`min-w-0 flex-1 [overflow-wrap:anywhere] text-sm ${style.text}`}>
              {t.title && <p className="font-semibold">{t.title}</p>}
              <p>{t.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className={`flex-shrink-0 rounded-full p-0.5 hover:bg-black/5 ${style.text}`}
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
