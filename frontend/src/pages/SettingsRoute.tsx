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
      <section className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
        <div className="flex items-start gap-3 border-b border-[#f3f4f6] px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f6efe8] text-[#800000]">
            <SettingsNavIcon size={19} />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[#1f2937]">Workspace settings</h1>
            <p className="mt-1 text-xs leading-5 text-[#6b7280]">
              Choose how SmartLab opens and organizes admin workspace pages. Preferences are saved for this account on this device.
            </p>
          </div>
        </div>
        <div className="p-5">
          <div className="border-b border-[#f1e3df] pb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#9a7b4f]">Interface preferences</p>
            <h2 className="mt-1 text-base font-semibold text-[#1f2937]">Workspace defaults</h2>
            <p className="mt-1 text-xs leading-5 text-[#6b7280]">These defaults apply the next time you open a workspace page. You can still change its controls at any time.</p>
          </div>
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
