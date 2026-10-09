import { useEffect, useRef, useState } from 'react';
import { Check, Info, Minus, Plus, Search, X } from 'lucide-react';
import type { EquipmentCardData } from './EquipmentCard';

type Props = {
  reviewVersion?: number;
  equipment: EquipmentCardData[];
  loading: boolean;
  error: boolean;
  onChange: (id: string, quantity: number, max: number) => void;
  onClear: (id: string) => void;
};

export default function MobileEquipmentPicker({ equipment, loading, error, onChange, onClear, reviewVersion = 0 }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [details, setDetails] = useState<string | null>(null);
  const [previousReview, setPreviousReview] = useState(reviewVersion);
  if (previousReview !== reviewVersion) {
    setPreviousReview(reviewVersion);
    setSearch('');
    setAvailableOnly(false);
  }
  useEffect(() => {
    if (reviewVersion > 0) {
      dialog.current?.showModal();
    }
  }, [reviewVersion]);
  const selected = equipment.filter(item => item.isSelected);
  const blocked = loading || error;
  const visible = equipment.filter(item => item.name.toLowerCase().includes(search.trim().toLowerCase()) && (!availableOnly || item.effectiveAvailable > 0))
    .sort((a, b) => Number(b.isSelected && b.selectedQuantity > b.effectiveAvailable) - Number(a.isSelected && a.selectedQuantity > a.effectiveAvailable) || Number(b.effectiveAvailable > 0) - Number(a.effectiveAvailable > 0) || a.name.localeCompare(b.name));
  const button = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#800000] disabled:opacity-30';

  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)');
    const close = () => { if (query.matches) dialog.current?.close(); };
    query.addEventListener('change', close);
    return () => query.removeEventListener('change', close);
  }, []);

  const quantity = (item: EquipmentCardData, compact = false) => <div className="flex items-center justify-between gap-2">
    <span className={compact ? "sr-only" : "text-xs text-[#74615e]"}>Quantity</span>
    <div className="flex items-center rounded-xl border border-[#ead7d3] bg-white">
      <button type="button" aria-label={'Decrease ' + item.name} disabled={blocked || item.selectedQuantity <= 1} onClick={() => onChange(item.id, item.selectedQuantity - 1, item.effectiveAvailable)} className={button}><Minus size={16} /></button>
      <span className="min-w-6 text-center text-sm font-semibold" aria-live="polite">{item.selectedQuantity}</span>
      <button type="button" aria-label={'Increase ' + item.name} disabled={blocked || item.selectedQuantity >= item.effectiveAvailable} onClick={() => onChange(item.id, item.selectedQuantity + 1, item.effectiveAvailable)} className={button}><Plus size={16} /></button>
    </div>
  </div>;

  return <div className="md:hidden">
    <div className="rounded-xl bg-[#fffdfb] p-0">
      <h4 className="mb-3 text-sm font-semibold text-[#57322d]">Selected equipment · {selected.length}</h4>
      {!selected.length && <p className="text-sm text-[#74615e]">Add the equipment you need, then choose quantities.</p>}
      <div className="divide-y divide-[#ead7d3]">{(showAll ? selected : selected.slice(0, 3)).map(item => <div key={item.id} className="bg-white py-2">
        <div className="selected-equipment-row"><span className="min-w-0 break-words text-sm font-semibold">{item.name}</span><div className="selected-equipment-controls">{quantity(item, true)}<button type="button" aria-label={'Remove ' + item.name} onClick={() => onClear(item.id)} className={button}><X size={18} /></button></div></div>
        {!blocked && item.selectedQuantity > item.effectiveAvailable && <p role="alert" className="text-xs text-red-700">Only {item.effectiveAvailable} available. Reduce the quantity or remove this item.</p>}
      </div>)}</div>
      {selected.length > 3 && <button type="button" aria-expanded={showAll} onClick={() => setShowAll(!showAll)} className="min-h-11 w-full text-sm font-semibold text-[#800000]">{showAll ? 'Show fewer' : `Show all ${selected.length} items`}</button>}
      {!showAll && !blocked && selected.slice(3).some(item => item.selectedQuantity > item.effectiveAvailable) && <p role="alert" className="text-xs text-red-700">Some additional items exceed availability. Show all items to review.</p>}
      <button ref={trigger} type="button" onClick={() => dialog.current?.showModal()} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#800000] px-4 py-3 text-sm font-semibold text-white"><Plus size={18} />{selected.length ? 'Add or change equipment' : 'Add equipment'}</button>
    </div>
    <dialog ref={dialog} aria-labelledby="mobile-equipment-title" onClose={() => trigger.current?.focus()} className="fixed inset-0 m-0 h-dvh max-h-dvh w-full max-w-none border-0 bg-white p-0 text-[#28313f] backdrop:bg-black/40">
      <div className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 border-b border-[#ead7d3] bg-[#fff8f5] px-4 pt-4 pb-3">
          <div className="flex items-center justify-between gap-3"><h2 id="mobile-equipment-title" className="text-lg font-semibold text-[#57322d]">Choose equipment</h2><button type="button" aria-label="Close equipment picker" onClick={() => dialog.current?.close()} className={button}><X size={20} /></button></div>
          <p className="mb-3 text-xs text-[#74615e]">Selections are saved as you choose.</p>
          <label className="flex items-center gap-2 rounded-xl border border-[#d8c7c3] bg-white px-3"><Search size={18} className="shrink-0 text-[#9a7b4f]" /><input type="search" aria-label="Search equipment" placeholder="Search equipment…" value={search} onChange={event => setSearch(event.target.value)} className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
          <label className="mt-2 flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={availableOnly} onChange={event => setAvailableOnly(event.target.checked)} className="h-4 w-4 accent-[#800000]" />Available only<span className="ml-auto text-xs text-[#74615e]">{visible.length} items</span></label>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2">
          {blocked && <p role="status" className="py-3 text-sm text-amber-800">{loading ? 'Checking availability…' : 'Availability could not be checked. Close this panel to review the error.'}</p>}
          {!visible.length && <p className="py-8 text-center text-sm text-[#74615e]">No matches. Try another search or turn off Available only.</p>}
          {visible.map(item => <div key={item.id} className="border-b border-[#eee5e2] py-3">
            <div className="flex items-center gap-2">
              <button type="button" aria-pressed={item.isSelected} disabled={!item.isSelected && (blocked || item.effectiveAvailable <= 0)} onClick={() => item.isSelected ? onClear(item.id) : onChange(item.id, 1, item.effectiveAvailable)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-50">
                <span className={'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ' + (item.isSelected ? 'border-[#800000] bg-[#800000] text-white' : 'border-[#cbb9b4]')}>{item.isSelected && <Check size={16} />}</span>
                <span className="min-w-0"><span className="block text-sm font-semibold">{item.name}</span><span className="mt-1 block text-xs text-[#74615e]">{blocked ? 'Availability pending' : item.effectiveAvailable > 0 ? item.effectiveAvailable + ' available' : 'Unavailable for this time'}</span></span>
              </button>
              <button type="button" aria-label={'Details for ' + item.name} aria-expanded={details === item.id} onClick={() => setDetails(details === item.id ? null : item.id)} className={button}><Info size={18} /></button>
            </div>
            {details === item.id && <p className="mt-2 rounded-lg bg-[#faf6f3] p-3 text-xs text-[#74615e]">Total inventory: {item.totalQuantity}. {blocked ? 'Availability is not confirmed.' : item.effectiveAvailable + ' available for your selected date and time.'}</p>}
            {item.isSelected && !blocked && item.selectedQuantity > item.effectiveAvailable && <p className="my-2 text-xs font-semibold text-red-700">Requested {item.selectedQuantity} · Available {item.effectiveAvailable}. Reduce quantity or deselect.</p>}
            {item.isSelected && quantity(item)}
          </div>)}
        </div>
        <footer className="shrink-0 border-t border-[#ead7d3] bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><button type="button" onClick={() => dialog.current?.close()} className="min-h-11 w-full rounded-xl bg-[#800000] px-4 py-3 text-sm font-semibold text-white">Done · {selected.length} selected</button></footer>
      </div>
    </dialog>
  </div>;
}
