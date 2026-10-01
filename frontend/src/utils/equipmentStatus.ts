import type { ConflictRequest, EquipmentAvailability, EquipmentConflict } from '../hooks/useEquipmentAvailability';

export type EquipmentStatus = 'available' | 'limited' | 'critical' | 'unavailable';

export interface EquipmentStatusColors {
  bg: string;
  border: string;
  text: string;
  progress: string;
  label: string;
}

/**
 * Maps an availability percentage to a status + Tailwind color set.
 * Thresholds: >=70% available, >=30% limited, otherwise critical/unavailable.
 */
export function getEquipmentStatusColors(
  availability: EquipmentAvailability | undefined,
  effectiveAvailable: number
): { status: EquipmentStatus; colors: EquipmentStatusColors } {
  if (!availability || effectiveAvailable === 0) {
    return {
      status: 'unavailable',
      colors: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', progress: 'bg-red-500', label: 'Unavailable' },
    };
  }
  if (availability.percentage >= 70) {
    return {
      status: 'available',
      colors: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', progress: 'bg-green-500', label: 'Available' },
    };
  }
  if (availability.percentage >= 30) {
    return {
      status: 'limited',
      colors: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', progress: 'bg-yellow-500', label: 'Limited' },
    };
  }
  return {
    status: 'critical',
    colors: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', progress: 'bg-orange-500', label: 'Critical' },
  };
}

/**
 * Resolves the list of conflicting/overlapping reservations to show for a piece of
 * equipment: prefers the availability payload's own reservations, falls back to the
 * separate conflicts-check response, and finally synthesizes a generic placeholder
 * when we only know equipment is unavailable but not by whom.
 */
export function buildConflictingRequests(
  equipmentId: string,
  availability: EquipmentAvailability | undefined,
  conflicts: EquipmentConflict[],
  timeStart: string,
  timeEnd: string
): ConflictRequest[] {
  if (availability?.reservations && availability.reservations.length > 0) {
    return availability.reservations;
  }

  const conflict = conflicts.find((c) => c.equipmentId === equipmentId);
  if (conflict?.conflictingRequests && conflict.conflictingRequests.length > 0) {
    return conflict.conflictingRequests;
  }

  if (availability && availability.available === 0 && availability.used > 0) {
    return [
      {
        requestId: 'unknown',
        facultyName: 'Multiple faculty members',
        quantity: availability.used,
        timeStart,
        timeEnd,
        purpose: 'Various purposes',
        status: 'APPROVED',
      },
    ];
  }

  return [];
}
