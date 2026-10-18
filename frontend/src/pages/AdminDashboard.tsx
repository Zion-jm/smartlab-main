import DashboardLoading from '../components/DashboardLoading';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { equipmentApi, borrowRequestApi, userApi, labScheduleApi, academicPeriodApi, studentAcademicApi, directoryApi } from '../services/api';
import type { BorrowRequest } from '../types/requests';
import type { ApiLabSchedule } from '../types/labSchedule';
import type { EquipmentItem } from '../types/equipment';
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
  <section className={`dashboard-section flex min-w-0 flex-col self-start rounded-2xl border border-[#e5e7eb] bg-white shadow-sm ${className}`}>
    <div className="flex items-center justify-between gap-3 border-b border-[#f1e3df] px-5 py-4">
      <h2 className="text-sm font-semibold text-[#1f2937]">{title}</h2>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
    <div className="flex-1 p-4 lg:p-5">{children}</div>
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

type DailyActivity = { dateKey: string; label: string; day: string; requests: number; schedules: number; isToday: boolean };
type RequestWorkflow = { status: BorrowRequest['status']; label: string; value: number; color: string };
type EquipmentDemand = { id: string; name: string; requested: number; available: number };
type RoomUtilization = { id: string; name: string; hours: number; sessions: number };
type DirectoryRoom = { id: string; roomNumber?: string | null; roomName?: string | null; isComputerLab?: boolean | null };

interface DashboardInsights {
  dailyActivity: DailyActivity[];
  requestWorkflow: RequestWorkflow[];
  equipmentDemand: EquipmentDemand[];
  roomUtilization: RoomUtilization[];
  unusedRooms: number;
  incompleteSchedules: number;
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

const timeDurationHours = (start: string, end: string) => {
  const toMinutes = (value: string) => {
    const [hours = 0, minutes = 0] = value.slice(11, 16).includes(':')
      ? value.slice(11, 16).split(':').map(Number)
      : value.slice(0, 5).split(':').map(Number);
    return hours * 60 + minutes;
  };
  const startMinutes = toMinutes(start);
  let endMinutes = toMinutes(end);
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;
  return Math.max(0, (endMinutes - startMinutes) / 60);
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [insights, setInsights] = useState<DashboardInsights>({ dailyActivity: [], requestWorkflow: [], equipmentDemand: [], roomUtilization: [], unusedRooms: 0, incompleteSchedules: 0 });

  const fetchStats = useCallback(async () => {
    setIsRefreshing(true);
    setDashboardError(null);

    const [equipmentResult, equipmentItemsResult, directoryResult, usersResult, requestsResult, schedulesResult, academicRecordsResult] = await Promise.allSettled([
      equipmentApi.getStats(),
      equipmentApi.getAll(),
      directoryApi.getOverview(),
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
      equipmentItemsResult.status === 'rejected' ? 'equipment catalog' : null,
      directoryResult.status === 'rejected' ? 'academic directory' : null,
      usersResult.status === 'rejected' ? 'users' : null,
      requestsResult.status === 'rejected' ? 'requests' : null,
      schedulesResult.status === 'rejected' ? 'schedules' : null,
      academicRecordsResult.status === 'rejected' ? 'student records' : null,
    ].filter(Boolean);

    if (failedSources.length > 0) {
      const limit = [equipmentResult, equipmentItemsResult, directoryResult, usersResult, requestsResult, schedulesResult, academicRecordsResult].find(result => result.status === 'rejected' && result.reason instanceof Error && /exceeds 1000|Data changed while loading/.test(result.reason.message));
      setDashboardError(limit?.status === 'rejected' ? limit.reason.message : `Some dashboard data could not be loaded (${failedSources.join(', ')}). Showing the available data.`);
    }

    const equipmentData = equipmentResult.status === 'fulfilled' ? equipmentResult.value.data : null;
    const equipmentItems = equipmentItemsResult.status === 'fulfilled' ? equipmentItemsResult.value.data as EquipmentItem[] : [];
    const directoryRooms: DirectoryRoom[] = directoryResult.status === 'fulfilled' ? directoryResult.value.data?.rooms ?? [] : [];
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

    const nextSevenDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(`${todayKey}T12:00:00+08:00`);
      date.setUTCDate(date.getUTCDate() + index);
      const dateKey = dateToDateKey(date, 'Asia/Manila');
      return {
        dateKey,
        label: date.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' }),
        day: date.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short' }),
        requests: requests.filter((request) => dateToDateKey(request.dateNeeded, 'Asia/Manila') === dateKey).length,
        schedules: schedules.filter((schedule) => scheduleOccursOn(schedule, dateKey)).length,
        isToday: index === 0,
      };
    });
    const workflowConfig: Array<Omit<RequestWorkflow, 'value'>> = [
      { status: 'PENDING', label: 'Pending', color: 'bg-[#d97706]' },
      { status: 'APPROVED', label: 'Approved', color: 'bg-[#2563eb]' },
      { status: 'BORROWED', label: 'Borrowed', color: 'bg-[#800000]' },
      { status: 'RETURNED', label: 'Returned', color: 'bg-[#15803d]' },
      { status: 'REJECTED', label: 'Declined', color: 'bg-[#b91c1c]' },
      { status: 'CANCELLED', label: 'Cancelled', color: 'bg-[#6b7280]' },
    ];
    const demandByEquipment = new Map<string, { id: string; name: string; requested: number }>();
    requests.forEach((request) => request.items?.forEach((item) => {
      const current = demandByEquipment.get(item.equipmentId) ?? { id: item.equipmentId, name: item.equipmentName, requested: 0 };
      current.requested += item.quantity;
      demandByEquipment.set(item.equipmentId, current);
    }));
    const equipmentById = new Map(equipmentItems.map((item) => [item.id, item]));
    const roomUsage = new Map<string, RoomUtilization>();
    schedules.forEach((schedule) => {
      if (!schedule.room || !weekKeys.some((dateKey) => scheduleOccursOn(schedule, dateKey))) return;
      const name = [schedule.room.roomNumber, schedule.room.name].filter(Boolean).join(' – ') || 'Unnamed room';
      const current = roomUsage.get(schedule.room.id) ?? { id: schedule.room.id, name, hours: 0, sessions: 0 };
      current.hours += timeDurationHours(schedule.timeStart, schedule.timeEnd);
      current.sessions += 1;
      roomUsage.set(schedule.room.id, current);
    });
    const computerLabUtilization = directoryRooms
      .filter((room) => room.isComputerLab)
      .map((room) => roomUsage.get(room.id) ?? {
        id: room.id,
        name: [room.roomNumber, room.roomName].filter(Boolean).join(' – ') || 'Unnamed computer lab',
        hours: 0,
        sessions: 0,
      })
      .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
    setInsights({
      dailyActivity: nextSevenDays,
      requestWorkflow: workflowConfig.map((item) => ({ ...item, value: requests.filter((request) => request.status === item.status).length })),
      equipmentDemand: Array.from(demandByEquipment.values()).sort((a, b) => b.requested - a.requested).map((item) => ({ ...item, available: equipmentById.get(item.id)?.availableQuantity ?? 0 })),
      roomUtilization: computerLabUtilization,
      unusedRooms: computerLabUtilization.filter((room) => room.hours === 0).length,
      incompleteSchedules: schedules.filter((schedule) => !schedule.room || !schedule.faculty).length,
    });

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
      ...(dashboardStats.academicRecords?.missing
        ? [{
            id: 5,
            type: 'alert' as const,
            title: `${dashboardStats.academicRecords.missing} missing student ${dashboardStats.academicRecords.missing === 1 ? 'record' : 'records'}`,
            meta: `Complete records for ${dashboardStats.academicRecords.year}`,
            iconColor: 'bg-[#fff7ed] text-[#c2410c]',
            href: `/admin/student-records?yearId=${dashboardStats.academicRecords.yearId}`,
          }]
        : []),
      ...(schedules.some((schedule) => !schedule.room || !schedule.faculty)
        ? [{
            id: 6,
            type: 'schedule' as const,
            title: `${schedules.filter((schedule) => !schedule.room || !schedule.faculty).length} incomplete ${schedules.filter((schedule) => !schedule.room || !schedule.faculty).length === 1 ? 'schedule' : 'schedules'}`,
            meta: 'Missing a room or faculty assignment',
            iconColor: 'bg-[#eff6ff] text-[#1d4ed8]',
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
        <DashboardLoading />
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
  const workloadItems = [
    { label: 'Pending requests', value: stats.requests.pending, detail: 'Awaiting review', color: 'bg-[#800000]' },
    { label: 'Upcoming reservations', value: stats.requests.upcoming, detail: 'Within the next 7 days', color: 'bg-[#d97706]' },
    { label: 'Schedules this week', value: stats.schedules.thisWeek, detail: 'One-time and weekly entries', color: 'bg-[#967348]' },
  ];
  const workloadMax = Math.max(...workloadItems.map((item) => item.value), 1);
  const activityMax = Math.max(...insights.dailyActivity.flatMap((item) => [item.requests, item.schedules]), 1);
  const workflowMax = Math.max(...insights.requestWorkflow.map((item) => item.value), 1);
  const demandMax = Math.max(...insights.equipmentDemand.map((item) => item.requested), 1);
  const roomMax = Math.max(...insights.roomUtilization.map((item) => item.hours), 1);
  const equipmentDemandRows = [
    ...insights.equipmentDemand.map((item) => ({ ...item, placeholder: false })),
    ...Array.from({ length: Math.max(0, 3 - insights.equipmentDemand.length) }, (_, index) => ({
      id: `unranked-${index}`,
      name: 'Not ranked yet',
      requested: 0,
      available: 0,
      placeholder: true,
    })),
  ];

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

        <div className="dashboard-sections grid items-start gap-4 xl:grid-cols-4">
        <Card
          className="xl:order-1 xl:col-span-3 xl:h-full xl:self-stretch"
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
          <div className="mt-5 grid gap-4 border-t border-[#f1e3df] pt-5 lg:grid-cols-[minmax(0,1fr)_290px] lg:items-stretch">
            <div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#321d1d]">Current workload</h3>
                  <p className="mt-1 text-xs text-[#786565]">Work waiting for the administration team.</p>
                </div>
                <button type="button" onClick={() => navigate('/admin/requests')} className="inline-flex items-center gap-1 text-xs font-semibold text-[#800000] hover:underline">
                  Open requests <ArrowRightIcon />
                </button>
              </div>
              <div className="space-y-3">
                {workloadItems.map((item) => (
                  <div key={item.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
                    <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-[#4b5563]">{item.label}</span>
                      <span className="hidden text-[#8b7771] sm:inline">{item.detail}</span>
                    </div>
                    <span className="row-span-2 text-sm font-bold text-[#321d1d]">{item.value}</span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#f1e8e4]">
                      <div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.max(item.value > 0 ? 8 : 0, Math.round((item.value / workloadMax) * 100))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex h-full flex-col justify-center rounded-xl border border-[#f1e3df] bg-[#faf7f5] p-4">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#800000] shadow-sm"><ClockIcon size={16} /></span>
                <div><h3 className="text-xs font-semibold text-[#321d1d]">Today’s activity</h3><p className="mt-0.5 text-[10px] text-[#8b7771]">Live operational snapshot</p></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Reservations', value: stats.requests.todayReserved },
                  { label: 'Labs today', value: stats.schedules.today },
                  { label: 'Active now', value: stats.schedules.activeNow },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-white px-2 py-3 text-center shadow-sm">
                    <p className="text-xl font-bold text-[#321d1d]">{item.value}</p>
                    <p className="mt-1 text-[10px] leading-tight text-[#786565]">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card className="xl:order-3 xl:col-span-3" title="Activity for the next 7 days" actions={<button type="button" onClick={() => navigate('/admin/reports')} className="inline-flex items-center gap-1 text-xs font-semibold text-[#800000] hover:underline lg:text-sm">Open reports <ArrowRightIcon /></button>}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#786565]">Reservations and laboratory sessions scheduled from today.</p>
            <div className="flex items-center gap-4 text-[11px] text-[#6b7280]"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#800000]"/>Requests</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#d9a441]"/>Lab sessions</span></div>
          </div>
          <div className="grid min-h-[230px] grid-cols-7 items-end gap-2 rounded-xl bg-[#fcfaf9] px-3 pb-3 pt-5 sm:gap-4">
            {insights.dailyActivity.map((item) => (
              <button key={item.dateKey} type="button" onClick={() => navigate(`/admin/schedule?date=${item.dateKey}`)} className={`group flex h-full min-w-0 flex-col justify-end rounded-lg px-1 pt-2 transition hover:bg-white hover:shadow-sm ${item.isToday ? 'bg-[#fff4f1]' : ''}`} title={`${item.requests} requests and ${item.schedules} lab sessions on ${item.label}`}>
                <div className="flex h-[150px] items-end justify-center gap-1 sm:gap-2">
                  <div className="w-3 rounded-t bg-[#800000] transition group-hover:bg-[#a00000] sm:w-5" style={{ height: `${Math.max(item.requests ? 8 : 0, (item.requests / activityMax) * 100)}%` }}><span className="sr-only">{item.requests} requests</span></div>
                  <div className="w-3 rounded-t bg-[#d9a441] transition group-hover:bg-[#c68d20] sm:w-5" style={{ height: `${Math.max(item.schedules ? 8 : 0, (item.schedules / activityMax) * 100)}%` }}><span className="sr-only">{item.schedules} schedules</span></div>
                </div>
                <span className={`mt-2 text-[10px] font-semibold sm:text-xs ${item.isToday ? 'text-[#800000]' : 'text-[#4b5563]'}`}>{item.day}</span>
                <span className="truncate text-[9px] text-[#8b7771] sm:text-[10px]">{item.label}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="xl:order-4 xl:col-span-1" title="Request workflow" actions={<button type="button" onClick={() => navigate('/admin/requests')} className="inline-flex items-center gap-1 text-xs font-semibold text-[#800000] hover:underline">View all <ArrowRightIcon /></button>}>
          <p className="mb-4 text-xs text-[#786565]">Current distribution of all request records.</p>
          <div className="space-y-3">
            {insights.requestWorkflow.map((item) => (
              <button key={item.status} type="button" onClick={() => navigate(`/admin/requests?status=${item.status}`)} className="block w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#800000]">
                <div className="mb-1 flex items-center justify-between gap-3 text-xs"><span className="font-medium text-[#4b5563]">{item.label}</span><span className="font-bold text-[#321d1d]">{item.value}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-[#f1e8e4]"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.max(item.value ? 7 : 0, (item.value / workflowMax) * 100)}%` }}/></div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="xl:order-5 xl:col-span-2 xl:h-full xl:self-stretch" title="Equipment demand" actions={<button type="button" onClick={() => navigate('/admin/reports?reportTab=equipment')} className="inline-flex items-center gap-1 text-xs font-semibold text-[#800000] hover:underline">Analyze <ArrowRightIcon /></button>}>
          <p className="mb-4 text-xs text-[#786565]">Most requested equipment across recorded borrowing requests.</p>
          <div className="max-h-[174px] space-y-2 overflow-y-auto pr-1">{equipmentDemandRows.map((item, index) => item.placeholder ? (
            <div key={item.id} className="grid min-h-[50px] grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-dashed border-[#e5d9d5] bg-[#fcfaf9] p-2">
              <span className="text-xs font-bold text-[#b49c96]">{index + 1}</span>
              <span className="min-w-0"><span className="block text-xs font-semibold text-[#8b7771]">Not ranked yet</span><span className="mt-1 block text-[10px] text-[#a59490]">Waiting for another equipment request</span></span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-bold text-[#b49c96]">?</span>
            </div>
          ) : (
            <button key={item.id} type="button" onClick={() => navigate(`/admin/equipment?search=${encodeURIComponent(item.name)}`)} className="grid min-h-[50px] w-full grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg p-2 text-left transition hover:bg-[#fcf7f5]">
              <span className="text-xs font-bold text-[#9a7770]">{index + 1}</span>
              <span className="min-w-0"><span className="flex justify-between gap-3 text-xs"><span className="truncate font-semibold text-[#321d1d]">{item.name}</span><span className="text-[#6b7280]">{item.requested} requested</span></span><span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-[#f1e8e4]"><span className="block h-full rounded-full bg-gradient-to-r from-[#800000] to-[#c25c45]" style={{ width: `${(item.requested / demandMax) * 100}%` }}/></span></span>
              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${item.available <= 1 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{item.available} available</span>
            </button>
          ))}</div>
        </Card>

        <Card className="xl:order-6 xl:col-span-2 xl:h-full xl:self-stretch" title="Room utilization this week" actions={<button type="button" onClick={() => navigate('/admin/schedule')} className="inline-flex items-center gap-1 text-xs font-semibold text-[#800000] hover:underline">View schedule <ArrowRightIcon /></button>}>
          <div className="mb-4 flex items-center justify-between gap-3"><p className="text-xs text-[#786565]">Busiest rooms based on scheduled hours.</p><span className="rounded-full bg-[#faf4f1] px-2.5 py-1 text-[10px] font-semibold text-[#800000]">{insights.unusedRooms} unused</span></div>
          {insights.roomUtilization.length ? <div className="max-h-[174px] space-y-2 overflow-y-auto pr-1">{insights.roomUtilization.map((item) => (
            <button key={item.id} type="button" onClick={() => navigate(`/admin/schedule?roomId=${item.id}`)} className="grid min-h-[50px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-lg p-2 text-left transition hover:bg-[#fcf7f5]">
              <span className="truncate text-xs font-semibold text-[#321d1d]">{item.name}</span><span className="text-xs font-bold text-[#800000]">{item.hours.toFixed(item.hours % 1 ? 1 : 0)}h</span>
              <span className="h-2 overflow-hidden rounded-full bg-[#f1e8e4]"><span className="block h-full rounded-full bg-[#967348]" style={{ width: `${(item.hours / roomMax) * 100}%` }}/></span><span className="text-[10px] text-[#8b7771]">{item.sessions ? `${item.sessions} ${item.sessions === 1 ? 'entry' : 'entries'}` : 'No schedules'}</span>
            </button>
          ))}</div> : <p className="py-10 text-center text-xs text-[#9ca3af]">No room schedules this week.</p>}
        </Card>

        {stats.academicRecords && <Card className="xl:order-8 xl:col-span-2" title="Student records requiring attention" actions={<button type="button" onClick={()=>navigate(`/admin/student-records?yearId=${stats.academicRecords!.yearId}`)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#800000] hover:underline lg:text-sm">Review <ArrowRightIcon /></button>}>
          <div className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 ${stats.academicRecords.missing||stats.academicRecords.graduationReview?'border-amber-200 bg-amber-50':'border-green-200 bg-green-50'}`}>
            <div><p className="text-sm font-semibold text-[#321d1d]">{stats.academicRecords.year}</p><p className="mt-1 text-xs text-[#786565]">{stats.academicRecords.missing ? `${stats.academicRecords.missing} active ${stats.academicRecords.missing===1?'student has':'students have'} no record for the current year.` : 'Every active student has a current-year record.'}</p></div>
            <div className="academic-record-summary-metrics grid w-full grid-cols-3 gap-3">
              <div><p className="text-2xl font-bold text-[#321d1d]">{stats.academicRecords.configured}</p><p className="text-[11px] text-[#786565]">Configured</p></div>
              <div><p className={`text-2xl font-bold ${stats.academicRecords.missing?'text-amber-800':'text-green-700'}`}>{stats.academicRecords.missing}</p><p className="text-[11px] text-[#786565]">Missing</p></div>
              <div><p className="text-2xl font-bold text-[#321d1d]">{stats.academicRecords.graduationReview}</p><p className="text-[11px] text-[#786565]">Year 4 review</p></div>
            </div>
          </div>
        </Card>}

        

        <Card className={`${stats.academicRecords ? 'xl:col-span-2 xl:row-span-2 xl:h-full xl:self-stretch' : 'xl:col-span-3'} xl:order-7`} title="Equipment status">
          <div className="grid h-full gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
            <div className="flex flex-col items-center justify-center rounded-2xl bg-[#fffaf7] p-5">
              <div className="relative flex h-36 w-36 items-center justify-center rounded-full" style={{background:`conic-gradient(#800000 0 ${utilization}%, #eadfd9 ${utilization}% 100%)`}}>
                <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white shadow-inner"><span className="text-2xl font-bold text-[#321d1d]">{utilization}%</span><span className="text-[10px] uppercase tracking-wide text-[#786565]">Utilized</span></div>
              </div>
              <p className="mt-3 text-xs text-[#786565]">{inventoryTotal} total units across {stats.equipment.uniqueItems} catalog items</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                {label:'Available',value:stats.equipment.availableQuantity,detail:'Ready for use',tone:'border-green-200 bg-green-50 text-green-800'},
                {label:'Borrowed',value:stats.equipment.borrowedQuantity,detail:'Currently in use',tone:'border-amber-200 bg-amber-50 text-amber-900'},
                {label:'Damaged',value:stats.equipment.damagedQuantity,detail:'Needs inspection',tone:'border-red-200 bg-red-50 text-red-800'},
                {label:'Archived',value:stats.equipment.archivedQuantity,detail:`${stats.equipment.lowStockCount} low-stock items`,tone:'border-[#ead7d3] bg-[#faf7f5] text-[#57322d]'},
              ].map(item=><div key={item.label} className={`rounded-xl border p-4 ${item.tone}`}><p className="text-xs font-semibold">{item.label}</p><p className="mt-2 text-2xl font-bold">{item.value}</p><p className="mt-1 text-[11px] opacity-80">{item.detail}</p></div>)}
            </div>
          </div>
        </Card>
        <Card className="xl:order-10 xl:col-span-4" title="Operations at a glance">
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

        

        <Card className="xl:order-2 xl:col-span-1 xl:h-full xl:self-stretch" title="Quick actions">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {quickActions.map(({ label, detail, icon: Icon, primary, href }) => (
              <button
                key={label}
                type="button"
                onClick={() => navigate(href)}
                className={`group flex min-h-[66px] items-center gap-3 rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${primary?'border-[#800000] bg-[#800000] text-white':'border-[#e5e7eb] bg-white text-[#321d1d] hover:border-[#d8b4ad] hover:bg-[#fffaf8]'}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${primary?'bg-white/15':'bg-[#f7eeea] text-[#800000]'}`}><Icon size={18}/></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{label}</span><span className={`mt-1 block text-xs ${primary?'text-[#f2d9d3]':'text-[#786565]'}`}>{detail}</span></span>
                <span className={primary?'text-white/70':'text-[#c8aaa2]'}><ArrowRightIcon/></span>
              </button>
            ))}
          </div>
        </Card>

        

        <Card
          className={`xl:order-9 ${stats.academicRecords ? 'xl:col-span-2' : 'xl:col-span-1'}`}
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
