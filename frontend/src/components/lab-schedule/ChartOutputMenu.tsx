import { useEffect, useRef, useState } from 'react';
import { Download, Printer } from 'lucide-react';

type Props = { onPrint: () => void; onExport: () => void; disabled: boolean; empty: boolean; scope: string };

export default function ChartOutputMenu({ onPrint, onExport, disabled, empty, scope }: Props) {
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
    <button ref={trigger} type="button" aria-expanded={!!position} aria-haspopup="dialog" aria-label="Chart print and export options" disabled={disabled}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-[#e5d5d1] bg-white px-3 text-xs font-semibold text-[#800000] hover:bg-[#fff8f6] disabled:opacity-45"
      onClick={() => {
        if (position) { close(); return; }
        const rect = trigger.current!.getBoundingClientRect();
        setPosition({ top: Math.min(rect.bottom + 8, Math.max(16, window.innerHeight - 360)), left: Math.max(16, Math.min(rect.right - 640, window.innerWidth - Math.min(640, window.innerWidth - 32) - 16)) });
      }}>
      <Download size={18} className="md:hidden" aria-hidden="true" /><Printer size={15} className="hidden md:block" aria-hidden="true" /><span className="hidden md:inline">Print / Export</span>
    </button>
    {position && <div ref={panel} role="dialog" aria-label="Chart print and export options" style={{ ...position, maxHeight: `calc(100dvh - ${position.top + 16}px)` }} className="fixed z-[80] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-[#eadfdd] bg-white text-left shadow-xl">
      <div className="border-b border-[#f1e9e7] px-5 py-3 text-xs text-[#786565]">{scope}</div>
      <div className="grid divide-y divide-[#f1e9e7] md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="p-4"><p className="pb-2 text-[10px] font-bold uppercase tracking-widest text-[#9a7770]">Print</p>
          <button type="button" className={actionClass} onClick={() => { close(); onPrint(); }}>Weekly lab chart<span className={descriptionClass}>Print the selected lab and week with the current filters.</span></button>
        </div>
        <div className="p-4"><p className="pb-2 text-[10px] font-bold uppercase tracking-widest text-[#9a7770]">Export</p>
          <button type="button" className={actionClass} onClick={() => { close(); onPrint(); }}>Save chart as PDF<span className={descriptionClass}>Opens the print dialog. Choose Save as PDF as the destination.</span></button>
          <button type="button" disabled={empty} className={actionClass} onClick={() => { close(); onExport(); }}>Schedule spreadsheet (CSV)<span className={descriptionClass}>Download this week's schedule details for the selected lab. Opens in Excel.</span></button>
        </div>
      </div>
    </div>}
  </div>;
}
