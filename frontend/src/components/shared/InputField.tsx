import { forwardRef, type InputHTMLAttributes } from 'react';
import { colors, input, label } from '../../styles/tokens';

interface InputFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helper?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: {
    height: '2.25rem',
    fontSize: '0.75rem',
    padding: '0.5rem 0.75rem',
    iconPadding: '2rem',
  },
  md: {
    height: input.height,
    fontSize: input.fontSize || '0.875rem',
    padding: `${input.paddingY} ${input.paddingX}`,
    iconPadding: '2.5rem',
  },
  lg: {
    height: '3rem',
    fontSize: '1rem',
    padding: '0.75rem 1rem',
    iconPadding: '3rem',
  },
};

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  function InputField(
    {
      label: labelText,
      error,
      helper,
      icon,
      iconPosition = 'left',
      fullWidth = true,
      size = 'md',
      disabled,
      className = '',
      style,
      ...props
    },
    ref
  ) {
    const sizeStyle = sizeStyles[size];
    const hasError = !!error;
    const hasIcon = !!icon;

    const containerClasses = [
      'relative',
      fullWidth ? 'w-full' : 'w-auto',
    ].join(' ');

    const inputClasses = [
      'block w-full transition-all duration-200',
      'border focus:outline-none',
      disabled ? 'cursor-not-allowed' : '',
      hasIcon && iconPosition === 'left' ? `pl-[${sizeStyle.iconPadding}]` : '',
      hasIcon && iconPosition === 'right' ? `pr-[${sizeStyle.iconPadding}]` : '',
      className,
    ].join(' ');

    const inputStyles: React.CSSProperties = {
      height: sizeStyle.height,
      padding: hasIcon
        ? iconPosition === 'left'
          ? `${sizeStyle.padding.split(' ')[0]} ${sizeStyle.padding.split(' ')[1]} ${sizeStyle.padding.split(' ')[0]} ${sizeStyle.iconPadding}`
          : `${sizeStyle.padding.split(' ')[0]} ${sizeStyle.iconPadding} ${sizeStyle.padding.split(' ')[0]} ${sizeStyle.padding.split(' ')[1]}`
        : sizeStyle.padding,
      fontSize: sizeStyle.fontSize,
      borderRadius: input.radius,
      borderColor: hasError ? colors.state.error : input.borderColor,
      backgroundColor: disabled ? input.backgroundDisabled : input.background,
      color: disabled ? input.textColorDisabled : input.textColor,
      boxShadow: input.shadow,
      ...style,
    };

    const iconContainerClasses = [
      'absolute inset-y-0 flex items-center pointer-events-none',
      iconPosition === 'left' ? 'left-3' : 'right-3',
    ].join(' ');

    return (
      <div className={fullWidth ? 'w-full' : 'inline-block'}>
        {labelText && (
          <label
            style={{
              display: 'block',
              fontSize: label.fontSize,
              fontWeight: label.fontWeight,
              color: hasError ? colors.state.error : label.color,
              marginBottom: label.marginBottom,
            }}
          >
            {labelText}
          </label>
        )}
        <div className={containerClasses}>
          {hasIcon && (
            <div className={iconContainerClasses} style={{ color: colors.text.muted }}>
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={inputClasses}
            style={inputStyles}
            disabled={disabled}
            {...props}
          />
        </div>
        {(error || helper) && (
          <p
            style={{
              marginTop: '0.25rem',
              fontSize: '0.75rem',
              color: hasError ? colors.state.error : colors.text.muted,
            }}
          >
            {error || helper}
          </p>
        )}
      </div>
    );
  }
);

export default InputField;
