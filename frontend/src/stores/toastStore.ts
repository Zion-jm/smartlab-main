import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  title?: string;
  message: string;
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  show: (variant: ToastVariant, message: string, options?: { title?: string; duration?: number }) => string;
  dismiss: (id: string) => void;
}

const DEFAULT_DURATION = 4500;

let counter = 0;
const nextId = () => {
  counter += 1;
  return `toast-${Date.now()}-${counter}`;
};

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  show: (variant, message, options) => {
    const id = nextId();
    const duration = options?.duration ?? DEFAULT_DURATION;
    const toast: ToastItem = { id, variant, message, title: options?.title, duration };
    set((state) => ({ toasts: [...state.toasts, toast] }));

    if (duration > 0) {
      setTimeout(() => {
        get().dismiss(id);
      }, duration);
    }

    return id;
  },

  dismiss: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

/**
 * Imperative toast helpers. Usable from anywhere (event handlers, services,
 * catch blocks) without needing to be inside a component that subscribes to
 * the store — call sites don't re-render on every toast change.
 *
 * Usage:
 *   toast.success('Request approved successfully.')
 *   toast.error('Failed to update request. Please try again.')
 *   toast.info('Heads up: two conflicting schedules found.')
 */
export const toast = {
  success: (message: string, options?: { title?: string; duration?: number }) =>
    useToastStore.getState().show('success', message, options),
  error: (message: string, options?: { title?: string; duration?: number }) =>
    useToastStore.getState().show('error', message, options),
  info: (message: string, options?: { title?: string; duration?: number }) =>
    useToastStore.getState().show('info', message, options),
  warning: (message: string, options?: { title?: string; duration?: number }) =>
    useToastStore.getState().show('warning', message, options),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};
