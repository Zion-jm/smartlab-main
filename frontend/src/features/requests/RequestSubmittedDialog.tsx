import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';
import { formatReference } from './requestModels';
export default function RequestSubmittedDialog({id,onClose,onView}:{id:string;onClose:()=>void;onView:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const element=dialog.current;const previous=document.activeElement as HTMLElement | null;element?.showModal();return()=>{element?.close();previous?.focus();};},[]);
  return createPortal(<dialog ref={dialog} onCancel={event=>{event.preventDefault();onClose();}} aria-labelledby="request-submitted-title" className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-[#ead7d3] bg-white p-6 text-center shadow-2xl backdrop:bg-black/40">
    <CheckCircle2 aria-hidden="true" className="mx-auto mb-3 h-12 w-12 text-emerald-600" />
    <h2 id="request-submitted-title" className="text-xl font-bold text-[#800000]">Request submitted successfully</h2>
    <p className="mt-3 font-semibold">{formatReference(id)}</p>
    <p className="mt-2 text-sm text-gray-600">Your request has been received and is awaiting administrator approval. Track its status in My Requests.</p>
    <div className="mt-6 flex flex-wrap justify-center gap-3"><button type="button" onClick={onClose} className="min-h-11 rounded-xl border px-4">Close</button><button type="button" onClick={onView} className="min-h-11 rounded-xl bg-[#800000] px-4 font-semibold text-white">View My Requests</button></div>
  </dialog>,document.body);
}
