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
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        aria-describedby="confirmation-modal-message"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[#f3f4f6] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fef2f2] text-[#b91c1c]">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p id="confirmation-modal-title" className="text-sm font-semibold text-[#111827]">
                {title}
              </p>
              <p id="confirmation-modal-message" className="mt-1 text-xs leading-5 text-[#6b7280]">
                {message}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isConfirming}
            aria-label="Close confirmation dialog"
            className="rounded-lg p-1 text-[#9ca3af] transition hover:bg-[#f9fafb] hover:text-[#374151] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={isConfirming}
            className="rounded-full border border-[#e5e7eb] px-4 py-2 text-xs font-semibold text-[#374151] transition hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="rounded-full bg-[#991b1b] px-4 py-2 text-xs font-semibold text-white shadow-[0_4px_12px_rgba(153,27,27,0.2)] transition hover:bg-[#7f1d1d] disabled:cursor-not-allowed disabled:bg-[#d48b8b]"
          >
            {isConfirming ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}