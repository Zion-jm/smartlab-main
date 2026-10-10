import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { equipmentApi, borrowRequestApi, userApi, labScheduleApi } from '../services/api';
import type { BorrowRequest } from '../types/requests';
import type { ApiLabSchedule } from '../types/labSchedule';
import { dateToDateKey, dateToTimeString, dateToWeekdayIndex } from '../utils/dateTime';
import {
  UsersIcon,
  GraduationCapIcon,
  TeacherIcon,
  ClockIcon,
  FlaskIcon,
  PackageIcon,
  AlertTriangleIcon,
  UserPlusIcon,
  CalendarPlusIcon,
  WrenchIcon,
  RefreshIcon,
  ArrowRightIcon,
} from '../components/admin/DashboardIcons';

interface StatsCardProps {
  icon: React.ElementType;
  iconGradient: string;
  title: string;
  value: string | number;
  isRed?: boolean;
}

const StatsCard = ({ icon: Icon, iconGradient, title, value, isRed }: StatsCardProps) => (
  <div className="dashboard-stat flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white p-3 transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(128,0,0,0.12)] lg:gap-4 lg:p-4">
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white lg:h-12 lg:w-12 ${iconGradient}`}>
      <Icon />
    </div>
    <div className="min-w-0 flex-1">
      <h4 className="mb-0.5 text-xs font-medium text-[#6b7280] lg:text-sm">{title}</h4>
      <p className={`text-xl font-bold lg:text-2xl ${isRed ? 'text-red-600' : 'text-[#1f2937]'}`}>{value}</p>
    </div>
  </div>
);

const Card = ({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) => (
  <section className="dashboard-section mb-5 rounded-2xl border border-[#ead7d3] bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-[#e5e7eb] px-3 pb-2 pt-3 lg:px-4 lg:pb-3 lg:pt-4">
      <h2 className="text-sm font-semibold text-[#1f2937]">{title}</h2>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
    <div className="p-2 lg:p-3">{children}</div>
  </section>
);

type ActivityEntry = {
  id: number;
  type: 'request' | 'equipment' | 'schedule' | 'alert';
  title: string;
  meta: string;
  iconColor: string;
  href: string;
};

interface DashboardStats {
  users: {
    total: number;
    students: number;
    faculty: number;
    admins: number;
  };
  equipment: {
    uniqueItems: number;
    totalQuantity: number;
    availableQuantity: number;
    borrowedQuantity: number;
    damagedQuantity: number;
    archivedQuantity: number;
    lowStockCount: number;
    utilizationRate: number;
  };
  requests: {
    pending: number;
    todayReserved: number;
    upcoming: number;
    overdue: number;
  };
  schedules: {
    today: number;
    thisWeek: number;
    activeNow: number;
  };
}

const activeRequestStatuses = new Set(['APPROVED', 'BORROWED']);

const getManilaWeekKeys = (todayKey: string) => {
  const baseDate = new Date(`${todayKey}T12:00:00+08:00`);
  const dayIndex = baseDate.getUTCDay();
  const start = new Date(baseDate);
  start.setUTCDate(start.getUTCDate() - dayIndex);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return dateToDateKey(date, 'Asia/Manila');
  });
};

const scheduleOccursOn = (schedule: ApiLabSchedule, dateKey: string) => {
  if (schedule.scheduleType === 'WEEKLY') {
    return dateToWeekdayIndex(`${dateKey}T12:00:00+08:00`, 'Asia/Manila') === schedule.dayOfWeek;
  }
  return dateToDateKey(schedule.scheduleDate, 'Asia/Manila') === dateKey;
};

const scheduleIsActiveNow = (schedule: ApiLabSchedule, todayKey: string, now: Date) => {
  if (!scheduleOccursOn(schedule, todayKey)) return false;

  const nowTime = dateToTimeString(now, 'Asia/Manila');
  const startTime = dateToTimeString(schedule.timeStart, 'Asia/Manila');
  const endTime = dateToTimeString(schedule.timeEnd, 'Asia/Manila');
  if (!nowTime || !startTime || !endTime) return false;

  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  };
  const currentMinutes = toMinutes(nowTime);
  const startMinutes = toMinutes(startTime);
  let endMinutes = toMinutes(endTime);
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;
  const adjustedCurrent = currentMinutes < startMinutes ? currentMinutes + 24 * 60 : currentMinutes;
  return adjustedCurrent >= startMinutes && adjustedCurrent <= endMinutes;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsRefreshing(true);
    setDashboardError(null);

    const [equipmentResult, usersResult, requestsResult, schedulesResult] = await Promise.allSettled([
      equipmentApi.getStats(),
      userApi.getAll(),
      borrowRequestApi.getAll({ status: 'ALL', sort: 'date-desc' }),
      labScheduleApi.getAll(),
    ]);

    const failedSources = [
      equipmentResult.status === 'rejected' ? 'equipment' : null,
      usersResult.status === 'rejected' ? 'users' : null,
      requestsResult.status === 'rejected' ? 'requests' : null,
      schedulesResult.status === 'rejected' ? 'schedules' : null,
    ].filter(Boolean);

    if (failedSources.length > 0) {
      const limit = [equipmentResult, usersResult, requestsResult, schedulesResult].find(result => result.status === 'rejected' && result.reason instanceof Error && /exceeds 1000|Data changed while loading/.test(result.reason.message));
      setDashboardError(limit?.status === 'rejected' ? limit.reason.message : `Some dashboard data could not be loaded (${failedSources.join(', ')}). Showing the available data.`);
    }

    const equipmentData = equipmentResult.status === 'fulfilled' ? equipmentResult.value.data : null;
    const users = usersResult.status === 'fulfilled' && Array.isArray(usersResult.value.data) ? usersResult.value.data : [];
    const requestPayload =
      requestsResult.status === 'fulfilled'
        ? requestsResult.value.data
        : { requests: [], stats: {} as Record<string, number> };
    const requests = (requestPayload?.requests ?? []) as BorrowRequest[];
    const schedulesRaw = schedulesResult.status === 'fulfilled' ? schedulesResult.value.data : { schedules: [] };
    const schedules = (Array.isArray(schedulesRaw) ? schedulesRaw : schedulesRaw?.schedules ?? []) as ApiLabSchedule[];
    const inventoryStats = equipmentData?.inventory ?? {};
    const todayKey = dateToDateKey(new Date(), 'Asia/Manila');
    const weekKeys = getManilaWeekKeys(todayKey);
    const todayRequests = requests.filter(
      (request) =>
        dateToDateKey(request.dateNeeded, 'Asia/Manila') === todayKey &&
        activeRequestStatuses.has(request.status)
    );
    const nextSevenDaysEnd = new Date(`${todayKey}T12:00:00+08:00`);
    nextSevenDaysEnd.setUTCDate(nextSevenDaysEnd.getUTCDate() + 7);
    const nextSevenDaysKey = dateToDateKey(nextSevenDaysEnd, 'Asia/Manila');
    const upcomingRequests = requests.filter((request) => {
      const dateKey = dateToDateKey(request.dateNeeded, 'Asia/Manila');
      return activeRequestStatuses.has(request.status) && dateKey > todayKey && dateKey <= nextSevenDaysKey;
    });
    const overdueRequests = requests.filter(
      (request) =>
        request.status === 'BORROWED' &&
        dateToDateKey(request.dateNeeded, 'Asia/Manila') < todayKey
    );
    const todaySchedules = schedules.filter((schedule) => scheduleOccursOn(schedule, todayKey));
    const thisWeekSchedules = schedules.filter((schedule) => weekKeys.some((dateKey) => scheduleOccursOn(schedule, dateKey)));
    const userStats = {
      total: users.length,
      students: users.filter((user: { role_name?: string; role?: string }) => (user.role_name ?? user.role) === 'STUDENT').length,
      faculty: users.filter((user: { role_name?: string; role?: string }) => (user.role_name ?? user.role) === 'FACULTY').length,
      admins: users.filter((user: { role_name?: string; role?: string }) => (user.role_name ?? user.role) === 'ADMIN').length,
    };

    const dashboardStats: DashboardStats = {
      users: userStats,
      equipment: {
        uniqueItems: inventoryStats.uniqueItems ?? 0,
        totalQuantity: inventoryStats.totalQuantity ?? 0,
        availableQuantity: inventoryStats.availableQuantity ?? 0,
        borrowedQuantity: inventoryStats.borrowedQuantity ?? 0,
        damagedQuantity: inventoryStats.damagedQuantity ?? 0,
        archivedQuantity: inventoryStats.archivedQuantity ?? 0,
        lowStockCount: inventoryStats.lowStockCount ?? 0,
        utilizationRate: Number.isFinite(inventoryStats.utilizationRate ?? 0) ? inventoryStats.utilizationRate ?? 0 : 0,
      },
      requests: {
        pending: requestPayload?.stats?.PENDING ?? requests.filter((request) => request.status === 'PENDING').length,
        todayReserved: todayRequests.length,
        upcoming: upcomingRequests.length,
        overdue: overdueRequests.length,
      },
      schedules: {
        today: todaySchedules.length,
        thisWeek: thisWeekSchedules.length,
        activeNow: todaySchedules.filter((schedule) => scheduleIsActiveNow(schedule, todayKey, new Date())).length,
      },
    };

    const currentActivities: ActivityEntry[] = [
      ...(dashboardStats.requests.pending > 0
        ? [{
            id: 1,
            type: 'request' as const,
            title: `${dashboardStats.requests.pending} pending ${dashboardStats.requests.pending === 1 ? 'request' : 'requests'}`,
            meta: 'Review and approve submissions',
            iconColor: 'bg-[#fff7ed] text-[#c2410c]',
            href: '/admin/requests',
          }]
        : []),
      ...(dashboardStats.requests.overdue > 0
        ? [{
            id: 2,
            type: 'alert' as const,
            title: `${dashboardStats.requests.overdue} overdue ${dashboardStats.requests.overdue === 1 ? 'return' : 'returns'}`,
            meta: 'Check borrowed equipment',
            iconColor: 'bg-[#fef2f2] text-[#b91c1c]',
            href: '/admin/requests',
          }]
        : []),
      ...(dashboardStats.equipment.lowStockCount > 0
        ? [{
            id: 3,
            type: 'equipment' as const,
            title: `${dashboardStats.equipment.lowStockCount} low-stock ${dashboardStats.equipment.lowStockCount === 1 ? 'item' : 'items'}`,
            meta: 'Review inventory availability',
            iconColor: 'bg-[#fff7ed] text-[#c2410c]',
            href: '/admin/equipment',
          }]
        : []),
      ...(dashboardStats.schedules.activeNow > 0
        ? [{
            id: 4,
            type: 'schedule' as const,
            title: `${dashboardStats.schedules.activeNow} active lab ${dashboardStats.schedules.activeNow === 1 ? 'session' : 'sessions'}`,
            meta: 'Currently in progress',
            iconColor: 'bg-[#f0fdf4] text-[#15803d]',
            href: '/admin/schedule',
          }]
        : []),
    ];

    setStats(dashboardStats);
    setActivities(currentActivities);
    setLastUpdated(new Date());
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void fetchStats(), 0);
    return () => clearTimeout(timer);
  }, [fetchStats]);

  useEffect(() => {
    const interval = setInterval(() => void fetchStats(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (!stats) {
    return (
      <AdminLayout>
        <div className="mx-auto flex min-h-[400px] responsive-workspace items-center justify-center p-2 lg:p-3">
          <div className="text-center">
            <RefreshIcon spinning={true} />
            <p className="mt-4 text-sm text-[#6b7280]">Loading dashboard…</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const quickActions = [
    { label: 'Add new user', icon: UserPlusIcon, gradient: 'from-[#800000] to-[#5c0000]', href: '/admin/users?new=1' },
    { label: 'Review requests', icon: ClockIcon, gradient: 'from-blue-500 to-blue-600', href: '/admin/requests?status=PENDING' },
    { label: 'Lab schedule', icon: CalendarPlusIcon, gradient: 'from-gray-500 to-gray-600', href: '/admin/schedule' },
    { label: 'Manage equipment', icon: WrenchIcon, gradient: 'from-yellow-500 to-orange-500', href: '/admin/equipment' },
  ];

  return (
    <AdminLayout>
      <div className="dashboard-workspace mx-auto responsive-workspace p-2 lg:p-3">
        <header className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-[#800000] to-[#4b1111] p-5 text-white shadow-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#efd0bc]">SmartLab overview</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Your campus, at a glance</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#f1dddd]">Monitor requests, equipment availability, and the work that needs your attention.</p>
          <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" onClick={() => navigate('/admin/requests?status=PENDING')} className="min-h-11 rounded-xl bg-white px-4 text-xs font-semibold text-[#800000]">Review {stats.requests.pending} pending requests</button><span className="text-xs text-[#f1dddd]">{new Date().toLocaleDateString('en-US', {timeZone: 'Asia/Manila', weekday: 'long', month: 'short', day: 'numeric'})}</span></div>
        </header>
        {dashboardError && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f6e8b1] bg-[#fffdf5] px-4 py-3 text-sm text-[#92400e]">
            <span>{dashboardError}</span>
            <button type="button" onClick={() => void fetchStats()} className="font-semibold underline">
              Try again
            </button>
          </div>
        )}

        <Card
          title="System overview"
          actions={
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <span className="hidden text-xs text-[#6b7280] sm:inline">
                  Updated {lastUpdated.toLocaleTimeString([], { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })}
                </span>
              )}
              <button
                type="button"
                onClick={() => void fetchStats()}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-medium text-[#4b5563] transition hover:bg-[#f8f9fa] disabled:cursor-wait disabled:opacity-50 lg:px-4 lg:py-2 lg:text-sm"
              >
                <RefreshIcon spinning={isRefreshing} />
                Refresh
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
            <StatsCard icon={UsersIcon} iconGradient="bg-gradient-to-br from-[#800000] to-[#5c0000]" title="Total users" value={stats.users.total} />
            <StatsCard icon={GraduationCapIcon} iconGradient="bg-gradient-to-br from-pink-400 to-rose-500" title="Students" value={stats.users.students} />
            <StatsCard icon={TeacherIcon} iconGradient="bg-gradient-to-br from-blue-400 to-cyan-400" title="Faculty" value={stats.users.faculty} />
            <StatsCard icon={ClockIcon} iconGradient="bg-gradient-to-br from-amber-400 to-orange-500" title="Pending requests" value={stats.requests.pending} isRed={stats.requests.pending > 0} />
            <StatsCard icon={AlertTriangleIcon} iconGradient="bg-gradient-to-br from-red-400 to-rose-600" title="Overdue returns" value={stats.requests.overdue} isRed={stats.requests.overdue > 0} />
            <StatsCard icon={PackageIcon} iconGradient="bg-gradient-to-br from-emerald-400 to-teal-500" title="Equipment utilization" value={`${stats.equipment.utilizationRate}%`} />
          </div>
        </Card>

        

        <Card title="Equipment status">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
              <div className="mb-2 flex items-center gap-2 text-[#374151]"><PackageIcon size={16} /><h3 className="text-sm font-medium">Catalog items</h3></div>
              <p className="text-2xl font-bold text-[#1f2937]">{stats.equipment.uniqueItems}</p>
              <p className="mt-1 text-xs text-[#6b7280]">{stats.equipment.totalQuantity} total units</p>
            </div>
            <div className="rounded-lg border border-[#dcfce7] bg-[#f0fdf4] p-3">
              <div className="mb-2 flex items-center gap-2 text-[#166534]"><PackageIcon size={16} /><h3 className="text-sm font-medium">Available</h3></div>
              <p className="text-2xl font-bold text-[#166534]">{stats.equipment.availableQuantity}</p>
              <p className="mt-1 text-xs text-[#16a34a]">Ready for use</p>
            </div>
            <div className="rounded-lg border border-[#fde68a] bg-[#fef3c7] p-3">
              <div className="mb-2 flex items-center gap-2 text-[#92400e]"><ClockIcon size={16} /><h3 className="text-sm font-medium">Borrowed</h3></div>
              <p className="text-2xl font-bold text-[#92400e]">{stats.equipment.borrowedQuantity}</p>
              <p className="mt-1 text-xs text-[#a16207]">Currently in use</p>
            </div>
            <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3">
              <div className="mb-2 flex items-center gap-2 text-[#991b1b]"><AlertTriangleIcon size={16} /><h3 className="text-sm font-medium">Damaged</h3></div>
              <p className="text-2xl font-bold text-[#991b1b]">{stats.equipment.damagedQuantity}</p>
              <p className="mt-1 text-xs text-[#7f1d1d]">{stats.equipment.damagedQuantity} damaged · {stats.equipment.lowStockCount} low stock</p>
            </div>
          </div>
        </Card>

        

        <div className="mb-5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm text-[#475569]">
          <span className="font-semibold">Archived: {stats.equipment.archivedQuantity} units</span>
          <span className="ml-2">Included in total inventory; unavailable for new loans. Borrowed and damaged units are counted separately.</span>
        </div>
        <Card title="Operations at a glance">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'Today’s reservations', value: stats.requests.todayReserved, detail: 'Approved or borrowed', href: '/admin/requests', icon: ClockIcon },
              { label: 'Next 7 days', value: stats.requests.upcoming, detail: 'Upcoming reservations', href: '/admin/requests', icon: CalendarPlusIcon },
              { label: 'Overdue returns', value: stats.requests.overdue, detail: 'Borrowed past date', href: '/admin/requests', icon: AlertTriangleIcon },
              { label: 'Schedules today', value: stats.schedules.today, detail: 'One-time or weekly', href: '/admin/schedule', icon: FlaskIcon },
              { label: 'Schedules this week', value: stats.schedules.thisWeek, detail: 'Scheduled entries', href: '/admin/schedule', icon: CalendarPlusIcon },
              { label: 'Active now', value: stats.schedules.activeNow, detail: 'Sessions in progress', href: '/admin/schedule', icon: FlaskIcon },
            ].map(({ label, value, detail, href, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => navigate(href)}
                className="rounded-lg border border-[#e5e7eb] bg-[#fcfcfd] p-3 text-left transition hover:-translate-y-0.5 hover:border-[#d9b1b1] hover:bg-[#fff8f8]"
              >
                <Icon size={18} />
                <p className="mt-2 text-xs font-semibold text-[#6b7280]">{label}</p>
                <p className="mt-1 text-2xl font-bold text-[#1f2937]">{value}</p>
                <p className="mt-1 text-[11px] text-[#9ca3af]">{detail}</p>
              </button>
            ))}
          </div>
        </Card>

        

        <Card title="Quick actions">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-4">
            {quickActions.map(({ label, icon: Icon, gradient, href }) => (
              <button
                key={label}
                type="button"
                onClick={() => navigate(href)}
                className={`flex min-h-[72px] items-center justify-center gap-2 rounded-xl bg-gradient-to-br ${gradient} px-2.5 py-2.5 font-medium text-white transition-all hover:-translate-y-1 hover:shadow-lg lg:p-4`}
              >
                <Icon size={18} />
                <span className="text-center text-xs leading-tight lg:text-base">{label}</span>
              </button>
            ))}
          </div>
        </Card>

        

        <Card
          title="Needs attention"
          actions={
            <button type="button" onClick={() => navigate('/admin/requests')} className="inline-flex items-center gap-1 text-xs font-semibold text-[#800000] hover:underline lg:text-sm">
              View requests <ArrowRightIcon />
            </button>
          }
        >
          <div className="space-y-2 md:max-h-[400px] md:overflow-y-auto">
            {activities.length > 0 ? (
              activities.map((activity) => (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() => navigate(activity.href)}
                  className="flex w-full items-start gap-3 rounded-lg border-b border-[#e5e7eb] p-3 text-left transition-colors last:border-0 hover:bg-[#f9fafb] lg:p-4"
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full lg:h-10 lg:w-10 ${activity.iconColor}`}>
                    {activity.type === 'request' && <ClockIcon size={18} />}
                    {activity.type === 'equipment' && <PackageIcon size={18} />}
                    {activity.type === 'schedule' && <FlaskIcon size={18} />}
                    {activity.type === 'alert' && <AlertTriangleIcon size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold leading-tight text-[#374151] lg:text-base">{activity.title}</h3>
                    <p className="mt-1 break-words text-xs leading-relaxed text-[#6b7280] lg:text-sm">{activity.meta}</p>
                  </div>
                  <ArrowRightIcon />
                </button>
              ))
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm font-semibold text-[#374151]">Everything is up to date</p>
                <p className="mt-1 text-xs text-[#6b7280]">No requests, returns, or inventory issues need attention.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}