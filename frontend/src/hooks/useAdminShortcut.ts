import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';

export function useAdminShortcut(letter: string, action: () => void, allowedDialogSelector?: string) {
  const role = useAuthStore(state => state.user?.role);
  const actionRef = useRef(action);
  actionRef.current = action;
  useEffect(() => {
    if (role !== 'ADMIN' || !letter) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.defaultPrevented || event.repeat || event.isComposing ||
          !event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey ||
          event.code !== `Key${letter}` ||
          (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"], [role="combobox"]')) ||
          Array.from(document.querySelectorAll('[aria-modal="true"]')).some(dialog => !allowedDialogSelector || !dialog.matches(allowedDialogSelector))) return;
      event.preventDefault();
      actionRef.current();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [letter, role, allowedDialogSelector]);
}
