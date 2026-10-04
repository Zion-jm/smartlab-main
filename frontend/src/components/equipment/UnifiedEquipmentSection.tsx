import { useMemo, useState } from 'react';
import { AlertTriangle, Clock, Package } from 'lucide-react';
import MobileEquipmentPicker from './MobileEquipmentPicker';
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
  const [reviewVersion, setReviewVersion] = useState(0);
  const [showAllIssues, setShowAllIssues] = useState(false);
  const [modalEquipment, setModalEquipment] = useState<{
    name: string;
    totalQuantity: number;
    conflictingRequests: ConflictRequest[];
  } | null>(null);

  const hasDateTime = Boolean(dateNeeded && timeStart && timeEnd);
  const hasAcademicContext = Boolean(academicContext?.academicYearId && academicContext?.termId);
  const isEquipmentEnabled = hasDateTime && hasAcademicContext;

  const { availabilityLoading, availabilityError, conflicts, timeValidation, getEquipmentAvailability, retryAvailability } =
    useEquipmentAvailability({
      equipment,
      academicContext,
      dateNeeded,
      timeStart,
      timeEnd,
      isEnabled: isEquipmentEnabled,
      excludeRequestId,
    });

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

  const selected = enhancedEquipment.filter(item => item.isSelected);
  const pendingAvailability = availabilityLoading || selected.some(item => !item.availability);
  const shortages = selected.filter(item => item.availability && item.selectedQuantity > item.effectiveAvailable);
  const conflictChecker = selected.length > 0 && (
    <div role="status" className={`rounded-xl border px-3 py-3 text-sm ${availabilityError || shortages.length ? 'border-[#f4dfac] bg-[#fffaf0] text-[#92400e]' : 'border-[#d9e9e1] bg-[#f5fcf8] text-[#18765c]'}`}>
      {availabilityError ? <><p className="font-semibold">Couldn’t check equipment availability.</p><button type="button" onClick={() => void retryAvailability()} className="min-h-11 font-semibold underline">Retry</button></> : pendingAvailability ? <p>Checking your selected quantities…</p> : shortages.length ? <>
        <p className="font-semibold">Adjust {shortages.length} equipment {shortages.length === 1 ? 'quantity' : 'quantities'}</p>
        <ul className="mt-2 space-y-2">{(showAllIssues ? shortages : shortages.slice(0, 2)).map(item => <li key={item.id}><span className="font-medium">{item.name}</span><span className="block text-xs">Requested {item.selectedQuantity} · Available {item.effectiveAvailable}</span></li>)}</ul>
        {shortages.length > 2 && <button type="button" aria-expanded={showAllIssues} onClick={() => setShowAllIssues(!showAllIssues)} className="min-h-11 text-xs font-semibold underline">{showAllIssues ? 'Show fewer issues' : 'View all issues'}</button>}
        <p className="mt-2 text-xs">Reduce the quantities or remove unavailable items.</p>
        <button type="button" onClick={() => setReviewVersion(value => value + 1)} className="mt-2 min-h-11 rounded-lg bg-[#800000] px-3 text-xs font-semibold text-white md:hidden">Review equipment</button>
      </> : <p className="font-medium">Your selected equipment is available.</p>}
    </div>
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
          <h3 className="request-section-heading text-base font-semibold text-gray-800"><Package size={18} aria-hidden="true" className="md:hidden" /><span className="md:hidden">Equipment</span><span className="hidden md:inline">Equipment Availability & Selection</span></h3>
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

      {availabilityError && !selected.length && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <div>
              <span className="text-sm text-amber-700 font-medium">Equipment availability is temporarily unavailable</span>
              <p className="text-xs text-amber-700 mt-1">{availabilityError}</p><button type="button" onClick={() => void retryAvailability()} className="min-h-11 text-xs font-semibold underline">Retry</button>
            </div>
          </div>
        </div>
      )}

      <MobileEquipmentPicker reviewVersion={reviewVersion} equipment={enhancedEquipment} loading={availabilityLoading} error={Boolean(availabilityError)} onChange={onEquipmentChange} onClear={onEquipmentClear} />

      <div className="hidden md:block bg-white border border-gray-200 rounded-lg">
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedEquipment.map((eq) => (
              <EquipmentCard key={eq.id} equipment={eq} onChange={onEquipmentChange} onClear={onEquipmentClear} onViewDetails={handleViewDetails} />
            ))}
          </div>
        </div>
      </div>

      {detailsModal}
    </div>
  );
}
