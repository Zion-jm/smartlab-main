import { YEAR_LEVEL_NUMBERS } from '../../../constants/yearLevels';
import type { EquipmentItem, EquipmentStatus } from '../../../types/equipment';
import type { ApiLabSchedule } from '../../../types/labSchedule';
import type { BorrowRequest, BorrowRequestStatus } from '../../../types/requests';
import { dateToDateKey, formatTimeRange } from '../../../utils/dateTime';



export type DateRange = {
  from: string;
  to: string;
};

export type ReportCatalog = {
  rooms: string[];
  programs: string[];
  yearLevels: number[];
};

export const reportableStatuses = new Set<BorrowRequestStatus>([
  'PENDING',
  'APPROVED',
  'BORROWED',
  'RETURNED',
]);

export const reportYearLevels = new Set(YEAR_LEVEL_NUMBERS);

export const statusLabels: Record<BorrowRequestStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  BORROWED: 'Borrowed',
  RETURNED: 'Returned',
  REJECTED: 'Declined',
  CANCELLED: 'Cancelled',
};

export const equipmentStatusLabels: Record<EquipmentStatus, string> = {
  AVAILABLE: 'Available',
  BORROWED: 'Borrowed',
  DAMAGED: 'Damaged',
  UNAVAILABLE: 'Unavailable',
};

export const equipmentReportStatusOrder: BorrowRequestStatus[] = [
  'PENDING',
  'APPROVED',
  'BORROWED',
  'RETURNED',
  'REJECTED',
  'CANCELLED',
];

export const localDateKey = dateToDateKey;

export const formatDate = (value: string | null | undefined) => {
  const dateKey = localDateKey(value);
  if (!dateKey) return '—';
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const inDateRange = (value: string | null | undefined, range: DateRange) => {
  const date = localDateKey(value);
  return Boolean(date) && (!range.from || date >= range.from) && (!range.to || date <= range.to);
};

export const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const downloadCsv = (filename: string, headers: string[], rows: unknown[][]) => {
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const formatSectionLabel = (program: string | null | undefined, yearLevel: number | null | undefined) =>
  [program?.trim(), yearLevel != null ? String(yearLevel) : ''].filter(Boolean).join(' - ') || 'Unassigned section';

export const formatPeriodLabel = ({ from, to }: DateRange) => {
  if (!from && !to) return 'All recorded dates';
  return `${from ? formatDate(from) : 'Beginning'} – ${to ? formatDate(to) : 'Present'}`;
};

export type SectionDemandRow = {
  section: string;
  requests: number;
  units: number;
  topEquipment?: string;
};

export const getRequestUnits = (request: BorrowRequest) =>
  (request.items ?? []).reduce((total, item) => total + item.quantity, 0);

export type RequestPrintRow = {
  id: string;
  date: string;
  room: string;
  equipment: string;
  requester: string;
  programYear: string;
  faculty: string;
  time: string;
  status: string;
  subject: string;
};

export const buildRequestPrintRows = (requests: BorrowRequest[]): RequestPrintRow[] =>
  requests.map((request) => ({
    id: request.id,
    date: formatDate(request.dateNeeded),
    room: request.location ?? '',
    equipment: request.equipmentList ?? '',
    requester: request.requesterName,
    programYear: formatSectionLabel(request.programCode ?? request.program, request.yearLevel),
    faculty: request.facultyName ?? '',
    time: formatTimeRange(request.timeStart, request.timeEnd),
    status: statusLabels[request.status],
    subject: request.subject ?? '',
  }));

export const buildSectionDemand = (
  requests: BorrowRequest[],
  includeEquipment = false,
  sortBy: 'units' | 'requests' = 'units'
): SectionDemandRow[] => {
  const grouped = new Map<
    string,
    { requests: number; units: number; equipment: Map<string, number> }
  >();

  requests.forEach((request) => {
    const section = formatSectionLabel(request.programCode ?? request.program, request.yearLevel);
    const current = grouped.get(section) ?? { requests: 0, units: 0, equipment: new Map() };
    current.requests += 1;
    current.units += getRequestUnits(request);
    if (includeEquipment) {
      (request.items ?? []).forEach((item) => {
        current.equipment.set(item.equipmentName, (current.equipment.get(item.equipmentName) ?? 0) + item.quantity);
      });
    }
    grouped.set(section, current);
  });

  return Array.from(grouped.entries())
    .map(([section, value]) => ({
      section,
      requests: value.requests,
      units: value.units,
      topEquipment: includeEquipment
        ? Array.from(value.equipment.entries()).sort((first, second) => second[1] - first[1])[0]?.[0]
        : undefined,
    }))
    .sort((first, second) =>
      sortBy === 'requests'
        ? second.requests - first.requests || second.units - first.units
        : second.units - first.units || second.requests - first.requests
    );
};

export type DemandGroupBy = 'faculty' | 'submittedBy' | 'program' | 'subject' | 'room';

export type DemandSourceFilter = 'ALL' | 'STUDENT' | 'FACULTY';

export type DemandRoomFilter = 'ALL' | 'COMPUTER_LAB' | 'OTHER';

export type DemandStatusScope = 'ACTIVE' | 'ALL';

export type DemandSortBy = 'requests' | 'units';

export type DemandRow = {
  key: string;
  label: string;
  detail: string;
  requests: number;
  units: number;
  studentSubmitted: number;
  facultySubmitted: number;
  topEquipment?: {
    name: string;
    requests: number;
  };
};

export const demandGroupLabels: Record<DemandGroupBy, string> = {
  faculty: 'Faculty in charge',
  submittedBy: 'Submitted by',
  program: 'Section',
  subject: 'Subject',
  room: 'Requested room',
};

export const demandGroupDescriptions: Record<DemandGroupBy, string> = {
  faculty: 'Requests grouped by the supervising professor, regardless of who submitted the form.',
  submittedBy: 'Requests grouped by the account that submitted the form.',
  program: 'Requests grouped by the program and year level attached to the request.',
  subject: 'Requests grouped by the subject selected in the request.',
  room: 'Requested room demand only; unassigned and general locations are shown separately from room records.',
};

export const demandSourceLabels: Record<DemandSourceFilter, string> = {
  ALL: 'All request sources',
  STUDENT: 'Student-submitted',
  FACULTY: 'Faculty-submitted',
};

export const demandRoomLabels: Record<DemandRoomFilter, string> = {
  ALL: 'All room types',
  COMPUTER_LAB: 'Computer labs only',
  OTHER: 'Other rooms / unassigned',
};

export const demandStatusScopeLabels: Record<DemandStatusScope, string> = {
  ACTIVE: 'Active borrowing demand',
  ALL: 'All request activity',
};

export const getDemandGroup = (request: BorrowRequest, groupBy: DemandGroupBy) => {
  if (groupBy === 'faculty') {
    return {
      key: request.facultyId ? `faculty:${request.facultyId}` : 'faculty:unassigned',
      label: request.facultyName?.trim() || 'Unassigned faculty',
      detail: 'Faculty in charge',
    };
  }

  if (groupBy === 'submittedBy') {
    return {
      key: request.requesterId
        ? `requester:${request.requesterId}`
        : `requester:${request.requesterRole}:${request.requesterName.trim()}`,
      label: request.requesterName.trim() || 'Unnamed submitter',
      detail: request.requesterRole === 'FACULTY' ? 'Faculty account' : 'Student account',
    };
  }

  if (groupBy === 'program') {
    const yearKey = request.yearLevel != null ? String(request.yearLevel) : 'unassigned';
    return {
      key: request.programId
        ? `program:${request.programId}:year:${yearKey}`
        : `program:${formatSectionLabel(request.programCode ?? request.program, request.yearLevel)}`,
      label: formatSectionLabel(request.programCode ?? request.program, request.yearLevel),
      detail: 'Section',
    };
  }

  if (groupBy === 'room') {
    const location = request.location?.trim();
    return {
      key: request.roomId ? `room:${request.roomId}` : `location:${location || 'unassigned'}`,
      label: request.roomId
        ? location || 'Unnamed room'
        : location
          ? `General location: ${location}`
          : 'Room not assigned',
      detail: request.roomId ? 'Requested room' : 'No room record linked',
    };
  }

  return {
    key: request.subjectId ? `subject:${request.subjectId}` : `subject:${request.subject || 'unassigned'}`,
    label: request.subject?.trim() || 'Unassigned subject',
    detail: 'Subject',
  };
};

export const buildDemandRows = (
  requests: BorrowRequest[],
  groupBy: DemandGroupBy,
  sortBy: DemandSortBy = 'requests',
  includeTopEquipment = false
): DemandRow[] => {
  const grouped = new Map<
    string,
    {
      label: string;
      detail: string;
      requests: number;
      units: number;
      studentSubmitted: number;
      facultySubmitted: number;
      equipmentRequests: Map<string, { name: string; requests: number }>;
    }
  >();

  requests.forEach((request) => {
    const group = getDemandGroup(request, groupBy);
    const current = grouped.get(group.key) ?? {
      label: group.label,
      detail: group.detail,
      requests: 0,
      units: 0,
      studentSubmitted: 0,
      facultySubmitted: 0,
      equipmentRequests: new Map(),
    };
    current.requests += 1;
    current.units += getRequestUnits(request);
    if (request.requesterRole === 'FACULTY') current.facultySubmitted += 1;
    else if (request.requesterRole === 'STUDENT') current.studentSubmitted += 1;
    if (includeTopEquipment) {
      const equipmentInRequest = new Map<string, string>();
      (request.items ?? []).forEach((item) => {
        const name = item.equipmentName?.trim() || 'Unnamed equipment';
        equipmentInRequest.set(item.equipmentId || `name:${name.toLowerCase()}`, name);
      });
      equipmentInRequest.forEach((name, equipmentKey) => {
        const equipment = current.equipmentRequests.get(equipmentKey) ?? { name, requests: 0 };
        equipment.requests += 1;
        current.equipmentRequests.set(equipmentKey, equipment);
      });
    }
    grouped.set(group.key, current);
  });

  return Array.from(grouped.entries())
    .map(([key, value]) => {
      const topEquipment = includeTopEquipment
        ? Array.from(value.equipmentRequests.values()).sort(
            (first, second) => second.requests - first.requests || first.name.localeCompare(second.name)
          )[0]
        : undefined;
      return {
        key,
        label: value.label,
        detail: value.detail,
        requests: value.requests,
        units: value.units,
        studentSubmitted: value.studentSubmitted,
        facultySubmitted: value.facultySubmitted,
        topEquipment,
      };
    })
    .sort((first, second) => {
      const primaryDifference =
        sortBy === 'requests'
          ? second.requests - first.requests
          : second.units - first.units;
      const secondaryDifference =
        sortBy === 'requests'
          ? second.units - first.units
          : second.requests - first.requests;
      return primaryDifference || secondaryDifference || first.label.localeCompare(second.label);
    });
};

export const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const scheduleRoom = (schedule: ApiLabSchedule) => schedule.room?.name || schedule.room?.roomNumber || 'Unassigned room';

export const scheduleFaculty = (schedule: ApiLabSchedule) =>
  `${schedule.faculty?.user?.firstName ?? ''} ${schedule.faculty?.user?.lastName ?? ''}`.trim() || 'Faculty not assigned';

export const scheduleSubject = (schedule: ApiLabSchedule) => schedule.subject?.name || schedule.subject?.code || 'Untitled subject';

export const scheduleProgram = (schedule: ApiLabSchedule) => schedule.program?.name || schedule.program?.code || '—';

export const scheduleDay = (schedule: ApiLabSchedule) =>
  typeof schedule.dayOfWeek === 'number' && dayNames[schedule.dayOfWeek] ? dayNames[schedule.dayOfWeek] : 'Weekly';

export type SchedulePrintRow = {
  dayDate: string;
  room: string;
  subject: string;
  faculty: string;
  section: string;
  time: string;
  type: string;
};

export const buildSchedulePrintRows = (schedules: ApiLabSchedule[]): SchedulePrintRow[] =>
  schedules.map((schedule) => ({
    dayDate: schedule.scheduleType === 'WEEKLY' ? `Every ${scheduleDay(schedule)}` : formatDate(schedule.scheduleDate),
    room: scheduleRoom(schedule),
    subject: scheduleSubject(schedule),
    faculty: scheduleFaculty(schedule),
    section: formatSectionLabel(schedule.program?.code ?? schedule.program?.name, schedule.yearLevel),
    time: formatTimeRange(schedule.timeStart, schedule.timeEnd),
    type: schedule.scheduleType === 'WEEKLY' ? 'Recurring' : 'One-time',
  }));

export type ScheduleDemandRow = {
  key: string;
  section: string;
  entries: number;
  rooms: number;
  recurring: number;
};

export type ScheduleDemandGroupBy = 'program' | 'subject' | 'room' | 'faculty';

export type ScheduleDemandSortBy = 'entries' | 'rooms';

export const scheduleDemandGroupLabels: Record<ScheduleDemandGroupBy, string> = {
  program: 'Section',
  subject: 'Subject',
  room: 'Room',
  faculty: 'Faculty-in-charge',
};

export const scheduleDemandGroupDescriptions: Record<ScheduleDemandGroupBy, string> = {
  program: 'Schedules grouped by the program and year level assigned to the class.',
  subject: 'Schedules grouped by the subject being taught.',
  room: 'Schedules grouped by the room where the class is held.',
  faculty: 'Schedules grouped by the faculty member assigned to the class.',
};

export const getScheduleDemandGroup = (schedule: ApiLabSchedule, groupBy: ScheduleDemandGroupBy) => {
  if (groupBy === 'program') {
    return formatSectionLabel(schedule.program?.code ?? schedule.program?.name, schedule.yearLevel);
  }
  if (groupBy === 'subject') return scheduleSubject(schedule);
  if (groupBy === 'room') return scheduleRoom(schedule);
  return scheduleFaculty(schedule);
};

export const buildScheduleDemandRows = (
  schedules: ApiLabSchedule[],
  groupBy: ScheduleDemandGroupBy,
  sortBy: ScheduleDemandSortBy = 'entries'
): ScheduleDemandRow[] => {
  const grouped = new Map<string, { entries: number; rooms: Set<string>; recurring: number }>();

  schedules.forEach((schedule) => {
    const section = getScheduleDemandGroup(schedule, groupBy);
    const current = grouped.get(section) ?? { entries: 0, rooms: new Set<string>(), recurring: 0 };
    current.entries += 1;
    current.rooms.add(scheduleRoom(schedule));
    if (schedule.scheduleType === 'WEEKLY') current.recurring += 1;
    grouped.set(section, current);
  });

  return Array.from(grouped.entries())
    .map(([section, value]) => ({
      key: `${groupBy}:${section}`,
      section,
      entries: value.entries,
      rooms: value.rooms.size,
      recurring: value.recurring,
    }))
    .sort((first, second) =>
      (sortBy === 'entries' ? second.entries - first.entries : second.rooms - first.rooms) ||
      second.entries - first.entries ||
      first.section.localeCompare(second.section)
    );
};

export type EquipmentUsage = {
  timesRequested: number;
  unitsRequested: number;
  unitsReturned: number;
  statusCounts: Record<BorrowRequestStatus, { requests: number; units: number }>;
};

export type EquipmentOverviewRow = {
  key: string;
  name: string;
  primary: number;
  primaryLabel: string;
  detail: string;
  secondary: string;
  statusCounts?: Record<BorrowRequestStatus, { requests: number; units: number }>;
};

export type EquipmentPrintRow = {
  equipment: string;
  status: string;
  totalQuantity: number;
  availableQuantity: number;
  borrowedQuantity: number;
  damagedQuantity: number;
  timesRequested: number;
  unitsRequested: number;
  unitsReturned: number;
  unreturned: number;
};

export type EquipmentAnalysisPrintRow = {
  rank: number;
  equipment: string;
  primary: string;
  detail: string;
  secondary: string;
  statusBreakdown: string;
};

export const createEquipmentUsage = (): EquipmentUsage => ({
  timesRequested: 0,
  unitsRequested: 0,
  unitsReturned: 0,
  statusCounts: Object.fromEntries(
    equipmentReportStatusOrder.map((status) => [status, { requests: 0, units: 0 }])
  ) as Record<BorrowRequestStatus, { requests: number; units: number }>,
});

export const toEquipmentPrintRow = ({
  item,
  usage,
}: {
  item: EquipmentItem;
  usage: EquipmentUsage;
}): EquipmentPrintRow => ({
  equipment: item.name,
  status: equipmentStatusLabels[item.status] ?? 'Unknown',
  totalQuantity: item.totalQuantity,
  availableQuantity: item.availableQuantity,
  borrowedQuantity: item.borrowedQuantity,
  damagedQuantity: item.damagedQuantity,
  timesRequested: usage.timesRequested,
  unitsRequested: usage.unitsRequested,
  unitsReturned: usage.unitsReturned,
  unreturned: Math.max(usage.unitsRequested - usage.unitsReturned, 0),
});
