export function PanelSection({
  title,
  helper,
  children,
}: {
  title: string;
  helper: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-[#e5e7eb] rounded-2xl shadow-sm p-4 lg:p-6 space-y-4">
      <div>
        <p className="text-sm font-semibold text-[#111827]">{title}</p>
        <p className="text-xs text-[#6b7280]">{helper}</p>
      </div>
      {children}
    </section>
  );
}
