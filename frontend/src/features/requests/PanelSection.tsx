export function PanelSection({
  title,
  helper,
  action,
  mobileTitle,
  mobileHelper,
  children,
}: {
  title: string;
  helper: string;
  action?: React.ReactNode;
  mobileTitle?: string;
  mobileHelper?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-[#e5e7eb] rounded-2xl shadow-sm p-4 lg:p-6 space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:items-start">
        <p className="min-w-0 text-sm font-semibold text-[#111827]">{mobileTitle ? <><span className="sm:hidden">{mobileTitle}</span><span className="hidden sm:inline">{title}</span></> : title}</p>
        {action && <div className="col-start-2 row-start-1 shrink-0 sm:row-span-2">{action}</div>}
        <p className="col-span-2 text-xs text-[#6b7280] sm:col-span-1 sm:col-start-1">{mobileHelper ? <><span className="sm:hidden">{mobileHelper}</span><span className="hidden sm:inline">{helper}</span></> : helper}</p>
      </div>
      {children}
    </section>
  );
}
