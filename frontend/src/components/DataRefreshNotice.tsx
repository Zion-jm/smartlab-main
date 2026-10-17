import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import api from '../services/api';
import ConfirmationModal from './shared/ConfirmationModal';
export default function DataRefreshNotice() {
  const userId = useAuthStore(state => state.user?.id);
  const [confirmingUser, setConfirmingUser] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    let stopped = false, running = false, revision: string | undefined, notice: string | undefined;
    const controller = new AbortController();
    const check = async () => {
      if (stopped || running || document.visibilityState === 'hidden' || !navigator.onLine) return;
      running = true;
      try {
        const response = await api.get('/notifications/data-revision', {signal:controller.signal});
        if (stopped) return;
        const next = response.data.revision as string;
        if (revision !== undefined && revision !== next && !useToastStore.getState().toasts.some(t => t.id === notice)) {
          notice = useToastStore.getState().show('info', 'New or updated data is available. Refresh when you are ready to see the latest information.', {
            title:'Updates available', duration:0,
            action:{label:'Refresh',onClick:()=>setConfirmingUser(userId)},
          });
        }
        revision = next;
      } catch { /* Retry on the next poll; transient outages must not flood toasts. */ }
      finally { running = false; }
    };
    void check();
    const interval = window.setInterval(() => void check(), 5000);
    const resume = () => void check();
    document.addEventListener('visibilitychange', resume); window.addEventListener('focus',resume); window.addEventListener('online',resume);
    return () => { stopped=true; controller.abort(); window.clearInterval(interval); document.removeEventListener('visibilitychange',resume); window.removeEventListener('focus',resume); window.removeEventListener('online',resume); if(notice) useToastStore.getState().dismiss(notice); };
  }, [userId]);
  return <div className="relative z-[1001]">
    <ConfirmationModal
      isOpen={Boolean(userId && confirmingUser === userId)}
      title="Refresh this page?"
      message="Refresh to see the latest data. Any unsaved changes will be lost, so save your work before continuing."
      confirmLabel="Refresh now"
      cancelLabel="Keep editing"
      onConfirm={() => window.location.reload()}
      onClose={() => setConfirmingUser(null)}
    />
  </div>;
}
