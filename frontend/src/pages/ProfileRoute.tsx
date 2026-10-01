import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import PortalLayout, { type PortalNavItem, type SidebarIconProps } from '../components/PortalLayout';
import ProfilePage from './ProfilePage';
import { authApi, userApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';

const WorkspaceIcon = ({ size = 18 }: SidebarIconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);

const UserCircleIcon = ({ size = 18 }: SidebarIconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c.8-3.3 3.1-5 7-5s6.2 1.7 7 5" />
  </svg>
);

const getApiError = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string; message?: string } } }).response;
    return response?.data?.error ?? response?.data?.message ?? fallback;
  }
  return fallback;
};

function RoleShell({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const role = user?.role;

  const navItems = useMemo<PortalNavItem[]>(
    () => [
      {
        id: 'workspace',
        label: 'Workspace',
        icon: WorkspaceIcon,
        to: role === 'FACULTY' ? '/faculty/panel' : '/student/panel',
        description: 'Return to your SmartLab workspace.',
      },
      {
        id: 'profile',
        label: 'My Profile',
        icon: UserCircleIcon,
        isActive: true,
        onClick: () => navigate('/profile'),
        description: 'Update your personal details and account security.',
      },
    ],
    [navigate, role]
  );

  return (
    <PortalLayout
      navItems={navItems}
      portalLabel={role === 'FACULTY' ? 'Faculty Portal' : 'Student Portal'}
      portalSubLabel="smartlab."
      sidebarExtras={
        <div className="mx-4 mt-4 rounded-lg border border-[rgba(255,184,28,0.3)] bg-[#fef3e2] p-3">
          <p className="text-xs font-medium text-[#9a7b4f]">2025-2026 · 1st Semester</p>
        </div>
      }
    >
      {children}
    </PortalLayout>
  );
}

export default function ProfileRoute() {
  const { user, refreshUser } = useAuthStore();
  const [profileLoading, setProfileLoading] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const handleProfileSubmit = async (values: { firstName: string; lastName: string; phone: string }) => {
    if (!user) return;

    setProfileLoading(true);
    setProfileError(null);
    try {
      await userApi.update(user.id, values);
      await refreshUser();
      toast.success('Profile details updated successfully.');
    } catch (error) {
      const message = getApiError(error, 'Failed to update your profile. Please try again.');
      setProfileError(message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (values: { currentPassword: string; newPassword: string }) => {
    setSecurityLoading(true);
    setSecurityError(null);
    try {
      await authApi.changePassword(values);
      toast.success('Password updated. Please sign in again.');
      useAuthStore.getState().logout();
    } catch (error) {
      const message = getApiError(error, 'Failed to update your password. Please try again.');
      setSecurityError(message);
    } finally {
      setSecurityLoading(false);
    }
  };

  const content = (
    <ProfilePage
      key={`${user?.id ?? 'anonymous'}:${user?.firstName ?? ''}:${user?.lastName ?? ''}:${user?.phone ?? ''}`}
      user={user}
      onProfileSubmit={handleProfileSubmit}
      onPasswordSubmit={handlePasswordSubmit}
      profileLoading={profileLoading}
      securityLoading={securityLoading}
      profileError={profileError}
      securityError={securityError}
    />
  );

  if (user?.role === 'ADMIN') {
    return <AdminLayout>{content}</AdminLayout>;
  }

  return <RoleShell>{content}</RoleShell>;
}