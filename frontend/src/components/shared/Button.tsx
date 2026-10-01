import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { button, colors, radius, shadows } from '../../styles/tokens';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const sizeStyles = {
  sm: {
    height: button.heightSm,
    padding: '0 0.75rem',
    fontSize: '0.75rem',
    iconSize: '0.875rem',
  },
  md: {
    height: button.height,
    padding: '0 1rem',
    fontSize: button.fontSize,
    iconSize: '1rem',
  },
  lg: {
    height: '3rem',
    padding: '0 1.5rem',
    fontSize: '1rem',
    iconSize: '1.125rem',
  },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      className = '',
      style,
      ...props
    },
    ref
  ) {
    const sizeStyle = sizeStyles[size];
    const isDisabled = disabled || loading;

    const getVariantStyles = (): React.CSSProperties => {
      switch (variant) {
        case 'primary':
          return {
            backgroundColor: isDisabled ? colors.gray[300] : button.primary.background,
            color: button.primary.text,
            boxShadow: button.primary.shadow,
            border: 'none',
          };
        case 'secondary':
          return {
            backgroundColor: isDisabled ? colors.gray[100] : button.secondary.background,
            color: isDisabled ? colors.text.muted : button.secondary.text,
            boxShadow: button.secondary.shadow,
            border: `1px solid ${isDisabled ? colors.gray[200] : button.secondary.border}`,
          };
        case 'ghost':
          return {
            backgroundColor: isDisabled ? 'transparent' : button.ghost.background,
            color: isDisabled ? colors.text.muted : button.ghost.text,
            boxShadow: 'none',
            border: 'none',
          };
        case 'danger':
          return {
            backgroundColor: isDisabled ? colors.gray[300] : colors.state.error,
            color: colors.background.white,
            boxShadow: shadows.md,
            border: 'none',
          };
        default:
          return {};
      }
    };

    const baseClasses = [
      'inline-flex items-center justify-center gap-2',
      'font-semibold transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-offset-1',
      fullWidth ? 'w-full' : '',
      isDisabled ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02]',
      className,
    ].join(' ');

    const variantStyles = getVariantStyles();

    const buttonStyles: React.CSSProperties = {
      height: sizeStyle.height,
      padding: sizeStyle.padding,
      fontSize: sizeStyle.fontSize,
      borderRadius: variant === 'primary' ? radius.full : button.radius,
      ...variantStyles,
      ...style,
    };

    // Hover styles via CSS-in-JS is tricky, so we'll use Tailwind classes for that
    const hoverClass = isDisabled
      ? ''
      : variant === 'primary'
      ? 'hover:bg-[#5c0000]'
      : variant === 'secondary'
      ? 'hover:bg-gray-50'
      : variant === 'ghost'
      ? 'hover:bg-gray-100'
      : variant === 'danger'
      ? 'hover:bg-red-700'
      : '';

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${hoverClass}`}
        style={buttonStyles}
        disabled={isDisabled}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin"
            style={{ width: sizeStyle.iconSize, height: sizeStyle.iconSize }}
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!loading && leftIcon && (
          <span style={{ width: sizeStyle.iconSize, height: sizeStyle.iconSize, display: 'flex', alignItems: 'center' }}>
            {leftIcon}
          </span>
        )}
        {children}
        {!loading && rightIcon && (
          <span style={{ width: sizeStyle.iconSize, height: sizeStyle.iconSize, display: 'flex', alignItems: 'center' }}>
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

export default Button;
