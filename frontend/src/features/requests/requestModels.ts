import type { EquipmentItem } from '../../types/equipment';
import type { BorrowRequestStatus } from '../../types/requests';
import { dateToDateKey } from '../../utils/dateTime';

export const timeOptions: { value: string; label: string }[] = (() => {
  const options: { value: string; label: string }[] = [];
  for (let hour = 7; hour <= 21; hour++) {
    const startMinute = hour === 7 ? 30 : 0;
    for (let minute = startMinute; minute < 60; minute += 30) {
      const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const ampm = hour < 12 ? 'AM' : 'PM';
      const label = `${h.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${ampm}`;
      const value = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      options.push({ value, label });
    }
  }
  return options;
})();

export type SelectOption = {
  value: string;
  label: string;
  isComputerLab?: boolean;
};

export type FacultySelectOption = SelectOption & {
  userId?: string;
};

export type RequestResources = {
  studentAcademic?: { managed: boolean; record: { programId: string; yearLevel: number | null; status: string } | null };
  rooms: SelectOption[];
  programs: SelectOption[];
  subjects: SelectOption[];
  faculty: FacultySelectOption[];
  equipment: EquipmentItem[];
  selfFacultyProfileId: string | null;
};

export type RequestRow = {
  id: string;
  reference: string;
  filed: string;
  room: string;
  equipment: string;
  dateOfUse: string;
  time: string;
  note: string;
  status: BorrowRequestStatus;
  source: ApiBorrowRequest;
};

export type ApiBorrowRequestItem = {
  id: string;
  equipmentId: string;
  quantity: number;
  equipment?: {
    id: string;
    name?: string | null;
  } | null;
};

export type ApiBorrowRequest = {
  requestType?: 'LABORATORY' | 'EQUIPMENT';
  usageRoomId?: string | null;
  usageRoom?: { id: string; name?: string | null; roomNumber?: string | null } | null;
  usageLocation?: string | null;
  id: string;
  createdAt: string;
  dateNeeded: string;
  timeStart?: string | null;
  timeEnd?: string | null;
  yearLevel?: number | null;
  status: BorrowRequestStatus;
  contactDetails?: string | null;
  academicYearId?: string;
  termId?: string;
  faculty?: {
    id: string;
    user?: {
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  } | null;
  purpose?: string | null;
  notes?: string | null;
  rejectionNote?: string | null;
  room?: {
    id: string;
    name?: string | null;
    roomNumber?: string | null;
  } | null;
  location?: string | null; // For general rooms
  program?: {
    id: string;
    name?: string | null;
    code?: string | null;
  } | null;
  subject?: {
    id: string;
    name?: string | null;
    code?: string | null;
  } | null;
  items?: ApiBorrowRequestItem[];
};

export const formatDate = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatTimeRange = (start?: string | null, end?: string | null) => {
  if (!start || !end) return '—';
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return '—';
  const formatter: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' };
  return `${startDate.toLocaleTimeString([], formatter)} – ${endDate.toLocaleTimeString([], formatter)}`;
};

export const toDateInputValue = dateToDateKey;

export const toManilaTimeInputValue = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
};

export const formatReference = (id: string) => {
  if (!id) return 'REQ-000000';
  const clean = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = clean.slice(-6) || clean;
  return `REQ-${suffix.padStart(6, '0')}`;
};

export const normalizeBorrowRequest = (request: ApiBorrowRequest): RequestRow => {
  const equipmentList = (request.items ?? [])
    .map((item) => `${item.equipment?.name ?? 'Equipment'} (x${item.quantity})`)
    .join(', ');

  const roomNumber = request.room?.roomNumber?.trim();
  const roomName = request.room?.name?.trim();
  const compositeRoom = [roomNumber, roomName].filter(Boolean).join(' – ');
  // Check for room first, then location, then fallback
  const usageLabel = request.usageRoom ? [request.usageRoom.roomNumber, request.usageRoom.name].filter(Boolean).join(' – ') : request.usageLocation;
  const roomLabel = (request.requestType === 'EQUIPMENT' ? usageLabel : compositeRoom || roomNumber || roomName) || request.location || 'No lab reserved';
  return {
    id: request.id,
    reference: formatReference(request.id),
    filed: formatDate(request.createdAt),
    room: roomLabel,
    equipment: equipmentList || '—',
    dateOfUse: formatDate(request.dateNeeded),
    time: formatTimeRange(request.timeStart, request.timeEnd),
    note: request.purpose || request.notes || '—',
    status: request.status,
    source: request,
  };
};
