import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useNotificationStore, type AppNotification } from '../stores/notificationStore';
import { useAuthStore } from '../stores/authStore';

// ─── Icons ────────────────────────────────────────────────────────────────────

const BellIcon = ({ hasUnread }: { hasUnread: boolean }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill={hasUnread ? 'none' : 'none'}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const CheckAllIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12l5 5L22 4" />
    <path d="M16 4l-7 8" />
  </svg>
);

const typeConfig: Record<string, { icon: ReactNode; bg: string; color: string }> = {
  REQUEST_APPROVED: {
    bg: 'bg-green-100',
    color: 'text-green-700',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    ),
  },
  REQUEST_REJECTED: {
    bg: 'bg-red-100',
    color: 'text-red-700',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    ),
  },
  REQUEST_PENDING: {
    bg: 'bg-yellow-100',
    color: 'text-yellow-700',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  EQUIPMENT_DUE: {
    bg: 'bg-blue-100',
    color: 'text-blue-700',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      </svg>
    ),
  },
  SCHEDULE_REMINDER: {
    bg: 'bg-purple-100',
    color: 'text-purple-700',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  SYSTEM_ANNOUNCEMENT: {
    bg: 'bg-gray-100',
    color: 'text-gray-600',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
    ),
  },
};

const getTypeConfig = (type: string) =>
  typeConfig[type] ?? typeConfig.SYSTEM_ANNOUNCEMENT;

// ─── Single notification item ─────────────────────────────────────────────────

const NotificationItem = ({
  notification,
  onRead,
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
}) => {
  const cfg = getTypeConfig(notification.type);
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });

  return (
    <button
      onClick={() => !notification.isRead && onRead(notification.id)}
      className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
        notification.isRead
          ? 'hover:bg-gray-50'
          : 'bg-[#fff8f8] hover:bg-[#fff0f0]'
      }`}
    >
      {/* Type icon */}
      <div className={`mt-0.5 w-7 h-7 rounded-full ${cfg.bg} ${cfg.color} flex items-center justify-center shrink-0`}>
        {cfg.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-xs font-semibold leading-snug ${notification.isRead ? 'text-gray-700' : 'text-[#1f2937]'}`}>
            {notification.title}
          </p>
          {!notification.isRead && (
            <span className="mt-1 w-2 h-2 rounded-full bg-[#800000] shrink-0" />
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">
          {notification.message}
        </p>
        <p className="text-[10px] text-gray-400 mt-1">{timeAgo}</p>
      </div>
    </button>
  );
};

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    </div>
    <p className="text-sm font-medium text-gray-500">No notifications yet</p>
    <p className="text-xs text-gray-400 mt-1">Activity updates will appear here</p>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useAuthStore();

  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    startPolling,
    stopPolling,
  } = useNotificationStore();

  // Start / stop polling based on auth
  useEffect(() => {
    if (isAuthenticated) {
      startPolling();
    }
    return () => stopPolling();
  }, [isAuthenticated, startPolling, stopPolling]);

  // Close panel on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) fetchNotifications();
    setIsOpen((prev) => !prev);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        onClick={handleToggle}
        className={`relative p-2 rounded-lg transition-all ${
          isOpen
            ? 'bg-[rgba(128,0,0,0.08)] text-[#800000]'
            : 'hover:bg-[rgba(128,0,0,0.05)] text-[#4b5563]'
        }`}
        aria-label="Notifications"
      >
        <BellIcon hasUnread={unreadCount > 0} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-[#800000] text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#1f2937]">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#800000] text-white text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[11px] text-[#800000] font-medium hover:text-[#600000] transition-colors"
              >
                <CheckAllIcon />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100">
            {isLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-[#800000] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <EmptyState />
            ) : (
              notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} onRead={markAsRead} />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
              <p className="text-[10px] text-gray-400 text-center">
                Showing latest {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
