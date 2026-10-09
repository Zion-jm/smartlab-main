import { create } from 'zustand';
import { notificationApi } from '../services/api';

export interface AppNotification {
  id: string; type: string; title: string; message: string; isRead: boolean;
  referenceType?: string | null; referenceId?: string | null;
  borrowRequestId?: string | null; createdAt: string;
}
let generation = 0;
let fetchVersion = 0;
interface NotificationState {
  notifications: AppNotification[]; unreadCount: number; isLoading: boolean; isSaving: boolean;
  error: string | null; hasMore: boolean; unreadOnly: boolean;
  pollingInterval: ReturnType<typeof setInterval> | null;
  fetchNotifications: (more?: boolean) => Promise<void>;
  setUnreadOnly: (value: boolean) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  startPolling: () => void; stopPolling: () => void;
}
export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [], unreadCount: 0, isLoading: false, isSaving: false, error: null,
  hasMore: false, unreadOnly: false, pollingInterval: null,
  fetchNotifications: async (more = false) => {
    if (get().isSaving || (more && get().isLoading)) return;
    const session = generation, version = ++fetchVersion;
    const { unreadOnly, notifications } = get();
    set({ isLoading: true, error: null });
    try {
      const { data } = await notificationApi.getAll({ offset: more ? notifications.length : 0, unread: unreadOnly });
      if (session !== generation || version !== fetchVersion) return;
      const combined = more ? [...notifications, ...data.notifications] : data.notifications;
      set({ notifications: Array.from(new Map(combined.map((n: AppNotification) => [n.id, n])).values()) as AppNotification[], unreadCount: data.unreadCount, hasMore: Boolean(data.hasMore), isLoading: false });
    } catch {
      if (session === generation && version === fetchVersion) set({ isLoading: false, error: 'Could not load notifications. Please try again.' });
    }
  },
  setUnreadOnly: value => { set({ unreadOnly: value, notifications: [], hasMore: false }); void get().fetchNotifications(); },
  markAsRead: async id => {
    if (get().isSaving || get().notifications.find(n => n.id === id)?.isRead) return;
    const session = generation; ++fetchVersion;
    set({ isSaving: true, isLoading: false, error: null });
    try { await notificationApi.markRead(id); }
    catch { if (session === generation) set({ error: 'Could not mark the notification as read. Please try again.' }); }
    finally { if (session === generation) { const failed = Boolean(get().error); set({ isSaving: false }); if (!failed) await get().fetchNotifications(); } }
  },
  markAllAsRead: async () => {
    if (get().isSaving) return;
    const session = generation; ++fetchVersion;
    set({ isSaving: true, isLoading: false, error: null });
    try { await notificationApi.markAllRead(); }
    catch { if (session === generation) set({ error: 'Could not mark notifications as read. Please try again.' }); }
    finally { if (session === generation) { const failed = Boolean(get().error); set({ isSaving: false }); if (!failed) await get().fetchNotifications(); } }
  },
  startPolling: () => {
    if (get().pollingInterval) return;
    void get().fetchNotifications();
    set({ pollingInterval: setInterval(() => {
      if (document.visibilityState !== 'visible' || get().isLoading || get().isSaving) return;
      // Preserve older pages while notification history is being read.
      if (get().notifications.length > 30) {
        const session = generation, version = fetchVersion;
        void notificationApi.getUnreadCount().then(({ data }) => {
          if (session === generation && version === fetchVersion && !get().isSaving) set({ unreadCount: data.count });
        }).catch(() => {});
      } else void get().fetchNotifications();
    }, 30000) });
  },
  stopPolling: () => {
    const timer = get().pollingInterval; if (timer) clearInterval(timer);
    ++generation; ++fetchVersion;
    set({ notifications: [], unreadCount: 0, isLoading: false, isSaving: false, error: null, hasMore: false, unreadOnly: false, pollingInterval: null });
  },
}));
