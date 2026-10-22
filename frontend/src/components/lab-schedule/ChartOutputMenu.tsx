import PdfProgressNotice from '../admin/report-details/PdfProgressNotice';
import { useEffect, useRef, useState } from 'react';
import { outputWeeks, type ChartOutputOptions } from './chartOutputOptions';
import { Download, Printer } from 'lucide-react';

type Props = { onPrint: (options: ChartOutputOptions) => void | Promise<void>; labs: string[]; selectedLab: string };

export default function ChartOutputMenu({ onPrint, labs, selectedLab }: Props) {
  const [period, setPeriod] = useState<ChartOutputOptions['period']>('week');
  const [lab, setLab] = useState(selectedLab);
  const [type, setType] = useState<ChartOutputOptions['type']>('ALL');
  const [activeAction, setActiveAction] = useState<ChartOutputOptions['action'] | null>(null);
  const busy = activeAction !== null;
  const [error, setError] = useState('');
  const chosenLab = lab === 'ALL' || labs.includes(lab) ? lab : selectedLab;
  const pages = outputWeeks(period).length * (chosenLab === 'ALL' ? labs.length : 1);
  const run = async (action: ChartOutputOptions['action']) => {
    if (busy) return;
    setActiveAction(action); setError('');
    try { await onPrint({ period, lab: chosenLab, type, action }); close(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Unable to prepare schedules. Please try again.'); }
    finally { setActiveAction(null); }
  };
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = () => { setPosition(null); trigger.current?.focus(); };
  useEffect(() => {
    if (!position) return;
    panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setPosition(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setPosition(null); trigger.current?.focus(); }
    };
    const dismiss = () => setPosition(null);
    document.addEventListener('pointerdown', outside);
    root.current?.addEventListener('keydown', escape);
    window.addEventListener('resize', dismiss);
    const element = root.current;
    return () => {
      document.removeEventListener('pointerdown', outside);
      element?.removeEventListener('keydown', escape);
      window.removeEventListener('resize', dismiss);
    };
  }, [position]);
  const actionClass = 'block w-full rounded-xl px-2 py-3 text-left text-xs font-semibold text-[#3f3636] hover:bg-[#fff7f5] focus-visible:outline-2 focus-visible:outline-[#800000] disabled:opacity-45';
  const descriptionClass = 'mt-1 block text-[11px] font-normal leading-4 text-[#8c8080]';
  return <div ref={root} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPosition(null); }}>
    <button ref={trigger} type="button" aria-expanded={!!position} aria-haspopup="dialog" aria-label="Chart print and export options" disabled={!labs.length}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-[#e5d5d1] bg-white px-3 text-xs font-semibold text-[#800000] hover:bg-[#fff8f6] disabled:opacity-45"
      onClick={() => {
        if (position) { close(); return; }
        const rect = trigger.current!.getBoundingClientRect();
        setPosition({ top: Math.min(rect.bottom + 8, Math.max(16, window.innerHeight - 560)), left: Math.max(16, Math.min(rect.right - 640, window.innerWidth - Math.min(640, window.innerWidth - 32) - 16)) });
      }}>
      <Download size={18} className="md:hidden" aria-hidden="true" /><Printer size={15} className="hidden md:block" aria-hidden="true" /><span className="hidden md:inline">Print / Export</span>
    </button>
    <PdfProgressNotice active={activeAction === 'pdf'} />
    {position && <div ref={panel} role="dialog" aria-label="Chart print and export options" style={{ ...position, maxHeight: `calc(100dvh - ${position.top + 16}px)` }} className="fixed z-[80] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-[#eadfdd] bg-white text-left shadow-xl">
      <div className="border-b border-[#f1e9e7] px-5 py-3 text-xs text-[#786565]">{`${pages} ${pages === 1 ? 'page' : 'pages'}: one lab per week`}</div>
      <div className="grid gap-3 p-4 sm:grid-cols-3">
        <label className="text-xs font-semibold">Period<select disabled={busy} value={period} onChange={e => setPeriod(e.target.value as ChartOutputOptions['period'])} className="mt-2 block min-h-11 w-full rounded-lg border p-2"><option value="week">This week</option><option value="month">This month</option></select></label>
        <label className="text-xs font-semibold">Laboratory<select disabled={busy} value={chosenLab} onChange={e => setLab(e.target.value)} className="mt-2 block min-h-11 w-full rounded-lg border p-2">{labs.map(name => <option key={name} value={name}>{name}</option>)}<option value="ALL">All labs</option></select></label>
        <label className="text-xs font-semibold">Schedule type<select disabled={busy} value={type} onChange={e => setType(e.target.value as ChartOutputOptions['type'])} className="mt-2 block min-h-11 w-full rounded-lg border p-2"><option value="ALL">All types</option><option value="WEEKLY">Weekly</option><option value="ONE_TIME">One-time</option></select></label>
      </div>
      <p className="px-5 text-xs text-[#786565]">Uses the current {period} in Manila and the selected academic period. Empty weeks are included. Other page filters do not apply.</p>
      {error && <p role="alert" className="px-5 py-2 text-xs text-red-700">{error}</p>}
      <div className="grid divide-y divide-[#f1e9e7] md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="p-4"><p className="pb-2 text-[10px] font-bold uppercase tracking-widest text-[#9a7770]">Print</p>
          <button disabled={busy} type="button" className={actionClass} onClick={() => void run('print')}>Print charts<span className={descriptionClass}>One page per lab per week.</span></button>
        </div>
        <div className="p-4"><p className="pb-2 text-[10px] font-bold uppercase tracking-widest text-[#9a7770]">Export</p>
          <button disabled={busy} type="button" className={actionClass} onClick={() => void run('pdf')}>Download PDF<span className={descriptionClass}>Download one PDF containing the selected charts.</span></button>
          <button disabled={busy} type="button" className={actionClass} onClick={() => void run('csv')}>Schedule spreadsheet (CSV)<span className={descriptionClass}>Export schedule details using these selections.</span></button>
        </div>
      </div>
    </div>}
  </div>;
}
