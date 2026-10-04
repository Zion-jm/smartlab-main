import { TableScrollContext } from './shared/tableScrollContext';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { getUserPreferences, usePreferencesStore } from '../stores/preferencesStore';
import NotificationBell from './NotificationBell';

export type SidebarIconProps = { size?: number };

const MenuIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const UserAvatarIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z"
      fill="currentColor"
    />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const KeyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path
      d="M12.65 10C11.83 7.67 9.61 6 7 6C3.69 6 1 8.69 1 12C1 15.31 3.69 18 7 18C9.61 18 11.83 16.33 12.65 14H17V18H21V14H23V10H12.65ZM7 14C5.9 14 5 13.1 5 12C5 10.9 5.9 10 7 10C8.1 10 9 10.9 9 12C9 13.1 8.1 14 7 14Z"
      fill="currentColor"
    />
  </svg>
);

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.1h-4v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.8-2.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l2.8 2.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

void BellIcon;
void KeyIcon;

const LogoutIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.59L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z" fill="currentColor" />
  </svg>
);

export type PortalNavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<SidebarIconProps>;
  to?: string;
  onClick?: () => void;
  badge?: string;
  isActive?: boolean;
  description?: string;
};

export type PortalNavGroup = {
  id: string;
  label: string;
  items: PortalNavItem[];
};

interface PortalLayoutProps {
  children: ReactNode;
  navItems: PortalNavItem[];
  navGroups?: PortalNavGroup[];
  portalLabel: string;
  portalSubLabel?: string;
  headerTitle?: string;
  headerSubtitle?: string;
  headerBadge?: string;
  sidebarExtras?: ReactNode;
  rightHeaderContent?: ReactNode;
}

const NavEntry = ({ item, showLabel, onNavigate }: { item: PortalNavItem; showLabel: boolean; onNavigate: () => void }) => {
  const { icon: Icon } = item;
  const content = (
    <div
      className={`flex ${showLabel ? 'items-center gap-2.5 lg:gap-3 px-3 lg:px-4' : 'items-center justify-center px-2'} py-2 lg:py-2.5 mx-2 lg:mx-3 rounded-xl text-xs lg:text-sm font-medium transition-all ${
        item.isActive ? 'bg-[#800000] text-white shadow-md' : 'text-[#4b5563] hover:bg-[rgba(128,0,0,0.05)] hover:text-[#800000]'
      }`}
    >
      <Icon size={showLabel ? 18 : 20} />
      {showLabel && (
        <span className="text-xs lg:text-sm flex items-center gap-2">
          {item.label}
          {item.badge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#fff5f5] text-[#b91c1c] uppercase">{item.badge}</span>
          )}
        </span>
      )}
    </div>
  );

  const handleNavigate = () => {
    item.onClick?.();
    onNavigate();
  };

  if (item.to) {
    return (
      <Link to={item.to} onClick={handleNavigate} className="block">
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={handleNavigate} className="w-full text-left" aria-current={item.isActive}>
      {content}
    </button>
  );
};

export default function PortalLayout({
  children,
  navItems,
  navGroups,
  portalLabel,
  portalSubLabel = 'smartlab.',
  headerTitle,
  headerSubtitle,
  headerBadge,
  sidebarExtras,
  rightHeaderContent,
}: PortalLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const userId = user?.id ?? 'anonymous';
  const setPreference = usePreferencesStore((state) => state.setPreference);
  const preferencesByUser = usePreferencesStore((state) => state.preferencesByUser);
  const sidebarCollapsedByDefault = getUserPreferences(preferencesByUser, userId).sidebarCollapsedByDefault;
  const [isCollapsed, setIsCollapsed] = useState(sidebarCollapsedByDefault);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const resolvedNavItems = useMemo(
    () =>
      navItems.map((item) => ({
        ...item,
        isActive: item.isActive ?? (item.to ? location.pathname === item.to : false),
      })),
    [navItems, location.pathname]
  );

  const resolvedNavGroups = useMemo(
    () => navGroups?.map((group) => ({
      ...group,
      items: group.items.map((item) => ({
        ...item,
        isActive: item.isActive ?? (item.to ? location.pathname === item.to : false),
      })),
    })),
    [location.pathname, navGroups],
  );

  const currentNav = [...resolvedNavItems, ...(resolvedNavGroups?.flatMap((group) => group.items) ?? [])].find((item) => item.isActive);
  const resolvedHeaderTitle = headerTitle || currentNav?.label || portalLabel;
  const resolvedHeaderSubtitle = headerSubtitle ?? currentNav?.description;

  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileMenuOpen(false);
    setShowProfileDropdown(false);
  };

  useEffect(() => {
    if (!showProfileDropdown) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showProfileDropdown]);

  const [tableScrollRoot, setTableScrollRoot] = useState<HTMLDivElement | null>(null);
  const [tableStickyInset, setTableStickyInset] = useState(0);
  const defaultRightActions = <NotificationBell />;
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.email || 'SmartLab user';
  const roleLabel = user?.role === 'ADMIN' ? 'Admin Portal' : user?.role === 'FACULTY' ? 'Faculty Portal' : 'Student Portal';

  return (
    <div className="min-h-dvh lg:min-h-screen bg-[#f8f9fa] font-['Inter',sans-serif]">
      {mobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />}

      <aside
        className={`fixed left-0 top-0 h-dvh max-h-dvh bg-white shadow-[2px_0_10px_rgba(0,0,0,0.1)] z-50 transition-all duration-300 flex flex-col ${
          mobileMenuOpen ? 'translate-x-0 w-[250px]' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-[70px]' : 'lg:w-[250px]'}`}
      >
        <div className="shrink-0 p-5 border-b border-[#e5e7eb]">
          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
            <img
              src="/PUPLogo.png"
              alt="SmartLab"
              className="w-10 h-10 object-contain rounded-full border-2 border-[#FFB81C] p-0.5 bg-white shrink-0"
            />
            {!isCollapsed && (
              <div>
                <h2 className="text-[#800000] font-bold text-lg leading-tight">{portalSubLabel}</h2>
                <p className="text-xs text-[#6b7280]">{portalLabel}</p>
              </div>
            )}
          </div>
        </div>

        {!isCollapsed && <div className="shrink-0">{sidebarExtras}</div>}

        <nav className="min-h-0 flex-1 py-4 space-y-1 overflow-y-auto overscroll-contain">
          {resolvedNavGroups
            ? resolvedNavGroups.map((group) => (
              <div key={group.id} className="mb-3" data-testid={`sidebar-group-${group.id}`}>
                {!isCollapsed && (
                  <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9a7b4f]">
                    {group.label}
                  </p>
                )}
                {group.items.map((item) => (
                  <NavEntry key={item.id} item={item} showLabel={!isCollapsed} onNavigate={() => setMobileMenuOpen(false)} />
                ))}
              </div>
            ))
            : resolvedNavItems.map((item) => (
              <NavEntry key={item.id} item={item} showLabel={!isCollapsed} onNavigate={() => setMobileMenuOpen(false)} />
            ))}
        </nav>

        <div ref={profileMenuRef} className="shrink-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:p-4 border-t border-[#e5e7eb] relative">
          <button
            onClick={() => {
              if (isCollapsed) {
                navigate('/profile');
                return;
              }
              setShowProfileDropdown(!showProfileDropdown);
            }}
            aria-expanded={showProfileDropdown}
            aria-haspopup="menu"
            className={`flex items-center gap-2.5 lg:gap-3 w-full py-2 px-2.5 lg:p-2.5 rounded-xl hover:bg-[rgba(128,0,0,0.05)] transition-all ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-[#800000] text-white flex items-center justify-center shrink-0">
              <UserAvatarIcon />
            </div>
            {!isCollapsed && (
              <>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-xs lg:text-sm font-medium text-[#1f2937] truncate">{displayName}</p>
                  <p className="text-[10px] text-[#6b7280] truncate">{user?.email || 'user@smartlab'}</p>
                </div>
                <div className="text-[#4b5563]">
                  <ChevronDownIcon />
                </div>
              </>
            )}
          </button>

          {showProfileDropdown && !isCollapsed && (
            <div role="menu" className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-xl shadow-lg border border-[#e5e7eb] py-2 z-50">
              <div className="px-4 py-2 border-b border-[#e5e7eb]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-[#800000] text-white flex items-center justify-center">
                    <UserAvatarIcon />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs lg:text-sm font-semibold text-[#1f2937] truncate">{displayName}</p>
                    <p className="text-[10px] text-[#6b7280] truncate">{user?.email || 'user@smartlab'}</p>
                  </div>
                </div>
              </div>
              <div className="px-4 py-2">
                <span className="inline-block px-2 py-1 bg-[#800000] text-white text-xs rounded-full">{roleLabel}</span>
              </div>
              <div className="border-t border-[#e5e7eb] mt-2 pt-2">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    navigate('/profile');
                    setShowProfileDropdown(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs lg:text-sm text-[#4b5563] hover:bg-[rgba(128,0,0,0.05)] hover:text-[#800000] transition-all"
                >
                  <UserAvatarIcon />
                  My Profile
                </button>
                {user?.role === 'ADMIN' && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    navigate('/settings');
                    setShowProfileDropdown(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs lg:text-sm text-[#4b5563] hover:bg-[rgba(128,0,0,0.05)] hover:text-[#800000] transition-all"
                >
                  <SettingsIcon />
                  Settings
                </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs lg:text-sm text-red-600 hover:bg-red-50 transition-all"
                >
                  <LogoutIcon />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      <main
        className={`h-dvh min-h-0 lg:min-h-screen min-w-0 max-h-dvh lg:max-h-screen transition-all duration-300 overflow-hidden flex flex-col ${
          isCollapsed ? 'lg:ml-[70px] lg:w-[calc(100%-70px)]' : 'lg:ml-[250px] lg:w-[calc(100%-250px)]'
        }`}
      >
        <header className="shrink-0 sticky top-0 z-40 bg-white border-b border-[#e5e7eb] px-4 lg:px-6 py-4 flex items-center justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-2 lg:gap-4">
            <div className="flex shrink-0 items-center gap-2 pt-0.5">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-[rgba(128,0,0,0.05)] text-[#4b5563] transition-all"
                aria-label="Toggle mobile menu"
              >
                <MenuIcon />
              </button>

              <button
                onClick={() => {
                  const next = !isCollapsed;
                  setIsCollapsed(next);
                  if (user?.role === 'STUDENT' || user?.role === 'FACULTY') {
                    setPreference(userId, 'sidebarCollapsedByDefault', next);
                  }
                }}
                className="hidden lg:inline-flex p-2 rounded-lg hover:bg-[rgba(128,0,0,0.05)] text-[#4b5563] transition-all"
                aria-label="Toggle sidebar"
              >
                <MenuIcon />
              </button>
            </div>

            <nav className="flex min-w-0 flex-col gap-0.5 [overflow-wrap:anywhere]">
              <div className="flex items-center flex-wrap gap-2 text-xs lg:text-sm">
                <span className="font-semibold text-[#800000]">SmartLab</span>
                <span className="text-[#9ca3af]">/</span>
                <span className="text-[#4b5563] font-medium">{resolvedHeaderTitle}</span>
                {headerBadge && (
                  <span className="px-2 py-0.5 rounded-full bg-[#fff5f5] text-[10px] font-semibold text-[#b91c1c] uppercase tracking-wide">
                    {headerBadge}
                  </span>
                )}
              </div>
              {resolvedHeaderSubtitle && <p className="text-xs text-[#6b7280]">{resolvedHeaderSubtitle}</p>}
            </nav>
          </div>

          <div className="ml-2 flex shrink-0 items-center gap-3">{rightHeaderContent ?? defaultRightActions}</div>
        </header>

        <div
          ref={setTableScrollRoot}
          className="portal-content min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-[#f8f9fa] p-2 lg:p-4"
        >
          <TableScrollContext.Provider value={{root:tableScrollRoot,inset:tableStickyInset,setInset:setTableStickyInset}}>{children}</TableScrollContext.Provider>
        </div>
      </main>
    </div>
  );
}
