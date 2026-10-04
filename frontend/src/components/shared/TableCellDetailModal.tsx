import React, { useEffect, useId, useRef } from 'react';
import { FileText, X } from 'lucide-react';
type TableCellDetailModalProps<T = Record<string, unknown>> = {
  isOpen: boolean;
  testId?: string;
  closeTestId?: string;
  dismissTestId?: string;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  data: T;
  status?: string;
  statusBadge?: string;
  fields: {
    label: string;
    key: keyof T; section?: string;
    formatter?: (value: unknown, data?: T) => string | React.ReactNode;
    condition?: (value: unknown) => boolean;
    fullWidth?: boolean;
  }[];
  actions?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'default' | 'danger' | 'success' | 'warning';
    disabled?: boolean;
  }[];
};

export default function TableCellDetailModal<T = Record<string, unknown>>({ isOpen, onClose, title, subtitle, children, data, statusBadge, fields, actions = [], testId, closeTestId, dismissTestId }: TableCellDetailModalProps<T>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!isOpen || !element) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, [isOpen]);
  if (!isOpen) return null;
  const requester = data as { requesterName?: string; requesterRole?: string; requesterEmail?: string };
  const visible = fields.filter(field => !field.condition || field.condition(data[field.key]));
  const groups = visible.reduce<(typeof visible)[]>((result, field) => {
    const previous = result[result.length - 1];
    if (!previous || previous[0].section !== field.section) result.push([field]);
    else previous.push(field);
    return result;
  }, []);
  return <dialog data-testid={testId} ref={dialog} aria-labelledby={titleId} className="record-detail-dialog" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="record-detail-shell">
      <header className="record-detail-header">
        <span className="record-detail-symbol"><FileText size={22} strokeWidth={1.75} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-lg font-bold text-[#451a1a]">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-[#786565] break-words">{subtitle}</p>}
        </div>
        <button data-testid={closeTestId} type="button" autoFocus onClick={onClose} aria-label={`Close ${title.toLowerCase()}`} className="record-detail-close"><X size={20} aria-hidden="true" /></button>
      </header>
      <div className="record-detail-body">
        {children}
        {statusBadge && <span className="mb-5 inline-flex rounded-full bg-[#f4e4e3] px-3 py-1 text-xs font-semibold text-[#800000]">{statusBadge.replaceAll('_', ' ')}</span>}
        {requester.requesterName && <div className="record-detail-requester rounded-xl border border-[#ead7d3] bg-[#fffafa] p-4">
          <p className="text-xs font-medium text-[#786565]">Requested by</p>
          <p className="mt-1 font-semibold text-[#451a1a]">{requester.requesterName}</p>
          <p className="mt-1 break-words text-xs text-[#786565]">{[requester.requesterRole, requester.requesterEmail].filter(Boolean).join(' · ')}</p>
        </div>}
          {groups.map((group, groupIndex) => <dl key={groupIndex} aria-label={group[0].section} className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {group.map((field, index) => {
              const value = data[field.key];
              return <div key={index} className={field.fullWidth ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
                <dt className="text-xs font-semibold tracking-wide text-[#800000]">{field.label}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-6 text-[#292323]">{field.formatter ? field.formatter(value, data) : value == null || value === '' ? 'Not specified' : String(value)}</dd>
              </div>;
            })}
          </dl>)}

      </div>
      <footer className="record-detail-footer">
        <button data-testid={dismissTestId} type="button" onClick={onClose} className="record-detail-button">Close</button>
        {actions.map((action, index) => <button key={index} type="button" onClick={action.onClick} disabled={action.disabled} className={`record-detail-button ${action.variant && action.variant !== 'default' ? 'record-detail-button-primary' : ''}`}>{action.label}</button>)}
      </footer>
    </div>
  </dialog>;
}
