export function PanelSection({
  title,
  helper,
  action,
  children,
}: {
  title: string;
  helper: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-[#e5e7eb] rounded-2xl shadow-sm p-4 lg:p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
        <p className="text-sm font-semibold text-[#111827]">{title}</p>
        <p className="text-xs text-[#6b7280]">{helper}</p>
        </div>
        {action && <div className="self-start shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}
