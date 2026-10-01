import { useState } from 'react';
import { ChevronDown, ChevronUp, Users, Clock, Package, AlertTriangle, Calendar } from 'lucide-react';

interface ConflictRequest {
  requestId: string;
  redacted?: boolean;
  requesterName: string;
  requesterEmail?: string;
  quantity: number;
  timeStart: string;
  timeEnd: string;
  purpose?: string;
  status: string;
  dateNeeded: string;
}

interface ConflictWarningListProps {
  conflicts: Array<{
    equipmentId: string;
    equipmentName: string;
    requestedQuantity: number;
    availableQuantity: number;
    totalQuantity: number;
    shortage: number;
    conflictingRequests: ConflictRequest[];
  }>;
  className?: string;
  compact?: boolean;
  showEquipmentDetails?: boolean;
}

interface ExpandedState {
  [key: string]: boolean;
}

export default function ConflictWarningList({
  conflicts,
  className = '',
  showEquipmentDetails = true
}: ConflictWarningListProps) {
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const toggleExpanded = (key: string) => {
    setExpanded(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Group conflicts by equipment
  const groupedConflicts = conflicts.reduce((groups, conflict) => {
    if (!groups[conflict.equipmentId]) {
      groups[conflict.equipmentId] = {
        equipment: conflict,
        requests: []
      };
    }
    groups[conflict.equipmentId].requests.push(...conflict.conflictingRequests);
    return groups;
  }, {} as Record<string, { equipment: typeof conflicts[0]; requests: ConflictRequest[] }>);

  // Sort equipment by severity (shortage amount)
  const sortedConflicts = Object.values(groupedConflicts).sort((a, b) => 
    b.equipment.shortage - a.equipment.shortage
  );

  if (conflicts.length === 0) {
    return null;
  }

  return (
    <div className={`bg-yellow-50 border border-yellow-200 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-yellow-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <h3 className="text-sm font-semibold text-yellow-800">
                Equipment Conflicts
              </h3>
              <p className="text-xs text-yellow-600">
                {conflicts.length} equipment item{conflicts.length > 1 ? 's have' : 'has'} conflicts
              </p>
            </div>
          </div>
          
          {/* Summary Badge */}
          <div className="flex items-center gap-2">
            <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-medium">
              {Object.values(groupedConflicts).reduce((total, group) => total + group.requests.length, 0)} requests
            </div>
            <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-medium">
              {conflicts.reduce((total, conflict) => total + conflict.shortage, 0)} items shortage
            </div>
          </div>
        </div>
      </div>

      {/* Conflict List */}
      <div className="divide-y divide-yellow-200">
        {sortedConflicts.map((group, index) => {
          const { equipment, requests } = group;
          const isExpanded = expanded[equipment.equipmentId] || false;
          const uniqueKey = `${equipment.equipmentId}-${index}`;

          return (
            <div key={uniqueKey} className="p-4">
              {/* Equipment Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Package className="h-4 w-4 text-yellow-600" />
                  <div>
                    <h4 className="text-sm font-medium text-gray-800">
                      {equipment.equipmentName}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>Requested: {equipment.requestedQuantity}</span>
                      <span>Available: {equipment.availableQuantity}</span>
                      <span className="text-red-600 font-medium">
                        Shortage: -{equipment.shortage}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expand/Collapse Button */}
                <button
                  onClick={() => toggleExpanded(uniqueKey)}
                  className="flex items-center gap-1 text-yellow-600 hover:text-yellow-800 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <span className="text-xs font-medium">
                    {isExpanded ? 'Hide' : 'Show'} {requests.length} request{requests.length > 1 ? 's' : ''}
                  </span>
                </button>
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.min(100, (equipment.requestedQuantity / equipment.totalQuantity) * 100)}%` 
                    }}
                  />
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="space-y-2">
                  {/* Request List */}
                  <div className="space-y-2">
                    {requests.map((request, reqIndex) => (
                      <div
                        key={`${request.requestId}-${reqIndex}`}
                        className="bg-white border border-yellow-300 rounded-lg p-3"
                      >
                        {/* Request Header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Users className="h-3 w-3 text-yellow-600" />
                            <span className="text-sm font-medium text-gray-800">
                              {request.requesterName}
                            </span>
                            <span className="text-xs text-gray-500">
                              {request.requesterEmail ? '(' + request.requesterEmail + ')' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Package className="h-3 w-3" />
                            <span className="font-medium text-yellow-600">
                              {request.quantity} items
                            </span>
                          </div>
                        </div>

                        {/* Request Details */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-gray-400" />
                            <span className="text-gray-600">
                              {request.timeStart} - {request.timeEnd}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-gray-400" />
                            <span className="text-gray-600">
                              {new Date(request.dateNeeded).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}
                            </span>
                          </div>
                        </div>

                        {/* Purpose */}
                        {request.purpose && (
                          <div className="mt-2">
                            <div className="text-xs font-medium text-gray-700 mb-1">Purpose:</div>
                            <p className="text-xs text-gray-600 bg-gray-50 rounded p-2">
                              {request.purpose}
                            </p>
                          </div>
                        )}

                        {/* Status */}
                        <div className="flex items-center justify-between mt-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            request.status === 'APPROVED' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {request.status}
                          </span>
                          {!request.redacted && <span className="text-xs text-gray-500">
                            Request ID: {request.requestId.slice(0, 8)}...
                          </span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Equipment Details */}
                  {showEquipmentDetails && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <h5 className="text-xs font-medium text-yellow-800 mb-2">Equipment Details:</h5>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <div className="font-medium text-gray-800">{equipment.totalQuantity}</div>
                          <div className="text-gray-500">Total</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-yellow-600">{equipment.availableQuantity}</div>
                          <div className="text-gray-500">Available</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-red-600">{equipment.shortage}</div>
                          <div className="text-gray-500">Shortage</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Suggestion */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-3 w-3 text-blue-600" />
                      <h5 className="text-xs font-medium text-blue-800">Resolution Options:</h5>
                    </div>
                    <ul className="text-xs text-blue-700 space-y-1">
                      <li>• Choose a different time slot</li>
                      <li>• Reduce quantity to {equipment.availableQuantity} items</li>
                      <li>• Select alternative equipment</li>
                      <li>• Contact requesters to coordinate usage</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-yellow-200 bg-yellow-50">
        <div className="flex items-center justify-between text-xs">
          <div className="text-yellow-700">
            <strong>Summary:</strong> {conflicts.length} equipment conflicts affecting{' '}
            {Object.values(groupedConflicts).reduce((total, group) => total + group.requests.length, 0)} pending requests
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-yellow-600 hover:text-yellow-800 underline"
          >
            Refresh Data
          </button>
        </div>
      </div>
    </div>
  );
}

// Compact version for inline display
export function CompactConflictWarning({ conflicts, className = '' }: { conflicts: ConflictWarningListProps['conflicts']; className?: string }) {
  if (conflicts.length === 0) return null;

  const totalShortage = conflicts.reduce((total, conflict) => total + conflict.shortage, 0);
  const totalRequests = conflicts.reduce((total, conflict) => total + conflict.conflictingRequests.length, 0);

  return (
    <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <span className="text-sm font-medium text-yellow-800">
            {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full">
            -{totalShortage} items
          </span>
          <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
            {totalRequests} requests
          </span>
        </div>
      </div>
    </div>
  );
}
