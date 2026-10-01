import { cloneElement, isValidElement, useId } from 'react';
import { colors, fontSize, fontWeight, spacing } from '../../styles/tokens';
import { InputField } from './InputField';
import DropdownField from './DropdownField';
import ResetFiltersButton from './ResetFiltersButton';

// Filter Group Container
export interface FilterGroupProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function FilterGroup({ children, className = '', title }: FilterGroupProps) {
  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing[3],
    width: '100%',
  };

  const titleStyles: React.CSSProperties = {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: colors.gray[500],
    marginBottom: spacing[1],
  };

  return (
    <div className={className}>
      {title && <p style={titleStyles}>{title}</p>}
      <div style={containerStyles}>{children}</div>
    </div>
  );
}

// Individual Filter Item
export interface FilterItemProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function FilterItem({ label, children, className = '' }: FilterItemProps) {
  const generatedId = useId();
  const control = isValidElement<{ id?: string }>(children) &&
    (children.type === InputField || children.type === DropdownField ||
      children.type === 'input' || children.type === 'select') ? children : null;
  const controlId = control ? control.props.id ?? generatedId : undefined;
  const labelStyles: React.CSSProperties = {
    fontSize: '0.6875rem', // 11px
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: colors.gray[500],
    marginBottom: spacing[1],
  };

  const itemStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[1],
  };

  return (
    <div className={className} style={itemStyles}>
      <label htmlFor={controlId} style={labelStyles}>{label}</label>
      {control ? cloneElement(control, { id: controlId }) : children}
    </div>
  );
}

// Search Filter (common pattern)
export interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchFilter({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
}: SearchFilterProps) {
  return (
    <FilterItem label="Search" className={className}>
      <InputField
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        size="md"
      />
    </FilterItem>
  );
}

// Select Filter (common pattern)
export interface SelectFilterProps<T extends string> {
  label: string;
  value: T | '';
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
}

export function SelectFilter<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'All',
  className = '',
}: SelectFilterProps<T>) {
  const allOptions = [{ label: placeholder, value: '' as T }, ...options];

  return (
    <FilterItem label={label} className={className}>
      <DropdownField<T>
        value={value}
        options={allOptions}
        onChange={onChange}
        placeholder={placeholder}
      />
    </FilterItem>
  );
}

// Checkbox Filter (common pattern)
export interface CheckboxFilterProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function CheckboxFilter({
  label,
  checked,
  onChange,
  className = '',
}: CheckboxFilterProps) {
  const containerStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing[2],
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.gray[700],
    cursor: 'pointer',
  };

  const checkboxStyles: React.CSSProperties = {
    width: '1rem',
    height: '1rem',
    borderRadius: '0.25rem',
    border: `1px solid ${colors.gray[300]}`,
    accentColor: colors.primary.DEFAULT,
    cursor: 'pointer',
  };

  return (
    <label className={className} style={containerStyles}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={checkboxStyles}
      />
      {label}
    </label>
  );
}

// Clear Filters Button
export interface ClearFiltersButtonProps {
  onClick: () => void;
  show: boolean;
  className?: string;
}

export function ClearFiltersButton({
  onClick,
  show,
  className = '',
}: ClearFiltersButtonProps) {
  if (!show) return null;

  return (
    <ResetFiltersButton onClick={onClick} label="Clear filters" className={className} />
  );
}

export default FilterGroup;
