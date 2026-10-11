import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { equipmentApi, borrowRequestApi, userApi, labScheduleApi, academicPeriodApi, studentAcademicApi } from '../services/api';
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
  <div className="dashboard-stat group relative min-w-0 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-[#d8c7c3] hover:shadow-[0_8px_20px_rgba(76,37,24,0.08)]">
    <div className={`absolute inset-x-0 top-0 h-1 ${iconGradient}`} />
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">{title}</h4>
        <p className={`mt-2 text-2xl font-bold tracking-tight ${isRed ? 'text-[#b91c1c]' : 'text-[#1f2937]'}`}>{value}</p>
      </div>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#faf4f1] text-[#800000] transition group-hover:bg-[#800000] group-hover:text-white">
        <Icon size={18} />
      </div>
    </div>
  </div>
);

const Card = ({ title, actions, children, className = '' }: { title: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) => (
  <section className={`dashboard-section rounded-2xl border border-[#e5e7eb] bg-white shadow-sm ${className}`}>
    <div className="flex items-center justify-between gap-3 border-b border-[#f1e3df] px-5 py-4">
      <h2 className="text-sm font-semibold text-[#1f2937]">{title}</h2>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
    <div className="p-4 lg:p-5">{children}</div>
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
  academicRecords: {
    yearId: string;
    year: string;
    activeStudents: number;
    configured: number;
    missing: number;
    graduationReview: number;
  } | null;
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

    const [equipmentResult, usersResult, requestsResult, schedulesResult, academicRecordsResult] = await Promise.allSettled([
      equipmentApi.getStats(),
      userApi.getAll(),
      borrowRequestApi.getAll({ status: 'ALL', sort: 'date-desc' }),
      labScheduleApi.getAll(),
      academicPeriodApi.get().then(async ({data}) => {
        const current = data?.current?.academicYear;
        if (!current) return null;
        const summary = await studentAcademicApi.summary({ academicYearId: current.id });
        return { yearId: current.id, year: current.year, ...summary.data };
      }),
    ]);

    const failedSources = [
      equipmentResult.status === 'rejected' ? 'equipment' : null,
      usersResult.status === 'rejected' ? 'users' : null,
      requestsResult.status === 'rejected' ? 'requests' : null,
      schedulesResult.status === 'rejected' ? 'schedules' : null,
      academicRecordsResult.status === 'rejected' ? 'student records' : null,
    ].filter(Boolean);

    if (failedSources.length > 0) {
      const limit = [equipmentResult, usersResult, requestsResult, schedulesResult, academicRecordsResult].find(result => result.status === 'rejected' && result.reason instanceof Error && /exceeds 1000|Data changed while loading/.test(result.reason.message));
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
      academicRecords: academicRecordsResult.status === 'fulfilled' ? academicRecordsResult.value : null,
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
    { label: 'Review requests', detail: `${stats.requests.pending} pending`, icon: ClockIcon, primary: true, href: '/admin/requests?status=PENDING' },
    { label: 'Add new user', detail: 'Create an account', icon: UserPlusIcon, primary: false, href: '/admin/users?new=1' },
    { label: 'Lab schedule', detail: `${stats.schedules.thisWeek} this week`, icon: CalendarPlusIcon, primary: false, href: '/admin/schedule' },
    { label: 'Manage equipment', detail: `${stats.equipment.availableQuantity} units available`, icon: WrenchIcon, primary: false, href: '/admin/equipment' },
  ];
  const inventoryTotal = Math.max(stats.equipment.totalQuantity, 0);
  const utilization = Math.min(100, Math.max(0, stats.equipment.utilizationRate));
  const attentionTotal = stats.requests.pending + stats.requests.overdue + stats.equipment.lowStockCount + (stats.academicRecords?.missing ?? 0);

  return (
    <AdminLayout>
      <div className="dashboard-workspace mx-auto responsive-workspace space-y-4 p-2 lg:p-3">
        <header className="mb-4 overflow-hidden rounded-2xl border border-[#6d1010] bg-gradient-to-br from-[#800000] via-[#6d1010] to-[#3d1111] text-white shadow-[0_12px_30px_rgba(76,17,17,0.18)]">
          <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#efd0bc]">SmartLab command center</p>
                <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-[#f8e9e2]">{attentionTotal} items need attention</span>
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Good day, Administrator</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#f1dddd]">Monitor today’s laboratory activity, resolve pending work, and keep academic records ready.</p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => navigate('/admin/requests?status=PENDING')} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-[#800000] shadow-sm transition hover:bg-[#fff7f4]"><ClockIcon size={16}/>Review {stats.requests.pending} pending requests</button>
                <span className="text-xs text-[#f1dddd]">{new Date().toLocaleDateString('en-US', {timeZone:'Asia/Manila',weekday:'long',month:'long',day:'numeric',year:'numeric'})}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 xl:min-w-[390px]">
              {[{label:'Overdue',value:stats.requests.overdue},{label:'Active labs',value:stats.schedules.activeNow},{label:'Low stock',value:stats.equipment.lowStockCount}].map(item=><div key={item.label} className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm"><p className="text-[10px] uppercase tracking-wide text-[#e8cfc8]">{item.label}</p><p className="mt-1 text-2xl font-bold">{item.value}</p></div>)}
            </div>
          </div>
        </header>
        {dashboardError && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f6e8b1] bg-[#fffdf5] px-4 py-3 text-sm text-[#92400e]">
            <span>{dashboardError}</span>
            <button type="button" onClick={() => void fetchStats()} className="font-semibold underline">
              Try again
            </button>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-4 xl:items-start">
        <Card
          className="xl:order-1 xl:col-span-3"
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
            <StatsCard icon={UsersIcon} iconGradient="bg-[#800000]" title="Total users" value={stats.users.total} />
            <StatsCard icon={GraduationCapIcon} iconGradient="bg-[#a15c45]" title="Students" value={stats.users.students} />
            <StatsCard icon={TeacherIcon} iconGradient="bg-[#967348]" title="Faculty" value={stats.users.faculty} />
            <StatsCard icon={ClockIcon} iconGradient="bg-[#d97706]" title="Pending requests" value={stats.requests.pending} isRed={stats.requests.pending > 0} />
            <StatsCard icon={AlertTriangleIcon} iconGradient="bg-[#b91c1c]" title="Overdue returns" value={stats.requests.overdue} isRed={stats.requests.overdue > 0} />
            <StatsCard icon={PackageIcon} iconGradient="bg-[#15803d]" title="Equipment utilization" value={`${stats.equipment.utilizationRate}%`} />
          </div>
        </Card>

        {stats.academicRecords && <Card className="xl:order-4 xl:col-span-1" title="Student records requiring attention" actions={<button type="button" onClick={()=>navigate(`/admin/student-records?yearId=${stats.academicRecords!.yearId}`)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#800000] hover:underline lg:text-sm">Review <ArrowRightIcon /></button>}>
          <div className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 ${stats.academicRecords.missing||stats.academicRecords.graduationReview?'border-amber-200 bg-amber-50':'border-green-200 bg-green-50'}`}>
            <div><p className="text-sm font-semibold text-[#321d1d]">{stats.academicRecords.year}</p><p className="mt-1 text-xs text-[#786565]">{stats.academicRecords.missing ? `${stats.academicRecords.missing} active ${stats.academicRecords.missing===1?'student has':'students have'} no record for the current year.` : 'Every active student has a current-year record.'}</p></div>
            <div className="flex gap-6"><div><p className="text-2xl font-bold text-[#321d1d]">{stats.academicRecords.configured}</p><p className="text-[11px] text-[#786565]">Configured</p></div><div><p className={`text-2xl font-bold ${stats.academicRecords.missing?'text-amber-800':'text-green-700'}`}>{stats.academicRecords.missing}</p><p className="text-[11px] text-[#786565]">Missing</p></div><div><p className="text-2xl font-bold text-[#321d1d]">{stats.academicRecords.graduationReview}</p><p className="text-[11px] text-[#786565]">Year 4 review</p></div></div>
          </div>
        </Card>}

        

        <Card className="xl:order-3 xl:col-span-3" title="Equipment status">
          <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
            <div className="flex flex-col items-center justify-center rounded-2xl bg-[#fffaf7] p-5">
              <div className="relative flex h-36 w-36 items-center justify-center rounded-full" style={{background:`conic-gradient(#800000 0 ${utilization}%, #eadfd9 ${utilization}% 100%)`}}>
                <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white shadow-inner"><span className="text-2xl font-bold text-[#321d1d]">{utilization}%</span><span className="text-[10px] uppercase tracking-wide text-[#786565]">Utilized</span></div>
              </div>
              <p className="mt-3 text-xs text-[#786565]">{inventoryTotal} total units across {stats.equipment.uniqueItems} catalog items</p>
            </div>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                {label:'Available',value:stats.equipment.availableQuantity,detail:'Ready for use',tone:'border-green-200 bg-green-50 text-green-800'},
                {label:'Borrowed',value:stats.equipment.borrowedQuantity,detail:'Currently in use',tone:'border-amber-200 bg-amber-50 text-amber-900'},
                {label:'Damaged',value:stats.equipment.damagedQuantity,detail:'Needs inspection',tone:'border-red-200 bg-red-50 text-red-800'},
                {label:'Archived',value:stats.equipment.archivedQuantity,detail:`${stats.equipment.lowStockCount} low-stock items`,tone:'border-[#ead7d3] bg-[#faf7f5] text-[#57322d]'},
              ].map(item=><div key={item.label} className={`rounded-xl border p-4 ${item.tone}`}><p className="text-xs font-semibold">{item.label}</p><p className="mt-2 text-2xl font-bold">{item.value}</p><p className="mt-1 text-[11px] opacity-80">{item.detail}</p></div>)}
            </div>
          </div>
        </Card>
        <Card className="xl:order-5 xl:col-span-3" title="Operations at a glance">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
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
                className="group rounded-xl border border-[#e5e7eb] bg-[#fcfcfd] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#d9b1b1] hover:bg-[#fff8f8] hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2"><span className="text-[#800000]"><Icon size={18}/></span><span className="text-[#c8aaa2] transition group-hover:translate-x-0.5 group-hover:text-[#800000]"><ArrowRightIcon/></span></div>
                <p className="mt-3 text-xs font-semibold text-[#6b7280]">{label}</p>
                <p className="mt-1 text-2xl font-bold text-[#1f2937]">{value}</p>
                <p className="mt-1 text-[11px] text-[#786565]">{detail}</p>
              </button>
            ))}
          </div>
        </Card>

        

        <Card className="xl:order-2 xl:col-span-1" title="Quick actions">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {quickActions.map(({ label, detail, icon: Icon, primary, href }) => (
              <button
                key={label}
                type="button"
                onClick={() => navigate(href)}
                className={`group flex min-h-[76px] items-center gap-3 rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${primary?'border-[#800000] bg-[#800000] text-white':'border-[#e5e7eb] bg-white text-[#321d1d] hover:border-[#d8b4ad] hover:bg-[#fffaf8]'}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${primary?'bg-white/15':'bg-[#f7eeea] text-[#800000]'}`}><Icon size={18}/></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{label}</span><span className={`mt-1 block text-xs ${primary?'text-[#f2d9d3]':'text-[#786565]'}`}>{detail}</span></span>
                <span className={primary?'text-white/70':'text-[#c8aaa2]'}><ArrowRightIcon/></span>
              </button>
            ))}
          </div>
        </Card>

        

        <Card
          className="xl:order-6 xl:col-span-1"
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
      </div>
    </AdminLayout>
  );
}
