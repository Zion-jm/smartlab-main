/**
 * SmartLab Design System - Tokens
 * 
 * These values define the visual language of the application.
 * All components should reference these tokens for consistency.
 */

// Colors
export const colors = {
  // Primary (Maroon)
  primary: {
    DEFAULT: '#800000',
    light: '#fee2e2',
    hover: '#5c0000',
    ring: 'rgba(128, 0, 0, 0.3)',
  },
  
  // Grays
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  
  // Text
  text: {
    primary: '#111827',
    secondary: '#6b7280',
    muted: '#9ca3af',
    disabled: '#9ca3af',
  },
  
  // State
  state: {
    error: '#ef4444',
    success: '#22c55e',
    warning: '#f59e0b',
    info: '#3b82f6',
  },
  
  // Background
  background: {
    white: '#ffffff',
    page: '#f9fafb',
    disabled: '#f3f4f6',
  },
};

// Border Radius
export const radius = {
  none: '0',
  sm: '0.25rem',    // 4px
  DEFAULT: '0.5rem', // 8px - standard
  md: '0.5rem',
  lg: '0.75rem',     // 12px - cards, modals
  xl: '1rem',        // 16px
  full: '9999px',    // pills
};

// Spacing (for padding, gaps, margins)
export const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
};

// Font Sizes
export const fontSize = {
  xs: '0.75rem',     // 12px - labels, helper text
  sm: '0.8125rem',   // 13px - small text
  DEFAULT: '0.875rem', // 14px - body text
  base: '0.875rem',
  md: '0.9375rem',   // 15px
  lg: '1rem',        // 16px
  xl: '1.125rem',    // 18px
};

// Font Weights
export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

// Shadows
export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  primary: '0 4px 12px rgba(128, 0, 0, 0.25)',
  dropdown: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  modal: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
};

// Component-specific tokens
export const input = {
  height: '2.75rem', // 44px standard height
  fontSize: fontSize.DEFAULT,
  borderColor: colors.gray[300],
  borderColorFocus: colors.primary.DEFAULT,
  background: colors.background.white,
  backgroundDisabled: colors.gray[100],
  textColor: colors.text.primary,
  textColorDisabled: colors.text.muted,
  placeholderColor: colors.gray[400],
  radius: radius.DEFAULT,
  shadow: shadows.sm,
  shadowFocus: `0 0 0 3px ${colors.primary.ring}`,
  paddingX: spacing[4],
  paddingY: spacing[2],
};

export const button = {
  height: '2.75rem',
  heightSm: '2.25rem',
  radius: radius.DEFAULT,
  radiusFull: radius.full,
  fontSize: fontSize.DEFAULT,
  fontWeight: fontWeight.semibold,
  primary: {
    background: colors.primary.DEFAULT,
    backgroundHover: colors.primary.hover,
    text: colors.background.white,
    shadow: shadows.primary,
  },
  secondary: {
    background: colors.background.white,
    backgroundHover: colors.gray[50],
    text: colors.text.primary,
    border: colors.gray[200],
    shadow: shadows.sm,
  },
  ghost: {
    background: 'transparent',
    backgroundHover: colors.gray[100],
    text: colors.text.primary,
  },
};

export const label = {
  fontSize: fontSize.xs,
  fontWeight: fontWeight.semibold,
  color: colors.gray[700],
  marginBottom: spacing[1],
};

// Z-index scale
export const zIndex = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  datepicker: 9999,
};
