import { colors, fontSize, fontWeight, radius } from '../../styles/tokens';
import { Button } from './Button';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
  variant?: 'default' | 'dashed' | 'minimal';
  className?: string;
}

export function EmptyState({
  title = 'No data found',
  description = 'There are no items to display at this time.',
  action,
  icon,
  variant = 'default',
  className = '',
}: EmptyStateProps) {
  const containerStyles: React.CSSProperties = {
    padding: '2rem',
    textAlign: 'center',
    borderRadius: radius.lg,
    border: variant === 'dashed' ? `1px dashed ${colors.gray[300]}` : undefined,
    backgroundColor: variant === 'minimal' ? 'transparent' : colors.background.white,
  };

  const titleStyles: React.CSSProperties = {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.gray[600],
    marginTop: icon ? '1rem' : 0,
    marginBottom: description ? '0.5rem' : 0,
  };

  const descriptionStyles: React.CSSProperties = {
    fontSize: fontSize.xs,
    color: colors.gray[500],
    marginBottom: action ? '1rem' : 0,
  };

  // Default icon
  const defaultIcon = (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.gray[300]}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 7h-9" />
      <path d="M14 17H5" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </svg>
  );

  return (
    <div className={className} style={containerStyles}>
      {icon || defaultIcon}
      <p style={titleStyles}>{title}</p>
      {description && <p style={descriptionStyles}>{description}</p>}
      {action && (
        <Button variant="primary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Specialized Empty States
export interface EmptyTableProps {
  searchTerm?: string;
  filtersActive?: boolean;
  onClearFilters?: () => void;
  className?: string;
}

export function EmptyTable({
  searchTerm,
  filtersActive,
  onClearFilters,
  className = '',
}: EmptyTableProps) {
  const title = searchTerm
    ? `No results for "${searchTerm}"`
    : filtersActive
    ? 'No matches found'
    : 'No items yet';

  const description = searchTerm
    ? 'Try adjusting your search terms.'
    : filtersActive
    ? 'Try adjusting your filters to see more results.'
    : 'Get started by adding a new item.';

  return (
    <EmptyState
      title={title}
      description={description}
      action={
        filtersActive && onClearFilters
          ? { label: 'Clear filters', onClick: onClearFilters }
          : undefined
      }
      variant="minimal"
      className={className}
    />
  );
}

// Loading State
export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({
  message = 'Loading...',
  className = '',
}: LoadingStateProps) {
  const containerStyles: React.CSSProperties = {
    padding: '2rem',
    textAlign: 'center',
  };

  const spinnerStyles: React.CSSProperties = {
    width: '2rem',
    height: '2rem',
    border: `2px solid ${colors.gray[200]}`,
    borderTopColor: colors.primary.DEFAULT,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 1rem',
  };

  const messageStyles: React.CSSProperties = {
    fontSize: fontSize.sm,
    color: colors.gray[500],
  };

  return (
    <div className={className} style={containerStyles}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={spinnerStyles} />
      <p style={messageStyles}>{message}</p>
    </div>
  );
}

// Error State
export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  message,
  onRetry,
  className = '',
}: ErrorStateProps) {
  const containerStyles: React.CSSProperties = {
    padding: '2rem',
    textAlign: 'center',
    color: colors.state.error,
  };

  const iconStyles: React.CSSProperties = {
    width: '3rem',
    height: '3rem',
    margin: '0 auto 1rem',
    color: colors.state.error,
  };

  const messageStyles: React.CSSProperties = {
    fontSize: fontSize.sm,
    marginBottom: onRetry ? '1rem' : 0,
  };

  return (
    <div className={className} style={containerStyles}>
      <svg
        style={iconStyles}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p style={messageStyles}>{message}</p>
      {onRetry && (
        <Button variant="primary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
