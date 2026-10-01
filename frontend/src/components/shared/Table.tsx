import { colors, fontSize, fontWeight, radius } from '../../styles/tokens';
import React from 'react';

// Table Container
export interface TableContainerProps {
  children: React.ReactNode;
  className?: string;
  minWidth?: string;
  maxHeight?: string | number;
  stickyHeader?: boolean;
}

export function TableContainer({
  children,
  className = '',
  minWidth,
  maxHeight,
  stickyHeader = true,
}: TableContainerProps) {
  const containerStyles: React.CSSProperties = {
    overflowX: 'auto',
    overflowY: 'hidden',
    minWidth: minWidth || '100%',
    ...(maxHeight !== undefined ? { maxHeight } : {}),
  };

  return (
    <div className={`table-scroll-container ${stickyHeader ? 'table-scroll-container--sticky-header' : ''} ${className}`} style={containerStyles}>
      {children}
    </div>
  );
}

// Table Component
export interface TableProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

export function Table({ children, className = '', size = 'md' }: TableProps) {
  const tableStyles: React.CSSProperties = {
    width: '100%',
    fontSize: size === 'sm' ? fontSize.xs : '0.8125rem', // 13px
    borderCollapse: 'collapse',
    textAlign: 'left',
  };

  return (
    <table className={`min-w-full ${className}`} style={tableStyles}>
      {children}
    </table>
  );
}

// Table Head
export interface TableHeadProps {
  children: React.ReactNode;
  className?: string;
}

export function TableHead({ children, className = '' }: TableHeadProps) {
  const headStyles: React.CSSProperties = {
    borderBottom: `1px solid ${colors.gray[200]}`,
  };

  return (
    <thead className={className} style={headStyles}>
      <tr>{children}</tr>
    </thead>
  );
}

// Table Header Cell
export interface TableHeaderCellProps {
  children: React.ReactNode;
  className?: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export function TableHeaderCell({
  children,
  className = '',
  width,
  align = 'left',
}: TableHeaderCellProps) {
  const cellStyles: React.CSSProperties = {
    padding: '0.75rem 1rem',
    fontWeight: fontWeight.semibold,
    color: colors.gray[500],
    fontSize: fontSize.xs,
    textAlign: align,
    width,
  };

  return (
    <th className={className} style={cellStyles}>
      {children}
    </th>
  );
}

// Table Body
export interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function TableBody({ children, className = '' }: TableBodyProps) {
  return <tbody className={className}>{children}</tbody>;
}

// Table Row
export interface TableRowProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  border?: boolean;
}

export function TableRow({ children, className = '', hover = true, border = true }: TableRowProps) {
  const rowStyles: React.CSSProperties = {
    borderBottom: border ? `1px solid ${colors.gray[100]}` : undefined,
  };

  const hoverClass = hover ? 'hover:bg-gray-50' : '';

  return (
    <tr className={`transition-colors ${hoverClass} ${className}`} style={rowStyles}>
      {children}
    </tr>
  );
}

// Table Cell
export interface TableCellProps {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
  colSpan?: number;
}

export function TableCell({
  children,
  className = '',
  align = 'left',
  colSpan,
}: TableCellProps) {
  const cellStyles: React.CSSProperties = {
    padding: '0.75rem 1rem',
    color: colors.gray[700],
    textAlign: align,
  };

  return (
    <td className={className} style={cellStyles} colSpan={colSpan}>
      {children}
    </td>
  );
}

// Cell with title (for name/description cells)
export interface TableTitleCellProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
}

export function TableTitleCell({ title, subtitle, className = '' }: TableTitleCellProps) {
  const titleStyles: React.CSSProperties = {
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  };

  const subtitleStyles: React.CSSProperties = {
    fontSize: fontSize.xs,
    color: colors.gray[500],
  };

  return (
    <TableCell className={className}>
      <div style={titleStyles}>{title}</div>
      {subtitle && <div style={subtitleStyles}>{subtitle}</div>}
    </TableCell>
  );
}

// Cell for badges/status
export interface TableBadgeCellProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

const badgeVariantStyles = {
  default: 'bg-gray-100 text-gray-700 border-gray-200',
  primary: 'bg-[#fee2e2] text-[#800000] border-[#fecaca]',
  success: 'bg-[#dcfce7] text-[#166534] border-[#bbf7d0]',
  warning: 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]',
  danger: 'bg-[#fee2e2] text-[#dc2626] border-[#fecaca]',
  info: 'bg-[#dbeafe] text-[#1d4ed8] border-[#bfdbfe]',
};

export function TableBadgeCell({
  children,
  className = '',
  variant = 'default',
}: TableBadgeCellProps) {
  const badgeStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.125rem 0.5rem',
    borderRadius: radius.full,
    fontSize: '0.6875rem',
    fontWeight: fontWeight.semibold,
    border: '1px solid',
  };

  return (
    <TableCell className={className}>
      <span className={badgeVariantStyles[variant]} style={badgeStyles}>
        {children}
      </span>
    </TableCell>
  );
}

// Actions Cell (for action buttons)
export interface TableActionsCellProps {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export function TableActionsCell({
  children,
  className = '',
  align = 'right',
}: TableActionsCellProps) {
  const cellStyles: React.CSSProperties = {
    padding: '0.75rem 1rem',
    textAlign: align,
    whiteSpace: 'nowrap',
  };

  return (
    <td className={className} style={cellStyles}>
      <div className="inline-flex gap-2">{children}</div>
    </td>
  );
}

export default Table;
