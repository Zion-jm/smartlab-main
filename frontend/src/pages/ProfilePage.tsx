import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Button from '../components/shared/Button';
import InputField from '../components/shared/InputField';
import { useAuthStore } from '../stores/authStore';
import type { User } from '../types';

type ProfileRecord = User & {
  adminId?: string | null;
  facultyId?: string | null;
  studentId?: string | null;
  specialization?: string | null;
  office?: string | null;
};

export interface ProfilePageProps {
  /** Pass a user when the page is rendered outside the normal authenticated shell. */
  user?: User | null;
  onProfileSubmit?: (values: { firstName: string; lastName: string; phone: string }) => void | Promise<void>;
  onPasswordSubmit?: (values: { currentPassword: string; newPassword: string }) => void | Promise<void>;
  profileLoading?: boolean;
  securityLoading?: boolean;
  profileError?: string | null;
  securityError?: string | null;
  profileSuccess?: string | null;
  securitySuccess?: string | null;
}

type ProfileForm = {
  firstName: string;
  lastName: string;
  phone: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const emptyPassword: PasswordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };

const roleLabels: Record<User['role'], string> = {
  ADMIN: 'Administrator',
  FACULTY: 'Faculty member',
  STUDENT: 'Student',
};

const roleDescriptions: Record<User['role'], string> = {
  ADMIN: 'Portal administration and laboratory operations',
  FACULTY: 'Teaching, research, and laboratory coordination',
  STUDENT: 'Academic laboratory access and learning',
};

const roleAccent: Record<User['role'], string> = {
  ADMIN: 'bg-[#f6efe8] text-[#7a1d20]',
  FACULTY: 'bg-[#f2f0e7] text-[#6d5b1d]',
  STUDENT: 'bg-[#edf3f1] text-[#28645c]',
};

const initialsFor = (user: ProfileRecord | null) => {
  if (!user) return '—';
  const first = user.firstName?.trim().charAt(0) ?? '';
  const last = user.lastName?.trim().charAt(0) ?? '';
  return `${first}${last}`.toUpperCase() || user.email.trim().charAt(0).toUpperCase() || 'U';
};

const displayNameFor = (user: ProfileRecord | null) => {
  if (!user) return 'SmartLab user';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || 'SmartLab user';
};

const getRoleValue = (user: ProfileRecord | null, key: keyof ProfileRecord) => {
  const value = user?.[key];
  return typeof value === 'string' && value.trim() ? value : 'Not provided';
};

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-[#eadfd9] pb-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9d6a4e]">{eyebrow}</p>
        <h2 className="text-xl font-semibold tracking-[-0.02em] text-[#321d1d]">{title}</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#756969]">{description}</p>
      </div>
      {action}
    </div>
  );
}

function DetailRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex min-h-[3.65rem] flex-col justify-center border-b border-[#eee4df] py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
      <dt className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a8985]">{label}</dt>
      <dd className={`mt-1 text-sm font-medium sm:mt-0 sm:text-right ${muted ? 'text-[#a59692]' : 'text-[#3d2b2b]'}`}>
        {value}
      </dd>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="10" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 14v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 19 6v5.4c0 4.5-3 7.8-7 9.6-4-1.8-7-5.1-7-9.6V6l7-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ProfilePage({
  user: userProp,
  onProfileSubmit,
  onPasswordSubmit,
  profileLoading = false,
  securityLoading = false,
  profileError = null,
  securityError = null,
  profileSuccess = null,
  securitySuccess = null,
}: ProfilePageProps) {
  const storeUser = useAuthStore((state) => state.user);
  const user = (userProp === undefined ? storeUser : userProp) as ProfileRecord | null;
  const role = user?.role ?? 'STUDENT';
  const displayName = displayNameFor(user);

  const initialProfile: ProfileForm = {
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
  };

  const [profile, setProfile] = useState<ProfileForm>(() => initialProfile);
  const [password, setPassword] = useState<PasswordForm>(emptyPassword);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);
  const [passwordValidation, setPasswordValidation] = useState<string | null>(null);

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileNotice(null);

    if (!profile.firstName.trim() || !profile.lastName.trim()) {
      setProfileNotice('First name and last name are required.');
      return;
    }

    if (onProfileSubmit) {
      await onProfileSubmit({
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        phone: profile.phone.trim(),
      });
      return;
    }

    setProfileNotice('No save handler is available for this profile.');
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSecurityNotice(null);
    setPasswordValidation(null);

    if (password.newPassword.length < 8) {
      setPasswordValidation('Use at least 8 characters for your new password.');
      return;
    }

    if (password.newPassword !== password.confirmPassword) {
      setPasswordValidation('New password and confirmation do not match.');
      return;
    }

    if (onPasswordSubmit) {
      await onPasswordSubmit({
        currentPassword: password.currentPassword,
        newPassword: password.newPassword,
      });
      setPassword(emptyPassword);
      return;
    }

    setSecurityNotice('Your password request is ready to be connected.');
  };

  const roleDetails = useMemo<Array<[string, string, boolean?]>>(() => {
    if (role === 'ADMIN') {
      return [
        ['Account type', roleLabels.ADMIN],
        ['Account status', user?.status === 'ACTIVE' ? 'Active' : 'Deactivated'],
      ];
    }

    if (role === 'FACULTY') {
      return [
        ['Account type', roleLabels.FACULTY],
        ['Account status', user?.status === 'ACTIVE' ? 'Active' : 'Deactivated'],
        ['Department', getRoleValue(user, 'department')],
      ];
    }

    return [
      ['Account type', roleLabels.STUDENT],
      ['Account status', user?.status === 'ACTIVE' ? 'Active' : 'Deactivated'],
      ['Program', user?.program || 'Not provided'],
      ['Year level', user?.yearLevel ? `Year ${user.yearLevel}` : 'Not provided'],
    ];
  }, [role, user]);

  return (
    <div className={`profile-page ${role !== 'ADMIN' ? 'profile-page--portal' : ''} mx-auto w-full max-w-[1180px] px-2 py-4 sm:px-4 sm:py-7 lg:px-6`}>
      <div className="profile-page__header mb-7 flex flex-col justify-between gap-5 border-b border-[#e8ddd8] pb-7 sm:flex-row sm:items-end">
        <div className="profile-page__introduction">
          <div className="profile-page__breadcrumb mb-3 flex items-center gap-2 text-xs font-medium text-[#9a8985]">
            <span>SmartLab</span>
            <ChevronIcon />
            <span className="text-[#7a1d20]">Profile</span>
          </div>
          {role === 'ADMIN' && (<h1 className="text-[clamp(1.8rem,4vw,2.65rem)] font-semibold tracking-[-0.04em] text-[#321d1d]">Your profile</h1>)}
          <p className="profile-page__intro mt-2 max-w-xl text-sm leading-6 text-[#756969]">
            Keep your contact details current so the SmartLab team can reach you when it matters.
          </p>
        </div>
        <div className="profile-page__identity flex items-center gap-3 rounded-2xl border border-[#eadfd9] bg-[#fffdfb] px-4 py-3 shadow-[0_5px_18px_rgba(76,37,24,0.04)]">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${roleAccent[role]}`}>
            {initialsFor(user)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#3d2b2b]">{displayName}</p>
            <p className="mt-0.5 text-xs text-[#907f7b]">{roleLabels[role]}</p>
          </div>
        </div>
      </div>

      {user === null && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#ead5c8] bg-[#fff9f5] px-4 py-3.5 text-sm text-[#754b39]" role="status">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#b77955]" />
          <p>Your account details are not available yet. You can review this page once your session is restored.</p>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.85fr)]">
        <section className="rounded-2xl border border-[#eadfd9] bg-[#fffdfb] p-5 shadow-[0_8px_26px_rgba(76,37,24,0.045)] sm:p-7">
          <SectionHeading
            eyebrow="Personal details"
            title="Contact information"
            description="Update the details associated with your SmartLab account."
          />
          <form onSubmit={handleProfileSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <InputField
                label="First name"
                value={profile.firstName}
                onChange={(event) => setProfile((current) => ({ ...current, firstName: event.target.value }))}
                placeholder="Enter your first name"
                autoComplete="given-name"
                disabled={!user}
                required
              />
              <InputField
                label="Last name"
                value={profile.lastName}
                onChange={(event) => setProfile((current) => ({ ...current, lastName: event.target.value }))}
                placeholder="Enter your last name"
                autoComplete="family-name"
                disabled={!user}
                required
              />
            </div>
            <InputField
              label="Email address"
              value={user?.email ?? ''}
              helper="Email changes are handled by an administrator to protect account access."
              type="email"
              autoComplete="email"
              disabled
            />
            <InputField
              label="Phone number"
              value={profile.phone}
              onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))}
              helper="Optional. Used for important SmartLab account notices."
              type="tel"
              autoComplete="tel"
              disabled={!user}
            />
            {(profileError || profileNotice || profileSuccess) && (
              <p className={`text-sm ${profileError ? 'text-[#a33c32]' : 'text-[#48715d]'}`} role="status">
                {profileError || profileNotice || profileSuccess}
              </p>
            )}
            <div className="flex flex-col-reverse gap-3 border-t border-[#eee4df] pt-5 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => {
                  setProfile(initialProfile);
                  setProfileNotice(null);
                }}
                disabled={!user || profileLoading}
              >
                Discard changes
              </Button>
              <Button type="submit" size="md" loading={profileLoading} disabled={!user}>
                Save personal details
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-[#eadfd9] bg-[#f8f2ed] p-5 shadow-[0_8px_26px_rgba(76,37,24,0.035)] sm:p-7">
          <SectionHeading
            eyebrow="Account context"
            title={`${roleLabels[role]} information`}
            description={roleDescriptions[role]}
          />
          <dl>
            {roleDetails.map(([label, value, muted]) => (
              <DetailRow key={label} label={label} value={value} muted={muted} />
            ))}
          </dl>
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-[#e5d4c8] bg-[#fffaf6] p-3.5 text-xs leading-5 text-[#806c63]">
            <ShieldIcon />
            <p>Role and academic information is managed by SmartLab administrators.</p>
          </div>
        </section>

        <section className="rounded-2xl border border-[#eadfd9] bg-[#fffdfb] p-5 shadow-[0_8px_26px_rgba(76,37,24,0.045)] sm:p-7 xl:col-span-2">
          <SectionHeading
            eyebrow="Account security"
            title="Change your password"
            description="Use a strong password that you do not reuse on other services."
            action={
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f6efe8] text-[#7a1d20]">
                <LockIcon />
              </div>
            }
          />
          <form onSubmit={handlePasswordSubmit} className="grid gap-5 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
            <InputField
              label="Current password"
              value={password.currentPassword}
              onChange={(event) => setPassword((current) => ({ ...current, currentPassword: event.target.value }))}
              type="password"
              autoComplete="current-password"
              placeholder="Enter current password"
              disabled={!user}
              required
            />
            <InputField
              label="New password"
              value={password.newPassword}
              onChange={(event) => setPassword((current) => ({ ...current, newPassword: event.target.value }))}
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              disabled={!user}
              required
            />
            <InputField
              label="Confirm new password"
              value={password.confirmPassword}
              onChange={(event) => setPassword((current) => ({ ...current, confirmPassword: event.target.value }))}
              type="password"
              autoComplete="new-password"
              placeholder="Repeat new password"
              disabled={!user}
              required
            />
            <Button type="submit" variant="secondary" loading={securityLoading} disabled={!user} className="lg:mb-0">
              Update password
            </Button>
          </form>
          {(securityError || passwordValidation || securityNotice || securitySuccess) && (
            <p className={`mt-4 text-sm ${securityError || passwordValidation ? 'text-[#a33c32]' : 'text-[#48715d]'}`} role="status">
              {securityError || passwordValidation || securityNotice || securitySuccess}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}