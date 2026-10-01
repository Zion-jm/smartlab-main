import { useMemo, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import EquipmentConflictChecker from './EquipmentConflictChecker';
import ConflictWarningList from './ConflictWarningList';
import { EquipmentReservationModal } from './EquipmentReservationModal';
import EquipmentCard, { type EquipmentCardData } from './EquipmentCard';
import { useEquipmentAvailability, type AcademicContext, type ConflictRequest } from '../../hooks/useEquipmentAvailability';
import { buildConflictingRequests } from '../../utils/equipmentStatus';

interface EquipmentItem {
  id: string;
  name: string;
  totalQuantity: number;
  availableQuantity: number;
  borrowedQuantity: number;
  status: string;
}

interface UnifiedEquipmentSectionProps {
  equipment: EquipmentItem[];
  selectedEquipment: Record<string, number>;
  onEquipmentChange: (equipmentId: string, quantity: number, max: number) => void;
  onEquipmentClear: (equipmentId: string) => void;
  academicContext: AcademicContext | null;
  dateNeeded: string;
  timeStart: string;
  timeEnd: string;
  loading?: boolean;
  className?: string;
  compact?: boolean;
  excludeRequestId?: string;
}

const COMPACT_VISIBLE_COUNT = 4;

export default function UnifiedEquipmentSection({
  equipment,
  selectedEquipment,
  onEquipmentChange,
  onEquipmentClear,
  academicContext,
  dateNeeded,
  timeStart,
  timeEnd,
  className = '',
  compact = false,
  excludeRequestId,
}: UnifiedEquipmentSectionProps) {
  const [modalEquipment, setModalEquipment] = useState<{
    name: string;
    totalQuantity: number;
    conflictingRequests: ConflictRequest[];
  } | null>(null);

  const hasDateTime = Boolean(dateNeeded && timeStart && timeEnd);
  const hasAcademicContext = Boolean(academicContext?.academicYearId && academicContext?.termId);
  const isEquipmentEnabled = hasDateTime && hasAcademicContext;

  const { availabilityLoading, availabilityError, conflicts, timeValidation, getEquipmentAvailability } =
    useEquipmentAvailability({
      equipment,
      academicContext,
      dateNeeded,
      timeStart,
      timeEnd,
      isEnabled: isEquipmentEnabled,
      excludeRequestId,
    });

  const selectedEquipmentArray = useMemo(
    () =>
      Object.entries(selectedEquipment)
        .filter(([, qty]) => qty > 0)
        .map(([equipmentId, quantity]) => ({ equipmentId, quantity })),
    [selectedEquipment]
  );

  // Enhanced equipment data with availability and selection state.
  const enhancedEquipment: EquipmentCardData[] = useMemo(
    () =>
      equipment.map((eq) => {
        const avail = getEquipmentAvailability(eq.id);
        return {
          ...eq,
          availability: avail,
          isSelected: selectedEquipment[eq.id] > 0,
          selectedQuantity: selectedEquipment[eq.id] || 0,
          effectiveAvailable: avail ? avail.available : 0,
        };
      }),
    [equipment, selectedEquipment, getEquipmentAvailability]
  );

  // Sort equipment by availability (scarce first); keep original order within
  // the selected/unselected groups so items don't jump around as they're picked.
  const sortedEquipment = useMemo(() => {
    const indexed = enhancedEquipment.map((eq, index) => ({ ...eq, originalIndex: index }));

    return indexed.sort((a, b) => {
      if (a.isSelected !== b.isSelected) return a.originalIndex - b.originalIndex;

      const aAvail = a.availability;
      const bAvail = b.availability;
      if (!aAvail && !bAvail) return a.originalIndex - b.originalIndex;
      if (!aAvail) return 1;
      if (!bAvail) return -1;
      if (aAvail.percentage !== bAvail.percentage) return aAvail.percentage - bAvail.percentage;
      return a.originalIndex - b.originalIndex;
    });
  }, [enhancedEquipment]);

  const handleViewDetails = (eq: EquipmentCardData) => {
    setModalEquipment({
      name: eq.name,
      totalQuantity: eq.totalQuantity,
      conflictingRequests: buildConflictingRequests(eq.id, eq.availability, conflicts, timeStart, timeEnd),
    });
  };

  if (!isEquipmentEnabled) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-6 text-center ${className}`}>
        <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600 font-medium">Equipment selection requires date, time, and academic context</p>
        <p className="text-xs text-gray-500 mt-1">Please select date and time to enable equipment selection</p>
      </div>
    );
  }

  if (!timeValidation.valid) {
    return (
      <div className={`bg-amber-50 border border-amber-200 rounded-lg p-6 text-center ${className}`}>
        <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
        <p className="text-sm text-amber-700 font-medium">Please check your session time</p>
        <p className="text-xs text-amber-700 mt-1">{timeValidation.error}</p>
      </div>
    );
  }

  const conflictChecker = (
    <EquipmentConflictChecker
      academicYearId={academicContext!.academicYearId}
      termId={academicContext!.termId}
      date={dateNeeded}
      timeStart={timeStart}
      timeEnd={timeEnd}
      equipment={selectedEquipmentArray}
      excludeRequestId={excludeRequestId}
    />
  );

  const detailsModal = modalEquipment && (
    <EquipmentReservationModal
      equipmentName={modalEquipment.name}
      totalQuantity={modalEquipment.totalQuantity}
      conflictingRequests={modalEquipment.conflictingRequests}
      onClose={() => setModalEquipment(null)}
    />
  );

  if (compact) {
    const visibleEquipment = sortedEquipment.slice(0, COMPACT_VISIBLE_COUNT);
    const hiddenCount = equipment.length - COMPACT_VISIBLE_COUNT;

    return (
      <div className={`space-y-4 ${className}`}>
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-3 border-b border-gray-200">
            <h4 className="text-xs font-semibold text-gray-800">Equipment Availability & Selection</h4>
          </div>
          {conflictChecker}
          <div className="p-3 space-y-2">
            {visibleEquipment.map((eq) => (
              <EquipmentCard key={eq.id} equipment={eq} compact onChange={onEquipmentChange} onClear={onEquipmentClear} onViewDetails={handleViewDetails} />
            ))}
            {hiddenCount > 0 && <div className="text-xs text-gray-500 text-center">+{hiddenCount} more equipment items</div>}
          </div>
        </div>

        {conflictChecker}
        {detailsModal}
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-800">Equipment Availability & Selection</h3>
          <p className="text-sm text-gray-600">
            {dateNeeded} at {timeStart} - {timeEnd} • Select equipment and specify quantities needed
          </p>
        </div>
        {availabilityLoading && (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
            Checking availability...
          </div>
        )}
      </div>

      {conflictChecker}

      {availabilityError && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <div>
              <span className="text-sm text-amber-700 font-medium">Equipment availability is temporarily unavailable</span>
              <p className="text-xs text-amber-700 mt-1">{availabilityError}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedEquipment.map((eq) => (
              <EquipmentCard key={eq.id} equipment={eq} onChange={onEquipmentChange} onClear={onEquipmentClear} onViewDetails={handleViewDetails} />
            ))}
          </div>
        </div>
      </div>

      {conflicts.length > 0 && (
        <ConflictWarningList
          conflicts={conflicts.map((conflict) => ({
            equipmentId: conflict.equipmentId,
            equipmentName: String(conflict.equipmentName ?? 'Unknown equipment'),
            requestedQuantity: Number(conflict.requestedQuantity ?? 0),
            availableQuantity: Number(conflict.availableQuantity ?? 0),
            totalQuantity: Number(conflict.totalQuantity ?? 0),
            shortage: Number(conflict.shortage ?? 0),
            conflictingRequests: (conflict.conflictingRequests ?? []).map((request) => ({
              requestId: request.requestId,
              requesterName: request.facultyName,
              requesterEmail: '',
              quantity: request.quantity,
              timeStart: request.timeStart,
              timeEnd: request.timeEnd,
              purpose: request.purpose,
              status: request.status,
              dateNeeded: '',
            })),
          }))}
          showEquipmentDetails={true}
        />
      )}

      {detailsModal}
    </div>
  );
}
