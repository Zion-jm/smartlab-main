import DropdownField from '../components/shared/DropdownField';
import { Navigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import type { SidebarIconProps } from '../components/PortalLayout';
import { useAuthStore } from '../stores/authStore';
import { getUserPreferences, usePreferencesStore, type UserPreferences } from '../stores/preferencesStore';

const SettingsNavIcon = ({ size = 18 }: SidebarIconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.1h-4v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.8-2.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.8 2.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
);

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#800000] ${
        checked ? 'border-[#800000] bg-[#800000]' : 'border-[#d8c7c3] bg-[#eee4df]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function PreferenceRow({
  title,
  description,
  checked,
  onChange,
  label,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-[#eee4df] py-5 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div>
        <h3 className="text-sm font-semibold text-[#3d2b2b]">{title}</h3>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[#756969]">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const userId = user?.id ?? 'anonymous';
  const preferencesByUser = usePreferencesStore((state) => state.preferencesByUser);
  const setPreference = usePreferencesStore((state) => state.setPreference);
  const resetPreferences = usePreferencesStore((state) => state.resetPreferences);
  const preferences = getUserPreferences(preferencesByUser, userId);

  const updatePreference = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPreference(userId, key, value);
  };

  return (
    <div className="mx-auto responsive-workspace space-y-4 p-2 lg:p-3">
      <header className="overflow-hidden rounded-2xl border border-[#ead7d3] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#fffaf7] p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#800000] text-white">
              <SettingsNavIcon size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[#967348]">WORKSPACE PREFERENCES</p>
              <h1 className="mt-1 text-xl font-semibold text-[#321d1d]">Workspace settings</h1>
              <p className="mt-1 text-xs text-[#786565]">Choose how SmartLab opens and organizes your admin workspace.</p>
            </div>
          </div>
          <span className="rounded-full bg-[#f4eee8] px-3 py-1 text-xs font-semibold text-[#57322d]">Saved locally</span>
        </div>
        <dl className="grid gap-4 border-t border-[#ead7d3] p-5 sm:grid-cols-3">
          <div>
            <dt className="text-[11px] uppercase text-[#9a8985]">Applies to</dt>
            <dd className="mt-1 text-sm font-semibold">This account</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase text-[#9a8985]">Stored on</dt>
            <dd className="mt-1 text-sm">This device</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase text-[#9a8985]">Takes effect</dt>
            <dd className="mt-1 text-sm">Next time a workspace page opens</dd>
          </div>
        </dl>
      </header>

      <div aria-hidden="true" className="h-0.5 w-full rounded-full bg-[#c8aaa2]" />

      <section className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
        <div className="border-b border-[#f3f4f6] px-5 py-4">
          <h2 className="text-sm font-semibold text-[#1f2937]">Workspace defaults</h2>
          <p className="mt-1 text-xs leading-5 text-[#6b7280]">Set the default layout used when you open admin workspace pages.</p>
        </div>
        <div className="p-5">
          <PreferenceRow
            title="Hide ribbon controls by default"
            description="Hide search and filters when you first open a page. Select Show controls to use them."
            checked={preferences.ribbonControlsHiddenByDefault}
            onChange={(checked) => updatePreference('ribbonControlsHiddenByDefault', checked)}
            label="Hide ribbon controls by default"
          />
          <PreferenceRow
            title="Collapse the sidebar by default"
            description="Start with the sidebar closed to give the page more space."
            checked={preferences.sidebarCollapsedByDefault}
            onChange={(checked) => updatePreference('sidebarCollapsedByDefault', checked)}
            label="Collapse the sidebar by default"
          />
          <div className="mt-5 border-t border-[#eee4df] pt-5">
            <h3 className="text-sm font-semibold text-[#3d2b2b]">Keyboard shortcuts</h3>
            <p className="mt-1 text-sm text-[#756969]">Choose an Alt + Shift + letter shortcut, or disable it. Changes apply immediately on this device. Shortcuts pause while typing or using a dialog.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {([
                ['controlsShortcut', 'Show / hide page controls', 'sidebarShortcut'],
                ['sidebarShortcut', 'Collapse / expand sidebar', 'controlsShortcut'],
              ] as const).map(([key, label, otherKey]) => (
                <div key={key}>
                  <DropdownField
                    label={label}
                    value={preferences[key]}
                    onChange={value => updatePreference(key, value)}
                    options={[
                      { value: '', label: 'Disabled' },
                      ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(letter => letter !== preferences[otherKey]).map(letter => ({ value: letter, label: `Alt + Shift + ${letter}` })),
                    ]}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-3 border-t border-[#f1e3df] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-[#6b7280]">Reset only affects this account on this device.</p>
            <button
              type="button"
              onClick={() => resetPreferences(userId)}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#d8c7c3] px-4 text-xs font-semibold text-[#4b5563] transition hover:border-[#a9867d] hover:bg-[#fffaf8] hover:text-[#800000]"
            >
              Reset workspace defaults
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function SettingsRoute() {
  const user = useAuthStore((state) => state.user);
  const content = <SettingsPage />;

  if (user?.role === 'ADMIN') {
    return <AdminLayout>{content}</AdminLayout>;
  }

  return <Navigate to="/profile" replace />;
}
