import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmingLabel?: string;
  isConfirming?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Keep request',
  confirmingLabel = 'Saving…',
  isConfirming = false,
  onConfirm,
  onClose,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const handleClose = () => {
    if (!isConfirming) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        aria-describedby="confirmation-modal-message"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[#f3f4f6] px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#fef2f2] text-[#b91c1c]">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p id="confirmation-modal-title" className="text-base font-semibold text-[#111827] sm:text-lg">
                {title}
              </p>
              <p id="confirmation-modal-message" className="mt-2 text-sm leading-6 text-[#6b7280]">
                {message}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isConfirming}
            aria-label="Close confirmation dialog"
            className="rounded-lg p-2 text-[#9ca3af] transition hover:bg-[#f9fafb] hover:text-[#374151] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-wrap justify-end gap-3 bg-[#fffdfc] px-5 py-5 sm:px-6">
          <button
            type="button"
            onClick={handleClose}
            disabled={isConfirming}
            className="min-h-11 rounded-full border border-[#e5e7eb] px-5 py-2.5 text-sm font-semibold text-[#374151] transition hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="min-h-11 rounded-full bg-[#991b1b] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(153,27,27,0.2)] transition hover:bg-[#7f1d1d] disabled:cursor-not-allowed disabled:bg-[#d48b8b]"
          >
            {isConfirming ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
