import { createPortal } from 'react-dom';
import { LoaderCircle } from 'lucide-react';

export default function PdfProgressNotice({ active }: { active: boolean }) {
  if (!active) return null;
  return createPortal(
    <div role="status" aria-live="polite" className="fixed bottom-5 left-1/2 z-[1100] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl border border-[#ead7d3] bg-white px-5 py-4 shadow-lg print:hidden">
      <LoaderCircle size={23} aria-hidden="true" className="shrink-0 animate-spin text-[#800000] motion-reduce:animate-none" />
      <div><p className="text-sm font-semibold text-[#800000]">Preparing PDF…</p><p className="mt-1 text-xs leading-5 text-slate-600">Please keep this page open. Your download will start when it’s ready.</p></div>
    </div>, document.body,
  );
}
