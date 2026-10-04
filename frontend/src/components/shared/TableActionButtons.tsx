import { Archive, ArchiveRestore, Check, Eye, HandHelping, MoreHorizontal, Pencil, RotateCcw, Trash2, X, LoaderCircle } from 'lucide-react';

const icons = { edit: Pencil, delete: Trash2, view: Eye, archive: Archive, restore: ArchiveRestore, more: MoreHorizontal, approve: Check, borrow: HandHelping, return: RotateCcw, cancel: X };
export type TableActionIcon = keyof typeof icons;
type Variant = 'default' | 'primary' | 'warning' | 'danger' | 'ghost';
export interface TextActionButtonProps {
  label: string;
  onClick: () => void;
  icon?: TableActionIcon;
  variant?: Variant;
  size?: 'sm' | 'md';
  disabled?: boolean;
  busy?: boolean;
  className?: string;
  accessibleLabel?: string;
  'data-testid'?: string;
}

export function TextActionButton({ label, onClick, icon = 'view', variant = 'default', disabled = false, busy = false, className = '', accessibleLabel, 'data-testid': testId }: TextActionButtonProps) {
  const Icon = busy ? LoaderCircle : icons[icon];
  return (
    <button type="button" onClick={onClick} disabled={disabled || busy} aria-busy={busy || undefined}
      aria-label={accessibleLabel || label} title={accessibleLabel || label} data-testid={testId}
      className={`table-action-button table-action-button--${icon} table-action-button--${variant} ${className}`}>
      <Icon size={18} strokeWidth={1.75} aria-hidden="true" className={busy ? 'animate-spin motion-reduce:animate-none' : undefined} />
    </button>
  );
}

export type IconActionButtonProps = TextActionButtonProps;
const actionLabels: Record<TableActionIcon, string> = { edit: 'Edit', delete: 'Delete', view: 'View', archive: 'Archive', restore: 'Restore', more: 'More', approve: 'Approve', borrow: 'Borrow', return: 'Return', cancel: 'Cancel' };
// Retain contextual accessible names while showing concise, consistent row actions.
export function IconActionButton({ label, icon = 'edit', ...props }: IconActionButtonProps) {
  return <TextActionButton {...props} icon={icon} label={props.busy ? 'Saving…' : actionLabels[icon]} accessibleLabel={label} />;
}

export interface TableActionGroupProps {
  actions: Array<TextActionButtonProps & { show?: boolean }>;
  className?: string;
}
export function TableActionGroup({ actions, className = '' }: TableActionGroupProps) {
  return <div className={`flex flex-wrap items-center justify-end gap-2 ${className}`}>
    {actions.filter(action => action.show !== false).map((action, index) => <TextActionButton key={index} {...action} />)}
  </div>;
}
export default IconActionButton;
