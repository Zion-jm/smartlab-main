import { useNavigate } from 'react-router-dom';
import MyRequestDetailModal from '../features/requests/MyRequestDetailModal';
import { normalizeBorrowRequest, type RequestRow } from '../features/requests/requestModels';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Check, X, Clock, Info, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNotificationStore, type AppNotification } from '../stores/notificationStore';
import { useAuthStore } from '../stores/authStore';
import { borrowRequestApi, userApi } from '../services/api';
import TableCellDetailModal from './shared/TableCellDetailModal';
import { formatTimeRange } from '../utils/dateTime';

type RequestDetail = { reference: string; status: string; date: string; time: string; location: string; equipment: string; purpose: string; notes: string; requester: string };
export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [requestDetail, setRequestDetail] = useState<RequestRow | null>(null);
  const role = useAuthStore(state => state.user?.role);
  const [detailError, setDetailError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const userId = useAuthStore(state => state.user?.id);
  const n = useNotificationStore();
  const { startPolling, stopPolling } = n;
  useEffect(() => { if (userId) startPolling(); return stopPolling; }, [userId, startPolling, stopPolling]);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current, button = trigger.current;
    if (!element || !button) return;
    const position = () => {
      const mobile = window.innerWidth < 640;
      element.close();
      if (mobile) element.showModal(); else element.show();
      const rect = button.getBoundingClientRect();
      const top = Math.min(rect.bottom + 8, window.innerHeight - 160);
      Object.assign(element.style, {
        position: 'fixed', margin: '0', zIndex: '1000',
        left: 'auto', right: mobile ? '8px' : Math.max(16, window.innerWidth - rect.right) + 'px',
        top: mobile ? 'auto' : top + 'px', bottom: mobile ? '8px' : 'auto',
        width: mobile ? 'calc(100vw - 16px)' : 'min(420px, calc(100vw - 32px))',
        maxHeight: mobile ? 'calc(100dvh - 32px)' : (window.innerHeight - top - 16) + 'px',
      });
      element.style.setProperty('--notification-height', mobile ? 'calc(100dvh - 32px)' : (window.innerHeight - top - 16) + 'px');
    };
    const outside = (event: PointerEvent) => {
      if (window.innerWidth >= 640 && !element.contains(event.target as Node) && !button.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    position();
    element.querySelector<HTMLButtonElement>('button')?.focus();
    window.addEventListener('resize', position);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { window.removeEventListener('resize', position); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); element.close(); button.focus(); };
  }, [open]);
  useEffect(() => {
    if (!selected?.borrowRequestId) return;
    let active = true;
    borrowRequestApi.getById(selected.borrowRequestId).then(({ data }) => {
      if (!active) return;
      const r = data.request ?? data;
      setRequestDetail(normalizeBorrowRequest(r));
      setDetail({ reference: r.referenceCode || `REQ-${String(r.id).slice(-6).toUpperCase()}`, status: r.status === 'REJECTED' ? 'Declined' : String(r.status).toLowerCase(),
        date: new Date(r.dateNeeded).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }),
        time: formatTimeRange(r.timeStart, r.timeEnd), location: r.location || 'Not specified',
        equipment: (r.items ?? []).map((i: { equipment?: { name?: string }; quantity: number }) => `${i.equipment?.name || 'Equipment'} ×${i.quantity}`).join(', ') || 'None',
        purpose: r.purpose || 'Not specified', notes: r.rejectionNote || r.notes || 'None', requester: [r.requester?.firstName, r.requester?.lastName].filter(Boolean).join(' ') });
    }).catch(() => { if (active) setDetailError('This request could not be opened. It may be outside the active academic period or no longer available.'); });
    return () => { active = false; };
  }, [selected]);
  const choose = (notice: AppNotification) => {
    if (notice.referenceType === 'account_reactivation' && notice.referenceId) {
      if (!notice.isRead) void n.markAsRead(notice.id);
      void userApi.getById(notice.referenceId).then(({ data }) => window.location.assign('/admin/users?search=' + encodeURIComponent(data.user.email))).catch(() => { setSelected(notice); setRequestDetail(null); setDetail(null); setDetailError('Could not open the account. Try again or search in Manage Accounts.'); setOpen(false); }); return;
    }
    setSelected(notice); setRequestDetail(null); setDetail(null); setDetailError(''); setOpen(false);
    if (!notice.isRead) void n.markAsRead(notice.id);
  };
  const selectedData = detail ?? { message: selected?.message ?? '', information: detailError || (selected?.borrowRequestId ? 'Loading request details…' : 'No linked request.') };
  return <>
    <button ref={trigger} type="button" onClick={() => { setOpen(!open); if (!open) void n.fetchNotifications(); }} aria-label={`Notifications${n.unreadCount ? `, ${n.unreadCount} unread` : ''}`} aria-haspopup="dialog" aria-expanded={open} className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl text-[#4b5563] hover:bg-[#fff0ed] focus-visible:outline-2 focus-visible:outline-[#800000]">
      <Bell size={20} aria-hidden="true" />
      {n.unreadCount > 0 && <span className="absolute right-0 top-0 min-w-4 rounded-full bg-[#800000] px-1 text-[10px] font-bold leading-4 text-white">{n.unreadCount > 99 ? '99+' : n.unreadCount}</span>}
    </button>
    {open && createPortal(<dialog ref={dialog} aria-labelledby="notifications-title" className="notification-dialog" onCancel={e => { e.preventDefault(); setOpen(false); }} onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white">
        <header className="border-b border-[#eee5e3] p-4">
          <div className="flex items-center justify-between gap-3"><div><h2 id="notifications-title" className="font-semibold text-[#321d1d]">Notifications</h2><p className="mt-1 text-xs text-[#756969]">{n.unreadCount} unread</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close notifications" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-100"><X size={18} /></button></div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex rounded-lg bg-[#f5efed] p-1" aria-label="Notification filters">{[false, true].map(unread => <button key={String(unread)} type="button" disabled={n.isSaving} aria-pressed={n.unreadOnly === unread} onClick={() => n.setUnreadOnly(unread)} className={`min-h-9 rounded-md px-3 text-xs font-semibold ${n.unreadOnly === unread ? 'bg-[#800000] text-white' : 'text-[#756969]'}`}>{unread ? 'Unread' : 'All'}</button>)}</div>
            <button type="button" disabled={n.isSaving || n.unreadCount === 0} onClick={() => void n.markAllAsRead()} className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-[#800000] disabled:opacity-40"><CheckCheck size={16} />Mark all as read</button>
          </div>
        </header>
        {n.error && <div role="alert" className="bg-red-50 px-4 py-3 text-xs text-red-800">{n.error}<button type="button" onClick={() => void n.fetchNotifications()} className="ml-2 underline">Retry</button></div>}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-busy={n.isLoading}>
          {!n.notifications.length ? <div role="status" className="px-5 py-12 text-center"><Bell className="mx-auto mb-3 text-[#b79c94]" /><p className="text-sm font-semibold">{n.isLoading ? 'Loading notifications…' : n.error ? 'Notifications unavailable' : n.unreadOnly ? 'You’re all caught up' : 'No notifications yet'}</p><p className="mt-1 text-xs text-[#756969]">Request updates will appear here.</p></div> : n.notifications.map(notice => {
            const approved = notice.type === 'REQUEST_APPROVED', declined = notice.type === 'REQUEST_REJECTED';
            const Icon = approved ? Check : declined ? X : notice.type === 'REQUEST_PENDING' ? Clock : Info;
            const date = new Date(notice.createdAt);
            return <button key={notice.id} type="button" disabled={n.isSaving} onClick={() => choose(notice)} className={`flex w-full gap-3 border-b border-[#f1e8e4] p-4 text-left hover:bg-[#fff0ed] focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#800000] ${notice.isRead ? 'bg-white' : 'bg-[#fff8f6]'}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${approved ? 'bg-green-100 text-green-700' : declined ? 'bg-red-100 text-red-700' : 'bg-[#f0e7e2] text-[#800000]'}`}><Icon size={16} /></span>
              <span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><span className="text-sm font-semibold text-[#321d1d]">{notice.title}</span>{!notice.isRead && <span aria-label="Unread" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#800000]" />}</span><span className="mt-1 block text-xs leading-5 text-[#756969]">{notice.message}</span>{notice.referenceType === 'account_reactivation' && <span className="mt-1 block text-xs font-medium text-[#800000]">Review account →</span>}{notice.borrowRequestId && <span className="mt-1 block text-xs font-medium text-[#800000]">REQ-{notice.borrowRequestId.slice(-6).toUpperCase()} · View request →</span>}<time dateTime={notice.createdAt} title={date.toLocaleString()} className="mt-1 block text-[11px] text-[#8c8080]">{Number.isNaN(date.getTime()) ? 'Recently' : formatDistanceToNow(date, { addSuffix: true })}</time></span>
            </button>;
          })}
          {n.hasMore && <button type="button" disabled={n.isLoading} onClick={() => void n.fetchNotifications(true)} className="min-h-11 w-full text-xs font-semibold text-[#800000]">{n.isLoading ? 'Loading…' : 'Load older notifications'}</button>}
        </div>
        <footer className="flex items-center justify-between border-t border-[#eee5e3] px-4 py-2 text-xs text-[#756969]"><span>Updates every 30 seconds</span><button type="button" disabled={n.isLoading || n.isSaving} onClick={() => void n.fetchNotifications()} className="inline-flex min-h-10 items-center gap-2 text-[#800000]"><RefreshCw size={14} />Refresh</button></footer>
      </div>
    </dialog>, document.body)}
    {selected && requestDetail && <MyRequestDetailModal key={requestDetail.id} request={requestDetail} requester={role === 'ADMIN' ? detail?.requester : undefined} onReview={role === 'ADMIN' ? () => {
      const requestId = requestDetail.id;
      setSelected(null); setRequestDetail(null);
      navigate('/admin/requests', { state: { reviewRequestId: requestId, reviewToken: Date.now() } });
    } : undefined} onClose={() => { setSelected(null); setRequestDetail(null); }} />}
    <TableCellDetailModal<Record<string, string>> isOpen={Boolean(selected) && !requestDetail} onClose={() => setSelected(null)} title={detail ? `Request ${detail.reference}` : selected?.title || 'Notification'} subtitle={detail ? 'Current request details' : undefined} data={selectedData as Record<string, string>} fields={Object.keys(selectedData).map(key => ({ key, label: key.charAt(0).toUpperCase() + key.slice(1), fullWidth: key === 'equipment' || key === 'notes' || key === 'message' }))} />
  </>;
}
