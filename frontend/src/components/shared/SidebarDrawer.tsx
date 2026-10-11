import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

type Props = {
  open?: boolean;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  labelledBy?: string;
};

export default function SidebarDrawer({ open=true,title,subtitle,icon,badge,children,footer,onClose,closeDisabled=false,labelledBy='sidebar-drawer-title' }:Props){
 useEffect(()=>{
  if(!open)return;
  const handleKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!closeDisabled)onClose();};
  window.addEventListener('keydown',handleKeyDown);
  return()=>window.removeEventListener('keydown',handleKeyDown);
 },[closeDisabled,onClose,open]);
 if(!open)return null;
 const close=()=>{if(!closeDisabled)onClose();};
 return <div className="admin-mobile-drawer fixed inset-0 z-50 h-dvh">
  <div className="absolute inset-0 bg-black/40" onClick={close} role="presentation"/>
  <aside className="request-review-drawer absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
   <header className="request-review-header flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
    <div className="flex min-w-0 items-center gap-3">
     {icon&&<span className="request-review-avatar" aria-hidden="true">{icon}</span>}
     <div className="min-w-0"><h2 id={labelledBy} className="truncate text-lg font-semibold text-[#451a1a]">{title}</h2>{subtitle&&<p className="mt-1 text-sm text-[#786565]">{subtitle}</p>}</div>
    </div>
    <div className="flex shrink-0 items-center gap-3">{badge}<button type="button" disabled={closeDisabled} onClick={close} aria-label="Close sidebar" className="rounded-lg p-2 text-[#786565] transition hover:bg-[#fff7f2] hover:text-[#451a1a] disabled:opacity-50"><X className="h-5 w-5"/></button></div>
   </header>
   <div className="request-review-body min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
   {footer&&<footer className="request-review-footer flex flex-wrap items-center justify-between gap-2 px-5 py-4 sm:px-6">{footer}</footer>}
  </aside>
 </div>;
}
