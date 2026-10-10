import { studentAcademicApi } from '../../services/api';
import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeSchedule } from '../../components/lab-schedule/normalizeSchedule';
import { borrowRequestApi, equipmentApi, labScheduleApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { EquipmentItem } from '../../types/equipment';
import type { AcademicContextSelection, ApiLabSchedule, LabSchedule } from '../../types/labSchedule';
import type { BorrowRequestStatus } from '../../types/requests';
import { type ApiBorrowRequest, type FacultySelectOption, normalizeBorrowRequest, type RequestResources, type RequestRow, type SelectOption } from './requestModels';

export type RequestsHookState = {
  page: number; setPage: (page: number) => void; total: number; requestSearch: string; setRequestSearch: (value: string) => void; requestStatus: BorrowRequestStatus | 'ALL'; setRequestStatus: (value: BorrowRequestStatus | 'ALL') => void;
  rows: RequestRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export const useMyBorrowRequests = (): RequestsHookState => {
  const [page, setPage] = useState(1), [total, setTotal] = useState(0);
  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatus, setRequestStatus] = useState<BorrowRequestStatus | 'ALL'>('ALL');
  const pageReset1Inputs = [requestSearch, requestStatus];
  const [pageReset1Previous, setpageReset1Previous] = useState<unknown[] | null>(null);
  if (!pageReset1Previous || pageReset1Inputs.some((value, index) => !Object.is(value, pageReset1Previous[index]))) {
    setpageReset1Previous(pageReset1Inputs);
    setPage(1);
  }
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestVersion = useRef(0);
  const performLoadRequests = useCallback(async () => {
    const version = ++requestVersion.current;
    
      return borrowRequestApi.getMyPage({ page, pageSize: 10, search: requestSearch, status: requestStatus }).then((response) => {
      if (version !== requestVersion.current) return;
      setTotal(response.data.total);
      if (page > 1 && response.data.total <= (page - 1) * 10) setPage(Math.max(1, Math.ceil(response.data.total / 10)));
      const data = Array.isArray(response.data?.requests) ? (response.data.requests as ApiBorrowRequest[]) : [];
      setRows(data.map(normalizeBorrowRequest));
    
    }).catch((err) => {
      if (version !== requestVersion.current) return;
      console.error('Failed to load requests', err);
      setError(err instanceof Error && /exceeds 1000|Data changed while loading/.test(err.message) ? err.message : 'Failed to load your borrow requests. Please try again.');
      setRows([]);
    }).finally(() => {
      if (version === requestVersion.current) setLoading(false);
    });
  }, [page, requestSearch, requestStatus]);

  // Automatic loads reset pending state when their query changes; refreshes reset it in the event.
  const loadRequestsInputs = [page, requestSearch, requestStatus];
  const [loadRequestsSource, setloadRequestsSource] = useState(loadRequestsInputs);
  if (loadRequestsInputs.some((value, index) => !Object.is(value, loadRequestsSource[index]))) {
    setloadRequestsSource(loadRequestsInputs);
    setLoading(true);
    setError(null);
  }
  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    await performLoadRequests();
  }, [performLoadRequests]);

  useEffect(() => { void performLoadRequests(); }, [performLoadRequests]);

  return {
    page, setPage, total, requestSearch, setRequestSearch, requestStatus, setRequestStatus,
    rows,
    loading,
    error,
    reload: loadRequests,
  };
};

export type SchedulesState = {
  schedules: LabSchedule[];
  loading: boolean;
  error: string | null;
  dateFilter: string;
  setDateFilter: (value: string) => void;
  reload: () => Promise<void>;
};

export const useLabSchedules = (): SchedulesState => {
  const [schedules, setSchedules] = useState<LabSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState('');

  const performLoadSchedules = useCallback(async () => {
    
      // Fetch the whole active period; individual views apply their own date filters.
      const params = undefined;
      return labScheduleApi.getAll(params).then((response) => {
      const data = Array.isArray(response.data?.schedules) ? (response.data.schedules as ApiLabSchedule[]) : [];
      // Student/faculty schedule views only include explicitly flagged computer labs.
      setSchedules(data.filter(schedule => schedule.room?.isComputerLab === true).map(schedule => normalizeSchedule(schedule)));
    
    }).catch((err) => {
      console.error('Failed to load lab schedules', err);
      setError(err instanceof Error && /exceeds 1000|Data changed while loading/.test(err.message) ? err.message : 'Failed to load lab schedules. Please try again.');
      setSchedules([]);
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  // Automatic loads reset pending state when their query changes; refreshes reset it in the event.
  const loadSchedulesInputs: string[] = [];
  const [loadSchedulesSource, setloadSchedulesSource] = useState(loadSchedulesInputs);
  if (loadSchedulesInputs.some((value, index) => !Object.is(value, loadSchedulesSource[index]))) {
    setloadSchedulesSource(loadSchedulesInputs);
    setLoading(true);
    setError(null);
  }
  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    await performLoadSchedules();
  }, [performLoadSchedules]);

  useEffect(() => { void performLoadSchedules(); }, [performLoadSchedules]);

  return {
    schedules,
    loading,
    error,
    dateFilter,
    setDateFilter,
    reload: loadSchedules,
  };
};

export type ResourceHookState = {
  resources: RequestResources | null;
  academicContext: AcademicContextSelection | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export const useRequestResources = (): ResourceHookState => {
  const { user } = useAuthStore();
  const [resources, setResources] = useState<RequestResources | null>(null);
  const [academicContext, setAcademicContext] = useState<AcademicContextSelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const performLoadResources = useCallback(async () => {
    
      type RawResource = {
        id: string;
        name?: string | null;
        roomNumber?: string | null;
        code?: string | null;
        year?: string | null;
        isActive?: boolean | null;
        isComputerLab?: boolean | null;
      };
      type RawFaculty = { profileId: string; userId: string; firstName?: string | null; lastName?: string | null };
      type RawResponse = {
        rooms?: RawResource[];
        programs?: RawResource[];
        subjects?: RawResource[];
        faculty?: RawFaculty[];
        academicYears?: RawResource[];
        terms?: RawResource[];
      };

      return Promise.all([labScheduleApi.getResources(), equipmentApi.getAll(), user?.role === 'STUDENT' ? studentAcademicApi.me() : Promise.resolve(null)]).then(([resourcesRes, equipmentRes, academicRes]) => {
      const rawData: RawResponse = resourcesRes.data ?? {};
      const equipmentList = Array.isArray(equipmentRes.data) ? (equipmentRes.data as EquipmentItem[]) : [];

      const mapOptions = (
        items: RawResource[] = [],
        labelResolver: (item: RawResource) => string | null | undefined
      ): SelectOption[] =>
        items
          .filter((item) => item.id)
          .map((item) => ({
            value: item.id,
            label: (labelResolver(item)?.trim() || 'Unnamed') as string,
          }));

      const pickActiveResource = (items: RawResource[] = []) => {
        if (!items.length) return null;
        return items.find((item) => item.isActive) ?? items[0];
      };

      const selectedYear = pickActiveResource(rawData.academicYears);
      const selectedTerm = pickActiveResource(rawData.terms);

      if (selectedYear && selectedTerm) {
        setAcademicContext({
          academicYearId: selectedYear.id,
          academicYearLabel: selectedYear.year || selectedYear.name || 'Academic Year',
          termId: selectedTerm.id,
          termLabel: selectedTerm.name || 'Term',
        });
      } else {
        setAcademicContext(null);
      }

      const facultyOptions: FacultySelectOption[] = (rawData.faculty ?? []).map((profile) => ({
        value: profile.profileId,
        profileId: profile.profileId,
        userId: profile.userId,
        label: `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || 'Unnamed faculty',
      }));

      const selfProfile = (rawData.faculty ?? []).find((profile) => profile.userId === user?.id) ?? null;

      const roomOptions = (rawData.rooms ?? [])
        .filter((room) => room.id)
        .map((room) => ({
          value: room.id,
          label: [room.roomNumber?.trim(), room.name?.trim()].filter(Boolean).join(' – ') || 'Unnamed room',
          isComputerLab: Boolean(room.isComputerLab),
        }));

      setResources({
        studentAcademic: academicRes?.data,
        rooms: roomOptions,
        programs: mapOptions(rawData.programs, (item) => item.name || item.code || ''),
        subjects: mapOptions(rawData.subjects, (item) => item.name || item.code || ''),
        faculty: facultyOptions,
        equipment: equipmentList,
        selfFacultyProfileId: selfProfile?.profileId ?? null,
      });
    
    }).catch((err) => {
      console.error('Failed to load request resources', err);
      setError(err instanceof Error && /exceeds 1000|Data changed while loading/.test(err.message) ? err.message : 'Failed to load request resources. Please try again.');
      setResources(null);
      setAcademicContext(null);
    }).finally(() => {
      setLoading(false);
    });
  }, [user?.id, user?.role]);

  // Automatic loads reset pending state when their query changes; refreshes reset it in the event.
  const loadResourcesInputs = [user?.id];
  const [loadResourcesSource, setloadResourcesSource] = useState(loadResourcesInputs);
  if (loadResourcesInputs.some((value, index) => !Object.is(value, loadResourcesSource[index]))) {
    setloadResourcesSource(loadResourcesInputs);
    setLoading(true);
    setError(null);
  }
  const loadResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    await performLoadResources();
  }, [performLoadResources]);

  useEffect(() => { void performLoadResources(); }, [performLoadResources]);

  return {
    resources,
    academicContext,
    loading,
    error,
    reload: loadResources,
  };
};
