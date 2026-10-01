import { colors, fontSize, fontWeight, radius, shadows } from '../../styles/tokens';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  border?: boolean;
  hover?: boolean;
}

const paddingMap = {
  none: '0',
  sm: '1rem',
  md: '1.5rem',
  lg: '2rem',
};

export function Card({
  children,
  className = '',
  padding = 'md',
  shadow = 'sm',
  border = true,
  hover = false,
}: CardProps) {
  const cardStyles: React.CSSProperties = {
    backgroundColor: colors.background.white,
    borderRadius: radius.lg,
    padding: paddingMap[padding],
    boxShadow: shadows[shadow],
    border: border ? `1px solid ${colors.gray[200]}` : 'none',
    transition: hover ? 'all 0.2s ease' : undefined,
  };

  const hoverClass = hover ? 'hover:shadow-md hover:border-gray-300' : '';

  return (
    <div className={`${className} ${hoverClass}`} style={cardStyles}>
      {children}
    </div>
  );
}

// Stat Card - for dashboard summary stats
export interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtext,
  className = '',
}: StatCardProps) {
  const headerStyles: React.CSSProperties = {
    fontSize: '0.6875rem', // 11px
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: colors.gray[500],
  };

  const valueStyles: React.CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginTop: '0.25rem',
  };

  const subtextStyles: React.CSSProperties = {
    fontSize: fontSize.xs,
    color: colors.gray[500],
  };

  return (
    <Card className={className} padding="md" shadow="sm" border>
      <p style={headerStyles}>{title}</p>
      <p style={valueStyles}>{value}</p>
      {subtext && <p style={subtextStyles}>{subtext}</p>}
    </Card>
  );
}

// Compact Stat Card (used in equipment page)
export interface CompactStatCardProps {
  title: string;
  value: string | number;
  subtext: string;
  className?: string;
}

export function CompactStatCard({ title, value, subtext, className = '' }: CompactStatCardProps) {
  const titleStyles: React.CSSProperties = {
    fontSize: '0.6875rem',
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: colors.gray[500],
  };

  const valueStyles: React.CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginTop: '0.25rem',
  };

  const subtextStyles: React.CSSProperties = {
    fontSize: fontSize.xs,
    color: colors.gray[500],
  };

  return (
    <Card className={className} padding="md" shadow="sm" border>
      <p style={titleStyles}>{title}</p>
      <p style={valueStyles}>{value}</p>
      <p style={subtextStyles}>{subtext}</p>
    </Card>
  );
}

export default Card;
