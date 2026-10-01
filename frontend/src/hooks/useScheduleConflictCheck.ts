import { combineManilaDateTime as combineDateTime, nextManilaWeekday as getNextDateForDay } from '../utils/dateTime';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AxiosResponse } from 'axios';
import type { ScheduleType } from '../types/labSchedule';
import { conflictApi } from '../services/api';

const normalizeRoomLabel = (label: string | null | undefined) => label?.trim() || null;

const deriveDateForSchedule = (scheduleType: ScheduleType, scheduleDate?: string | null, dayOfWeek?: string | null) => {
  if (scheduleType === 'ONE_TIME') {
    return scheduleDate?.trim() || null;
  }
  const numericDay = dayOfWeek !== undefined && dayOfWeek !== null ? Number(dayOfWeek) : Number.NaN;
  if (!Number.isInteger(numericDay)) {
    return null;
  }
  return getNextDateForDay(numericDay);
};

export type ConflictLevel = 'warning' | 'danger';
export type ConflictCheckStatus = 'idle' | 'checking' | 'good' | 'warning' | 'danger' | 'error';

export type ScheduleConflict = {
  id: string;
  level: ConflictLevel;
  type: string;
  title: string;
  message: string;
  details: Record<string, unknown>;
};

type RawConflictDetails = {
  schedule_id?: number | string;
  borrow_request_id?: number | string;
  id?: number | string;
} & Record<string, unknown>;

type RawConflict = {
  type: string;
  severity?: 'low' | 'medium' | 'high';
  title?: string;
  message?: string;
  details?: RawConflictDetails;
};

type ConflictCheckResponse = {
  conflicts?: RawConflict[];
};

export type ScheduleConflictParams = {
  scheduleType: ScheduleType;
  scheduleDate?: string;
  dayOfWeek?: string;
  timeStart?: string;
  timeEnd?: string;
  roomId?: string;
  roomLabel?: string;
  academicYearId?: string;
  termId?: string;
  excludeScheduleId?: string | number | null;
};

export type UseScheduleConflictResult = {
  status: ConflictCheckStatus;
  loading: boolean;
  ready: boolean;
  conflicts: ScheduleConflict[];
  error: string | null;
  refetch: () => void;
};

const mapConflictLevel = (conflict: RawConflict): ConflictLevel => {
  if (conflict.type === 'lab_schedule') {
    return 'danger';
  }
  return conflict.severity === 'high' ? 'danger' : 'warning';
};

const buildConflictId = (conflict: RawConflict, index: number) => {
  const details = conflict.details || {};
  return String(
    details.schedule_id ??
      details.borrow_request_id ??
      details.id ??
      `${conflict.type}-${index}`
  );
};

const normalizeConflicts = (raw: RawConflict[] = []): ScheduleConflict[] =>
  raw.map((conflict, index) => ({
    id: buildConflictId(conflict, index),
    level: mapConflictLevel(conflict),
    type: conflict.type,
    title: conflict.title ?? 'Schedule conflict detected',
    message: conflict.message ?? 'Another reservation overlaps this slot.',
    details: conflict.details ?? {},
  }));

export function useScheduleConflictCheck(
  params: ScheduleConflictParams | null,
  options: { debounceMs?: number } = {}
): UseScheduleConflictResult {
  const [status, setStatus] = useState<ConflictCheckStatus>('idle');
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const debounceMs = options.debounceMs ?? 400;
  const ready = useMemo(() => {
    if (!params) return false;
    const roomLabel = normalizeRoomLabel(params.roomLabel);
    if (!roomLabel) return false;
    if (!params.roomId) return false;
    if (!params.academicYearId || !params.termId) return false;
    if (!params.timeStart || !params.timeEnd) return false;
    if (params.scheduleType === 'ONE_TIME' && !params.scheduleDate) return false;
    if (params.scheduleType === 'WEEKLY' && (params.dayOfWeek === undefined || params.dayOfWeek === '')) return false;
    return true;
  }, [params]);

  const payload = useMemo(() => {
    if (!params || !ready) return null;
    const roomLabel = normalizeRoomLabel(params.roomLabel);
    if (!roomLabel) return null;
    // Use a single base date for both times to avoid cross-day issues
    const baseDate = deriveDateForSchedule(params.scheduleType, params.scheduleDate, params.dayOfWeek);
    const timeStartIso = combineDateTime(baseDate, params.timeStart);
    const timeEndIso = combineDateTime(baseDate, params.timeEnd);
    if (!timeStartIso || !timeEndIso) return null;

    const body: Record<string, unknown> = {
      roomId: params.roomId,
      academicYearId: params.academicYearId,
      termId: params.termId,
      scheduleType: params.scheduleType,
      scheduleDate: params.scheduleType === 'ONE_TIME' ? params.scheduleDate : undefined,
      dayOfWeek:
        params.scheduleType === 'WEEKLY' && params.dayOfWeek !== undefined && params.dayOfWeek !== ''
          ? Number(params.dayOfWeek)
          : undefined,
      timeStart: timeStartIso,
      timeEnd: timeEndIso,
      excludeScheduleId: params.excludeScheduleId ?? undefined,
    };
    return body;
  }, [params, ready]);

  const latestRequest = useRef(0);

  useEffect(() => {
    if (!payload) return;

    let isActive = true;
    const requestId = Date.now();
    latestRequest.current = requestId;

    const timer = setTimeout(() => {
      if (!isActive) return;
      setLoading(true);
      setStatus('checking');
      setError(null);
      conflictApi
        .check(payload)
        .then((response: AxiosResponse<ConflictCheckResponse>) => {
          if (!isActive || latestRequest.current !== requestId) return;
          const normalized = normalizeConflicts(response.data?.conflicts ?? []);
          setConflicts(normalized);
          if (!normalized.length) {
            setStatus('good');
          } else if (normalized.some((conflict) => conflict.level === 'danger')) {
            setStatus('danger');
          } else {
            setStatus('warning');
          }
        })
        .catch((err) => {
          if (!isActive) return;
          console.error('Conflict check failed', err);
          const message = 'We couldn’t check room availability right now. Please check your connection and try again.';
          setError(message);
          setConflicts([]);
          setStatus('error');
        })
        .finally(() => {
          if (!isActive) return;
          setLoading(false);
        });
    }, debounceMs);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [payload, debounceMs, refreshIndex]);

  const refetch = () => {
    if (!payload) return;
    setRefreshIndex((prev) => prev + 1);
  };

  return {
    status: payload ? status : 'idle',
    loading: payload ? loading : false,
    ready,
    conflicts: payload ? conflicts : [],
    error: payload ? error : null,
    refetch,
  };
}
