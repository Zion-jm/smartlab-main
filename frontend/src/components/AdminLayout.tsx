import { useEffect, useState, type ReactNode } from 'react';
import PortalLayout, { type PortalNavGroup, type PortalNavItem, type SidebarIconProps } from './PortalLayout';
import { academicPeriodApi } from '../services/api';

type IconProps = SidebarIconProps;

const DashboardIcon = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const UsersIcon = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const CalendarIcon = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const FileTextIcon = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14,2 14,8 20,8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const WrenchIcon = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const LayersIcon = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 7l9-4 9 4-9 4-9-4z" />
    <path d="M21 10l-9 4-9-4" />
    <path d="M12 22V14" />
  </svg>
);

const BarChartIcon = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const SettingsIcon = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.1h-4v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.8-2.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.8 2.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
);

const AuditLogIcon = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4h16v16H4z" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </svg>
);

const baseAdminNavItems: PortalNavItem[] = [
  {
    id: 'dashboard',
    to: '/admin/dashboard',
    icon: DashboardIcon,
    label: 'Dashboard',
    description: 'Monitor requests, manage users, and orchestrate SmartLab operations.',
  },
  {
    id: 'users',
    to: '/admin/users',
    icon: UsersIcon,
    label: 'Manage Accounts',
    description: 'Create, update, and deactivate admin, faculty, and student accounts.',
  },
  {
    id: 'schedule',
    to: '/admin/schedule',
    icon: CalendarIcon,
    label: 'Lab Schedule',
    description: 'Publish SmartLab schedules and resolve conflicts across rooms and programs.',
  },
  {
    id: 'requests',
    to: '/admin/requests',
    icon: FileTextIcon,
    label: 'Requests',
    description: 'Review borrow requests, post notes, and approve or reject submissions.',
  },
  {
    id: 'equipment',
    to: '/admin/equipment',
    icon: WrenchIcon,
    label: 'Equipments',
    description: 'Audit equipment inventory, track availability, and flag maintenance needs.',
  },
  {
    id: 'directory',
    to: '/admin/academic-directory',
    icon: LayersIcon,
    label: 'Academic Directory',
    description: 'Manage programs, subjects, rooms, and faculty profiles for SmartLab.',
  },
  {
    id: 'reports',
    to: '/admin/reports',
    icon: BarChartIcon,
    label: 'Reports',
    description: 'Generate usage analytics and export SmartLab performance metrics.',
  },
  {
    id: 'academic-period',
    to: '/admin/academic-period',
    icon: SettingsIcon,
    label: 'Academic Period',
    description: 'Set the active academic year and semester without changing historical records.',
  },
  {
    id: 'audit-logs',
    to: '/admin/audit-logs',
    icon: AuditLogIcon,
    label: 'Audit Logs',
    description: 'Review important administrator actions and safe change details.',
  },
];

const adminNavGroups: PortalNavGroup[] = [
  {
    id: 'operations',
    label: 'Operations',
    items: baseAdminNavItems.filter((item) => ['dashboard', 'schedule', 'requests', 'equipment', 'reports'].includes(item.id)),
  },
  {
    id: 'system-administration',
    label: 'System Administration',
    items: baseAdminNavItems.filter((item) => ['users', 'directory', 'academic-period', 'audit-logs'].includes(item.id)),
  },
];

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [activePeriodLabel, setActivePeriodLabel] = useState('Loading academic period…');

  useEffect(() => {
    let mounted = true;
    academicPeriodApi.get()
      .then((response) => {
        if (!mounted) return;
        setActivePeriodLabel(response.data?.current?.label ?? 'Academic period not set');
      })
      .catch(() => {
        if (mounted) setActivePeriodLabel('Academic period unavailable');
      });
    return () => {
      mounted = false;
    };
  }, []);

  const sidebarExtras = (
    <div data-testid="sidebar-active-academic-period" className="mx-4 mt-4 rounded-lg border border-[rgba(255,184,28,0.3)] bg-[#fef3e2] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9a7b4f]">Active period</p>
      <p className="mt-1 text-xs font-medium text-[#7c5f38]">{activePeriodLabel}</p>
    </div>
  );

  return (
    <PortalLayout
      navItems={baseAdminNavItems}
      navGroups={adminNavGroups}
      portalLabel="Admin Portal"
      portalSubLabel="smartlab."
      sidebarExtras={sidebarExtras}
    >
      {children}
    </PortalLayout>
  );
}
