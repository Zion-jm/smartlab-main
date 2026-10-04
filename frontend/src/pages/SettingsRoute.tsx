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
    <div className="mx-auto w-full max-w-[1000px] px-2 py-4 sm:px-4 sm:py-7 lg:px-6">
      <div className="mb-7 border-b border-[#e8ddd8] pb-7">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-[#9a8985]">
          <span>SmartLab</span>
          <span aria-hidden="true">/</span>
          <span className="text-[#7a1d20]">Settings</span>
        </div>
        <h1 className="text-[clamp(1.8rem,4vw,2.65rem)] font-semibold tracking-[-0.04em] text-[#321d1d]">Workspace settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#756969]">
          Choose how SmartLab should open and organize your workspace. These preferences are saved for your account on this device.
        </p>
      </div>

      <section className="rounded-2xl border border-[#eadfd9] bg-[#fffdfb] p-5 shadow-[0_8px_26px_rgba(76,37,24,0.045)] sm:p-7">
        <div className="mb-2 flex items-start gap-4 border-b border-[#eadfd9] pb-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f6efe8] text-[#7a1d20]">
            <SettingsNavIcon size={19} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9d6a4e]">Interface preferences</p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-[#321d1d]">Workspace defaults</h2>
            <p className="mt-1.5 text-sm leading-6 text-[#756969]">
              These defaults apply the next time you open a workspace page. You can still change controls or the sidebar at any time.
            </p>
          </div>
        </div>

        <PreferenceRow
          title="Hide ribbon controls by default"
          description="Keep search, filters, and contextual actions collapsed when an operational page first opens."
          checked={preferences.ribbonControlsHiddenByDefault}
          onChange={(checked) => updatePreference('ribbonControlsHiddenByDefault', checked)}
          label="Hide ribbon controls by default"
        />
        <PreferenceRow
          title="Collapse the sidebar by default"
          description="Give the workspace more room by opening each portal with its navigation sidebar minimized."
          checked={preferences.sidebarCollapsedByDefault}
          onChange={(checked) => updatePreference('sidebarCollapsedByDefault', checked)}
          label="Collapse the sidebar by default"
        />

        <div className="mt-6 flex flex-col gap-3 border-t border-[#eee4df] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-[#907f7b]">Reset only affects this account on this device.</p>
          <button
            type="button"
            onClick={() => resetPreferences(userId)}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#d8c7c3] px-4 text-xs font-semibold text-[#6b6262] transition hover:border-[#a9867d] hover:bg-[#fffaf8] hover:text-[#800000]"
          >
            Reset workspace defaults
          </button>
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