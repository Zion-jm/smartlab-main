import { LoaderCircle } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="mx-auto responsive-workspace space-y-4 p-2 lg:p-3" aria-busy="true" aria-label="Dashboard">
      <div className="rounded-2xl border border-[#ead7d3] bg-gradient-to-br from-[#fffaf7] to-white p-5 shadow-sm sm:p-6" role="status">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#800000] text-[#fff4dc] shadow-sm" aria-hidden="true">
            <LoaderCircle size={24} className="motion-safe:animate-spin" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#9a7b4f]">SmartLab</p>
            <h1 className="mt-1 text-lg font-semibold text-[#57322d]">Loading your dashboard</h1>
            <p className="mt-1 text-xs leading-relaxed text-[#786565]">Getting the latest requests, schedules, and equipment overview.</p>
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="space-y-4 motion-safe:animate-pulse">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map(item => (
            <div key={item} className="rounded-2xl border border-[#ead7d3] bg-white p-4 sm:p-5">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="h-2 w-16 rounded-full bg-[#eee4df]" />
                <div className="h-8 w-8 rounded-xl bg-[#faf2ee]" />
              </div>
              <div className="h-7 w-12 rounded-lg bg-[#eee4df]" />
              <div className="mt-3 h-2 w-20 max-w-full rounded-full bg-[#f4eeeb]" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map(panel => (
            <div key={panel} className="overflow-hidden rounded-2xl border border-[#ead7d3] bg-white">
              <div className="border-b border-[#f1e6e3] bg-[#fffaf7] p-4"><div className="h-3 w-32 rounded-full bg-[#eee4df]" /></div>
              <div className="space-y-5 p-4 sm:p-5">
                {[0, 1, 2].map(row => (
                  <div key={row} className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-[#faf2ee]" />
                    <div className="flex-1 space-y-2"><div className="h-2.5 w-2/3 rounded-full bg-[#eee4df]" /><div className="h-2 w-1/2 rounded-full bg-[#f4eeeb]" /></div>
                    <div className="h-5 w-14 rounded-full bg-[#faf2ee]" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
