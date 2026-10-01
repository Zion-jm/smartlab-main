type IconProps = { size?: number };

const Icon = ({
  size = 24,
  children,
}: IconProps & { children: React.ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const UsersIcon = ({ size = 24 }: IconProps) => (
  <Icon size={size}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>
);

export const GraduationCapIcon = ({ size = 24 }: IconProps) => (
  <Icon size={size}>
    <path d="m22 10-10-5L2 10l10 5 10-5Z" />
    <path d="M6 12.5V17c3.5 2.7 8.5 2.7 12 0v-4.5" />
    <path d="M22 10v6" />
  </Icon>
);

export const TeacherIcon = ({ size = 24 }: IconProps) => (
  <Icon size={size}>
    <circle cx="12" cy="7" r="4" />
    <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
    <path d="M3 11h18" />
  </Icon>
);

export const ClockIcon = ({ size = 24 }: IconProps) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

export const FlaskIcon = ({ size = 24 }: IconProps) => (
  <Icon size={size}>
    <path d="M9 3h6" />
    <path d="M10 3v5.5L5 18a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 18l-5-9.5V3" />
    <path d="M7.5 16h9" />
  </Icon>
);

export const PackageIcon = ({ size = 24 }: IconProps) => (
  <Icon size={size}>
    <path d="m3 7 9-4 9 4-9 4-9-4Z" />
    <path d="M3 7v10l9 4 9-4V7" />
    <path d="M12 11v10" />
    <path d="m7.5 5 9 4" />
  </Icon>
);

export const AlertTriangleIcon = ({ size = 24 }: IconProps) => (
  <Icon size={size}>
    <path d="m10.3 3.5-8 14A2 2 0 0 0 4 20.5h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </Icon>
);

export const UserPlusIcon = ({ size = 24 }: IconProps) => (
  <Icon size={size}>
    <path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <path d="M19 8v6" />
    <path d="M22 11h-6" />
  </Icon>
);

export const CalendarPlusIcon = ({ size = 24 }: IconProps) => (
  <Icon size={size}>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
    <path d="M12 13v5M9.5 15.5h5" />
  </Icon>
);

export const WrenchIcon = ({ size = 24 }: IconProps) => (
  <Icon size={size}>
    <path d="M14.7 6.3a4.5 4.5 0 0 0-5.8 5.8L3.6 17.4a2.1 2.1 0 1 0 3 3l5.3-5.3a4.5 4.5 0 0 0 5.8-5.8l-3 3-3-3 3-3Z" />
  </Icon>
);

export const RefreshIcon = ({ spinning }: { spinning: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={spinning ? 'animate-spin' : ''}
    aria-hidden="true"
  >
    <path d="M20 11a8.1 8.1 0 0 0-14.8-4L3 10" />
    <path d="M3 4v6h6" />
    <path d="M4 13a8.1 8.1 0 0 0 14.8 4L21 14" />
    <path d="M21 20v-6h-6" />
  </svg>
);

export const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

export const TrendingUpIcon = ({ size = 16 }: IconProps) => (
  <Icon size={size}>
    <path d="m3 17 6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </Icon>
);

export const TrendingDownIcon = ({ size = 16 }: IconProps) => (
  <Icon size={size}>
    <path d="m3 7 6 6 4-4 8 8" />
    <path d="M15 17h6v-6" />
  </Icon>
);
