import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';
import {
  isWithinOperationalHours,
  isValidTimeString,
} from '../utils/timeBlocks';

export interface ConflictRequest {
  requestId: string;
  facultyName: string;
  quantity: number;
  timeStart: string;
  timeEnd: string;
  purpose: string;
  status: string;
}

export interface EquipmentAvailability {
  id: string;
  name: string;
  equipmentStatus: string;
  total: number;
  available: number;
  used: number;
  percentage: number;
  status: 'available' | 'limited' | 'critical' | 'unavailable';
  reservations?: ConflictRequest[];
}

export interface AcademicContext {
  academicYearId: string;
  termId: string;
}

export interface EquipmentConflict {
  equipmentId: string;
  conflictingRequests?: ConflictRequest[];
  [key: string]: unknown;
}

interface EquipmentLike {
  id: string;
}

interface UseEquipmentAvailabilityArgs {
  equipment: EquipmentLike[];
  academicContext: AcademicContext | null;
  dateNeeded: string;
  timeStart: string;
  timeEnd: string;
  isEnabled: boolean;
  excludeRequestId?: string;
}

// Cache for availability data, shared across hook instances for the session.
const CACHE_TTL = 30000; // 30 seconds
const availabilityCache: Record<string, { data: EquipmentAvailability[]; timestamp: number }> = {};

function getCacheKey(
  academicContext: AcademicContext,
  date: string,
  timeStart: string,
  timeEnd: string,
  excludeRequestId?: string
): string {
  return `${academicContext.academicYearId}-${academicContext.termId}-${date}-${timeStart}-${timeEnd}-${excludeRequestId || 'none'}`;
}

async function getCachedAvailability(
  academicContext: AcademicContext,
  date: string,
  timeStart: string,
  timeEnd: string,
  excludeRequestId?: string
): Promise<EquipmentAvailability[]> {
  const cacheKey = getCacheKey(academicContext, date, timeStart, timeEnd, excludeRequestId);
  const cached = availabilityCache[cacheKey];

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const params = new URLSearchParams({
    academicYearId: academicContext.academicYearId,
    termId: academicContext.termId,
    date,
    timeStart,
    timeEnd,
  });
  if (excludeRequestId) params.set('excludeRequestId', excludeRequestId);

  const response = await api.get(`/equipment-conflicts/availability?${params.toString()}`);

  if (!response.data.success) {
    throw new Error('Availability check failed');
  }

  const data = response.data.data.availability;
  availabilityCache[cacheKey] = { data, timestamp: Date.now() };
  return data;
}

/**
 * Validates the requested time range against operational hours and basic sanity checks.
 */
export function useTimeValidation(timeStart: string, timeEnd: string) {
  return useMemo(() => {
    if (!timeStart || !timeEnd) {
      return { valid: false, error: 'Select both a start time and an end time.' };
    }
    if (!isValidTimeString(timeStart) || !isValidTimeString(timeEnd)) {
      return { valid: false, error: 'Please choose valid start and end times.' };
    }
    if (!isWithinOperationalHours(timeStart) || !isWithinOperationalHours(timeEnd)) {
      return { valid: false, error: 'Choose a time between 7:30 AM and 9:00 PM.' };
    }

    const startMinutes = timeStart.split(':').reduce((h, m) => h * 60 + Number(m), 0);
    const endMinutes = timeEnd.split(':').reduce((h, m) => h * 60 + Number(m), 0);

    if (startMinutes >= endMinutes) {
      return {
        valid: false,
        error: 'Choose an end time later than the start time so your session has a duration.',
      };
    }

    return { valid: true, error: null as string | null };
  }, [timeStart, timeEnd]);
}

/**
 * Fetches and caches equipment availability + conflicts for a given date/time/academic
 * context.
 */
export function useEquipmentAvailability({
  equipment,
  academicContext,
  dateNeeded,
  timeStart,
  timeEnd,
  isEnabled,
  excludeRequestId,
}: UseEquipmentAvailabilityArgs) {
  const [availability, setAvailability] = useState<EquipmentAvailability[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<EquipmentConflict[]>([]);

  const timeValidation = useTimeValidation(timeStart, timeEnd);

  const fetchAvailability = useCallback(async () => {
    if (!isEnabled || !timeValidation.valid) {
      setAvailability([]);
      setAvailabilityError(null);
      return;
    }

    setAvailabilityLoading(true);
    setAvailabilityError(null);

    try {
      const data = await getCachedAvailability(
        academicContext!,
        dateNeeded,
        timeStart,
        timeEnd,
        excludeRequestId
      );
      setAvailability(data);
    } catch (err) {
      console.error('Availability fetch error:', err);
      setAvailabilityError('We couldn’t load equipment availability. Please check your connection and try again.');
      setAvailability([]);
    } finally {
      setAvailabilityLoading(false);
    }
  }, [isEnabled, academicContext, dateNeeded, timeStart, timeEnd, excludeRequestId, timeValidation.valid]);

  const fetchConflicts = useCallback(async () => {
    if (!isEnabled || !timeValidation.valid) {
      setConflicts([]);
      return;
    }

    try {
      // Request 0 quantity for all equipment to get reservation details without conflict filtering.
      const allEquipmentArray = equipment.map((eq) => ({ equipmentId: eq.id, requestedQuantity: 0 }));

      const response = await api.post('/equipment-conflicts/conflicts', {
        academicYearId: academicContext!.academicYearId,
        termId: academicContext!.termId,
        date: dateNeeded,
        timeStart,
        timeEnd,
        equipment: allEquipmentArray,
        excludeRequestId,
      });

      setConflicts(response.data.success ? response.data.data.conflicts || [] : []);
    } catch (err) {
      console.error('Conflicts fetch error:', err);
      setConflicts([]);
    }
  }, [isEnabled, academicContext, dateNeeded, timeStart, timeEnd, excludeRequestId, timeValidation.valid, equipment]);

  useEffect(() => {
    if (!isEnabled) return;
    const timeoutId = setTimeout(fetchAvailability, 300);
    return () => clearTimeout(timeoutId);
  }, [isEnabled, fetchAvailability]);

  useEffect(() => {
    if (!isEnabled) return;
    const timeoutId = setTimeout(fetchConflicts, 400);
    return () => clearTimeout(timeoutId);
  }, [isEnabled, fetchConflicts]);

  const getEquipmentAvailability = useCallback(
    (equipmentId: string): EquipmentAvailability | undefined => availability.find((a) => a.id === equipmentId),
    [availability]
  );

  return {
    availability,
    availabilityLoading,
    availabilityError,
    conflicts,
    timeValidation,
    getEquipmentAvailability,
  };
}
