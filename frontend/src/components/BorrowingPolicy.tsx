import { useCallback, useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import api from '../services/api';
import { toast } from '../stores/toastStore';
import ConfirmationModal from './shared/ConfirmationModal';
import TableCellDetailModal from './shared/TableCellDetailModal';

type Policy = {content:string; revision:number; updatedAt:string};
export default function BorrowingPolicy({editable=false}:{editable?:boolean}) {
  const [policy,setPolicy] = useState<Policy | null>(null);
  const [draft,setDraft] = useState('');
  const [editing,setEditing] = useState(false);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [confirm,setConfirm] = useState(false);
  const load = useCallback(() => api.get<Policy>('/borrowing-policy')
    .then(response => {setPolicy(response.data);setDraft(response.data.content);setEditing(false);})
    .catch(() => {setError('Unable to load the borrowing policy. Please try again.');})
    .finally(() => {setLoading(false);}),[]);
  useEffect(()=>{void load();},[load]);
  const dirty = Boolean(policy && draft !== policy.content);
  useEffect(()=>{
    if (!dirty) return;
    const warn = (event:BeforeUnloadEvent) => {event.preventDefault();};
    window.addEventListener('beforeunload',warn);
    return ()=>window.removeEventListener('beforeunload',warn);
  },[dirty]);
  const save = async () => {
    if (!policy || saving) return;
    setSaving(true);setError('');
    try {
      const response = await api.put<Policy>('/borrowing-policy',{content:draft,revision:policy.revision});
      setPolicy(response.data);setDraft(response.data.content);setEditing(false);setConfirm(false);toast.success('Borrowing policy updated.');
    } catch (failure) {
      const message=(failure as {response?:{data?:{error?:string}}}).response?.data?.error;
      setError(message || 'Unable to save the policy. Your draft is still available.');setConfirm(false);
    } finally {setSaving(false);}
  };
  return <section className="overflow-hidden rounded-2xl border border-[#ead7d3] bg-white shadow-sm">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ead7d3] bg-[#fffaf7] p-4 lg:p-5">
      <div className="flex items-center gap-3"><BookOpen className="shrink-0 text-[#800000]" aria-hidden="true"/><div><h2 className="font-semibold text-[#57322d]">Borrowing Policy</h2><p className="mt-1 text-xs text-[#786565]">Guidelines for laboratory reservations and equipment borrowing.</p></div></div>
      {editable && policy && !editing && <button type="button" onClick={()=>setEditing(true)} className="min-h-11 rounded-xl bg-[#800000] px-4 text-sm font-semibold text-white">Edit policy</button>}
    </header>
    <div className="space-y-4 p-4 lg:p-5">
      {loading ? <p role="status">Loading policy…</p> : <>
        {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}{!editing && <button type="button" onClick={()=>{setLoading(true);setError('');void load();}} className="ml-2 min-h-11 underline">Retry</button>}</div>}
        {policy && <>
          <p className="text-xs text-[#786565]">Last updated: {new Date(policy.updatedAt).toLocaleString('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'})} (Philippine time)</p>
          {editing ? <>
            <p className="text-sm text-[#786565]">Saving makes this text visible to students and faculty. It does not change system restrictions or require acceptance.</p>
            <label className="block text-sm font-semibold text-[#57322d]">Policy text<textarea value={draft} onChange={event=>setDraft(event.target.value)} maxLength={20000} disabled={saving} rows={22} className="mt-2 block w-full rounded-xl border border-[#d8c7c2] p-3 text-sm font-normal leading-7 focus:outline-[#800000]"/></label>
            <p className="text-xs text-[#786565]">{draft.length.toLocaleString()} / 20,000 characters</p>
            <div className="flex flex-wrap justify-end gap-3"><button type="button" disabled={saving} onClick={()=>{setDraft(policy.content);setEditing(false);setError('');}} className="min-h-11 rounded-xl border border-[#d8c7c2] px-4 text-sm">Discard changes</button><button type="button" disabled={saving || !dirty || !draft.trim()} onClick={()=>setConfirm(true)} className="min-h-11 rounded-xl bg-[#800000] px-4 text-sm font-semibold text-white disabled:opacity-50">Save policy</button></div>
          </> : <div className="whitespace-pre-wrap break-words text-sm leading-7 text-[#514343]">{policy.content}</div>}
        </>}
      </>}
    </div>
    <ConfirmationModal isOpen={confirm} title="Save borrowing policy?" message="The updated policy will be visible to students and faculty immediately. Borrowing rules and existing requests will remain unchanged." confirmLabel="Save policy" cancelLabel="Keep editing" isConfirming={saving} onConfirm={()=>void save()} onClose={()=>setConfirm(false)}/>
  </section>;
}

export function BorrowingPolicyLink() {
  const [open,setOpen]=useState(false);
  return <>
    <button type="button" onClick={()=>setOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#800000] hover:bg-[#fff0ed]"><BookOpen size={18} aria-hidden="true"/>View borrowing policy</button>
    {open && <TableCellDetailModal isOpen title="Borrowing Policy" onClose={()=>setOpen(false)} data={{}} fields={[]}><BorrowingPolicy/></TableCellDetailModal>}
  </>;
}
