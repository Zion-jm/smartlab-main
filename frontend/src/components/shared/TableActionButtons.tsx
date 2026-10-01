import { colors, fontSize, fontWeight, radius } from '../../styles/tokens';

// Icon Action Button (small circular button for tables)
export interface IconActionButtonProps {
  label: string;
  onClick: () => void;
  icon?: 'edit' | 'delete' | 'view' | 'archive' | 'more';
  variant?: 'default' | 'primary' | 'warning' | 'danger';
  className?: string;
}

const iconPaths = {
  edit: (
    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  ),
  delete: (
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  view: (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  archive: (
    <>
      <path d="M21 8v13H3V8" />
      <path d="M1 3h22v5H1z" />
      <path d="M10 12h4" />
    </>
  ),
  more: (
    <>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </>
  ),
};

const variantStyles = {
  default: {
    background: colors.background.white,
    border: colors.gray[200],
    color: colors.gray[700],
    hoverBg: colors.gray[100],
    hoverBorder: colors.gray[300],
  },
  primary: {
    background: '#fff7ed',
    border: '#fcd34d',
    color: '#c2410c',
    hoverBg: '#ffedd5',
    hoverBorder: '#fbbf24',
  },
  warning: {
    background: '#fef3c7',
    border: '#fde68a',
    color: '#92400e',
    hoverBg: '#fde68a',
    hoverBorder: '#f59e0b',
  },
  danger: {
    background: colors.primary.light,
    border: '#fecaca',
    color: '#dc2626',
    hoverBg: '#fecaca',
    hoverBorder: '#f87171',
  },
};

export function IconActionButton({
  label,
  onClick,
  icon = 'edit',
  variant = 'default',
  className = '',
}: IconActionButtonProps) {
  const styles = variantStyles[variant];

  const buttonStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '2.25rem',
    height: '2.25rem',
    borderRadius: radius.lg, // 12px - rounded-2xl
    border: `1px solid ${styles.border}`,
    backgroundColor: styles.background,
    color: styles.color,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 ${className}`}
      style={buttonStyles}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = styles.hoverBg;
        e.currentTarget.style.borderColor = styles.hoverBorder;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = styles.background;
        e.currentTarget.style.borderColor = styles.border;
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {iconPaths[icon]}
      </svg>
    </button>
  );
}

// Text Action Button (for table row actions like Edit/Archive)
export interface TextActionButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

const textButtonVariants = {
  default: {
    color: colors.gray[700],
    border: colors.gray[200],
    background: colors.background.white,
    hoverBackground: colors.gray[50],
  },
  primary: {
    color: colors.background.white,
    border: colors.primary.DEFAULT,
    background: colors.primary.DEFAULT,
    hoverBackground: colors.primary.hover,
  },
  danger: {
    color: '#dc2626',
    border: '#fee2e2',
    background: colors.background.white,
    hoverBackground: '#fee2e2',
  },
  ghost: {
    color: colors.text.primary,
    border: 'transparent',
    background: 'transparent',
    hoverBackground: colors.gray[100],
  },
};

export function TextActionButton({
  label,
  onClick,
  variant = 'default',
  size = 'sm',
  disabled = false,
  className = '',
}: TextActionButtonProps) {
  const styles = textButtonVariants[variant];

  const buttonStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: size === 'sm' ? '0.375rem 0.75rem' : '0.5rem 1rem',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    borderRadius: radius.DEFAULT,
    border: `1px solid ${styles.border}`,
    backgroundColor: styles.background,
    color: styles.color,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.15s ease',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`hover:shadow-sm focus:outline-none ${className}`}
      style={buttonStyles}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = styles.hoverBackground;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = styles.background;
      }}
    >
      {label}
    </button>
  );
}

// Table Action Button Group (for multiple actions in a row)
export interface TableActionGroupProps {
  actions: Array<{
    label: string;
    onClick: () => void;
    variant?: 'default' | 'primary' | 'danger';
    show?: boolean;
  }>;
  className?: string;
}

export function TableActionGroup({ actions, className = '' }: TableActionGroupProps) {
  const visibleActions = actions.filter((a) => a.show !== false);

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {visibleActions.map((action, index) => (
        <TextActionButton
          key={index}
          label={action.label}
          onClick={action.onClick}
          variant={action.variant || 'default'}
          size="sm"
        />
      ))}
    </div>
  );
}

export default IconActionButton;
