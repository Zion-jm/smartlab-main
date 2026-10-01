import { useState, useEffect, useMemo } from 'react';
import { Clock, Package } from 'lucide-react';
import api from '../../services/api';

interface ConflictRequest {
  requestId: string;
  requesterName: string;
  requesterEmail: string;
  quantity: number;
  timeStart: string;
  timeEnd: string;
  purpose: string;
  status: string;
}

interface Conflict {
  equipmentId: string;
  equipmentName: string;
  requestedQuantity: number;
  availableQuantity: number;
  totalQuantity: number;
  shortage: number;
  conflictingRequests: ConflictRequest[];
}

interface EquipmentConflictCheckerProps {
  academicYearId: string;
  termId: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  equipment: Array<{ equipmentId: string; quantity: number }>;
  excludeRequestId?: string; // Exclude this request from conflict checking
  availability?: EquipmentAvailabilitySummary[];
  availabilityLoading?: boolean;
  hasEquipmentShortages?: boolean;
  className?: string;
}

export interface EquipmentAvailabilitySummary {
  id: string;
  name: string;
  available: number;
  total: number;
}

// Status tokens for different conflict states
const statusTokens = {
  safe: { bg: 'bg-green-50', text: 'text-green-700', icon: '✅', label: 'Equipment check passed' },
  warning: { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: '⚠️', label: 'Equipment reservations need review' },
  danger: { bg: 'bg-red-50', text: 'text-red-700', icon: '🔴', label: 'Equipment availability needs review' },
  waiting: { bg: 'bg-blue-50', text: 'text-blue-700', icon: '⏳', label: 'Checking equipment availability...' },
  error: { bg: 'bg-red-50', text: 'text-red-700', icon: '❗', label: 'We couldn’t check equipment availability.' },
};

// Conflict details modal component
type ConflictDetailModalProps = {
  conflicts: Conflict[];
  currentRequestEquipment: Array<{ equipmentId: string; quantity: number }>;
  onClose: () => void;
};

function ConflictDetailModal({ conflicts, currentRequestEquipment, onClose }: ConflictDetailModalProps) {
  // Group conflicts by request
  const groupedConflicts = useMemo(() => {
    const requestMap = new Map<string, {
      request: ConflictRequest;
      equipments: Array<{
        equipmentName: string;
        requestedQuantity: number;
        availableQuantity: number;
        shortage: number;
      }>;
    }>();

    conflicts.forEach(conflict => {
      conflict.conflictingRequests.forEach(request => {
        if (!requestMap.has(request.requestId)) {
          requestMap.set(request.requestId, {
            request,
            equipments: []
          });
        }
        
        const group = requestMap.get(request.requestId)!;
        group.equipments.push({
          equipmentName: conflict.equipmentName,
          requestedQuantity: request.quantity,
          availableQuantity: conflict.availableQuantity,
          shortage: conflict.shortage
        });
      });
    });

    return Array.from(requestMap.values());
  }, [conflicts]);

  const statusBadgeColor = (status: string) =>
    status === 'APPROVED' 
      ? 'bg-red-100 text-red-700 border-red-200' 
      : 'bg-yellow-100 text-yellow-700 border-yellow-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#f3f4f6] px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-[#111827]">Equipment conflict details</p>
            <p className="text-xs text-[#6b7280]">Review conflicting requests that may affect your equipment selection.</p>
          </div>
          <button type="button" onClick={onClose} className="text-[#6b7280] hover:text-[#111827]">
            ✕
          </button>
        </div>
        
        <div className="p-5">
          {/* Summary Section */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Conflict Summary</span>
              <span className="text-xs text-gray-500">
                {groupedConflicts.length} conflicting request{groupedConflicts.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-500">Equipment affected:</span>
                <span className="ml-2 font-medium text-gray-800">{conflicts.length} item{conflicts.length > 1 ? 's' : ''}</span>
              </div>
              <div>
                <span className="text-gray-500">Shortage for your request:</span>
                <span className="ml-2 font-medium text-red-600">
                  {(() => {
                    // Calculate actual total shortage using current request equipment
                    const actualTotalShortage = currentRequestEquipment.reduce((total, eq) => {
                      const conflict = conflicts.find(c => c.equipmentId === eq.equipmentId);
                      if (conflict) {
                        const actualShortage = eq.quantity - conflict.availableQuantity;
                        return total + Math.max(0, actualShortage); // Only count positive shortages
                      }
                      return total;
                    }, 0);
                    
                    if (actualTotalShortage === 0) {
                      return '0 items';
                    } else {
                      return `-${actualTotalShortage} items`;
                    }
                  })()}
                </span>
              </div>
            </div>
          </div>

          {/* Conflicting Requests Grouped */}
          <div className="space-y-4">
            {groupedConflicts.map(({ request, equipments }) => (
              <div
                key={request.requestId}
                className={`rounded-2xl border px-4 py-4 ${
                  request.status === 'APPROVED' 
                    ? 'border-[#fecaca] bg-[#fef2f2]' 
                    : 'border-[#fed7aa] bg-[#fff7ed]'
                }`}
              >
                {/* Request Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      request.status === 'APPROVED' ? 'bg-red-400' : 'bg-yellow-400'
                    }`}></div>
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">{request.requesterName}</p>
                      <p className="text-xs text-gray-600">{request.requesterEmail}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border ${statusBadgeColor(request.status)}`}>
                    {request.status}
                  </span>
                </div>

                {/* Request Details */}
                <div className="mb-3 text-xs text-gray-600 space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>{request.timeStart} - {request.timeEnd}</span>
                  </div>
                  {request.purpose && (
                    <div>
                      <span className="font-medium">Purpose:</span> {request.purpose}
                    </div>
                  )}
                </div>

                {/* Equipment Availability Summary */}
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-3 w-3 text-gray-600" />
                    <span className="text-xs font-medium text-gray-700">
                      Equipment in this request ({equipments.length})
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {equipments.map((equipment, index) => (
                      <div key={index} className="flex items-center justify-between text-xs bg-gray-50 rounded p-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800">{equipment.equipmentName}</span>
                          {(() => {
                            const actualShortage = equipment.requestedQuantity - equipment.availableQuantity;
                            if (actualShortage > 0) {
                              return (
                                <span className="text-red-600 font-medium">
                                  (-{actualShortage})
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <div className="flex items-center gap-3 text-gray-500">
                          <span>Requested by this requester: {equipment.requestedQuantity}</span>
                          <span className={(() => {
                            const actualShortage = equipment.requestedQuantity - equipment.availableQuantity;
                            return actualShortage > 0 ? 'text-red-600' : 'text-green-600';
                          })()}>
                            Available: {equipment.availableQuantity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Suggestion */}
                <div className={`mt-3 text-xs rounded p-2 ${
                  request.status === 'APPROVED' 
                    ? 'text-red-700 bg-red-50' 
                    : 'text-yellow-700 bg-yellow-50'
                }`}>
                  <strong>Suggestion:</strong> {
                    request.status === 'APPROVED' 
                      ? 'This is an approved request that conflicts with your selection. Consider different time slots or equipment.'
                      : 'This is a pending request that may affect availability if approved. Monitor its status or consider alternatives.'
                  }
                </div>
              </div>
            ))}
          </div>

          {/* Equipment Summary (for items without conflicts) */}
          {conflicts.some(c => c.shortage === 0) && (
            <div className="mt-4 p-3 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-3 w-3 text-green-600" />
                <span className="text-xs font-medium text-green-700">
                  Equipment with Pending Requests Only
                </span>
              </div>
              <div className="space-y-1">
                {conflicts
                  .filter(c => c.shortage === 0)
                  .map((conflict, index) => (
                    <div key={index} className="flex items-center justify-between text-xs text-green-600">
                      <span>{conflict.equipmentName}</span>
                      <span>{conflict.availableQuantity} available</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EquipmentConflictChecker({
  academicYearId,
  termId,
  date,
  timeStart,
  timeEnd,
  equipment,
  excludeRequestId,
  availability,
  availabilityLoading = false,
  hasEquipmentShortages = false,
  className = ''
}: EquipmentConflictCheckerProps) {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [lastChecked, setLastChecked] = useState<string>('');

  // Check if we have all required data
  const hasRequiredData = academicYearId && termId && date && timeStart && timeEnd && equipment.length > 0;

  // Create a unique key for the request to avoid unnecessary API calls
  const requestKey = `${academicYearId}-${termId}-${date}-${timeStart}-${timeEnd}-${excludeRequestId || 'none'}-${JSON.stringify([...equipment].sort((a, b) => a.equipmentId.localeCompare(b.equipmentId)))}`;

  const [conflictSource, setConflictSource] = useState('');
  if (conflictSource !== requestKey) {
    setConflictSource(requestKey);
    setConflicts([]);
    setError(null);
    setLoading(Boolean(hasRequiredData));
    setLastChecked('');
  }
  useEffect(() => {
    if (!hasRequiredData) return;
    let active = true;

    // Skip if we've already checked this exact request recently
    if (requestKey === lastChecked) {
      return;
    }

    const fetchConflicts = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await api.post('/equipment-conflicts/conflicts', {
          academicYearId,
          termId,
          date,
          timeStart,
          timeEnd,
          equipment,
          excludeRequestId
        });
        
        if (!active) return;
        if (response.data.success) {
          setConflicts(response.data.data.conflicts);
          setLastChecked(requestKey);
        } else {
          throw new Error('Conflict check failed');
        }
      } catch (err) {
        if (!active) return;
        console.error('Conflict check error:', err);
        setError(err instanceof Error ? err.message : 'Failed to check equipment conflicts');
        setConflicts([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    // Debounce the request to avoid too many API calls
    const timeoutId = setTimeout(fetchConflicts, 500);
    
    return () => { active = false; clearTimeout(timeoutId); };
  }, [hasRequiredData, requestKey, lastChecked, academicYearId, termId, date, timeStart, timeEnd, equipment, excludeRequestId]);

  // Don't render if no required data
  if (!hasRequiredData) {
    return null;
  }

  // Determine status based on conflicts
  const getStatus = () => {
    if (loading || availabilityLoading) return 'waiting';
    if (error) return 'error';
    if (hasEquipmentShortages) return 'danger';
    if (conflicts.length === 0) return 'safe';
    
    // Calculate shortage based on current request vs available quantity
    // This is more accurate than relying on backend shortage calculation
    const hasShortages = equipment.some(eq => {
      const conflict = conflicts.find(c => c.equipmentId === eq.equipmentId);
      if (conflict) {
        const actualShortage = eq.quantity - conflict.availableQuantity;
        return actualShortage > 0;
      }
      return false;
    });
    
    return hasShortages ? 'danger' : 'warning';
  };

  const status = getStatus();
  const token = statusTokens[status];
  const hasDetails = conflicts.length > 0;
  const requestedAvailability = equipment
    .map((requestedItem) => {
      const itemAvailability = availability?.find((item) => item.id === requestedItem.equipmentId);
      if (!itemAvailability) return null;

      return {
        ...itemAvailability,
        requested: requestedItem.quantity,
      };
    })
    .filter((item): item is EquipmentAvailabilitySummary & { requested: number } => Boolean(item));

  const statusDescription = (() => {
    if (loading || availabilityLoading) {
      return 'Checking requested quantities and overlapping reservations…';
    }
    if (error) {
      return 'The reservation check could not be completed.';
    }
    if (hasEquipmentShortages) {
      return 'One or more requested quantities are unavailable for this time slot.';
    }
    if (status === 'warning') {
      return 'Other requests overlap this time slot, but the requested quantities remain available.';
    }
    return 'All requested quantities are available with no overlapping reservations.';
  })();

  return (
    <>
      {/* Compact Status Card */}
      <div
        className={`rounded-2xl border border-[#e5e7eb] px-4 py-3 ${token.bg} ${className}`}
        data-testid="status-equipment-check"
      >
        <div className="flex items-start justify-between gap-4">
          <div className={`flex items-start gap-2 ${token.text}`}>
            <span aria-hidden className="mt-0.5">{token.icon}</span>
            <div>
              <p className="text-sm font-semibold">{token.label}</p>
              <p className="mt-1 text-xs font-medium opacity-90" data-testid="text-equipment-check-summary">
                {statusDescription}
              </p>
            </div>
          </div>
          {hasDetails && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="shrink-0 text-xs font-semibold text-[#800000] underline"
              data-testid="button-view-equipment-details"
            >
              View details
            </button>
          )}
        </div>

        {requestedAvailability.length > 0 && !loading && !availabilityLoading && (
          <div className="mt-3 space-y-1.5 border-t border-black/5 pt-2.5" data-testid="list-equipment-availability">
            {requestedAvailability.map((item) => {
              const isShort = item.available < item.requested;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 text-xs"
                  data-testid={`row-equipment-availability-${item.id}`}
                >
                  <span className="truncate font-medium">{item.name}</span>
                  <span className={`shrink-0 font-semibold ${isShort ? 'text-red-700' : 'text-green-700'}`}>
                    {item.available} of {item.requested} available
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Conflict Details Modal */}
      {showModal && (
        <ConflictDetailModal 
          conflicts={conflicts}
          currentRequestEquipment={equipment}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
