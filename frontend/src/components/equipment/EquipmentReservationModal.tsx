import React from 'react';
import { X, Clock, User, Calendar } from 'lucide-react';

interface ConflictRequest {
  requestId: string;
  facultyName: string;
  quantity: number;
  timeStart: string;
  timeEnd: string;
  purpose: string;
  status: string;
}

interface EquipmentReservationModalProps {
  equipmentName: string;
  totalQuantity: number;
  conflictingRequests: ConflictRequest[];
  onClose: () => void;
}

export function EquipmentReservationModal({
  equipmentName,
  totalQuantity,
  conflictingRequests,
  onClose
}: EquipmentReservationModalProps) {
  
  // Group requests by time slots and separate approved vs pending
  const { approvedRequests, pendingRequests } = React.useMemo(() => {
    const approved: ConflictRequest[] = [];
    const pending: ConflictRequest[] = [];
    
    conflictingRequests.forEach(request => {
      if (request.status === 'APPROVED') {
        approved.push(request);
      } else if (request.status === 'PENDING') {
        pending.push(request);
      }
    });
    
    return { approvedRequests: approved, pendingRequests: pending };
  }, [conflictingRequests]);

  const groupedApproved = React.useMemo(() => {
    const groups = new Map<string, ConflictRequest[]>();
    
    approvedRequests.forEach(request => {
      const timeSlot = `${request.timeStart} - ${request.timeEnd}`;
      if (!groups.has(timeSlot)) {
        groups.set(timeSlot, []);
      }
      groups.get(timeSlot)!.push(request);
    });
    
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [approvedRequests]);

  const groupedPending = React.useMemo(() => {
    const groups = new Map<string, ConflictRequest[]>();
    
    pendingRequests.forEach(request => {
      const timeSlot = `${request.timeStart} - ${request.timeEnd}`;
      if (!groups.has(timeSlot)) {
        groups.set(timeSlot, []);
      }
      groups.get(timeSlot)!.push(request);
    });
    
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [pendingRequests]);

  const totalReserved = approvedRequests.reduce((sum, req) => sum + req.quantity, 0);
  const totalPending = pendingRequests.reduce((sum, req) => sum + req.quantity, 0);
  const available = totalQuantity - totalReserved;

  const statusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Equipment Reservation Details</p>
            <p className="text-xs text-gray-500">{equipmentName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Summary */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-sm font-medium text-gray-900">Availability Summary</span>
            </div>
            <div className="text-right">
              <span className={`text-sm font-bold ${
                available > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {available} of {totalQuantity} available
              </span>
            </div>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all ${
                available > 0 ? 'bg-green-500' : 'bg-red-500'
              }`}
              style={{ width: `${(available / totalQuantity) * 100}%` }}
            ></div>
          </div>
          
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <span>
              {totalReserved} unit{totalReserved !== 1 ? 's' : ''} reserved by {approvedRequests.length} approved request{approvedRequests.length !== 1 ? 's' : ''}
            </span>
            {totalPending > 0 && (
              <span className="text-yellow-600 font-medium">
                +{totalPending} unit{totalPending !== 1 ? 's' : ''} pending
              </span>
            )}
          </div>
        </div>

        {/* Reservation Details */}
        <div className="px-5 py-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            Reservation Schedule
          </h4>
          
          {groupedApproved.length === 0 && groupedPending.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">All units available</p>
              <p className="text-xs text-gray-500">No reservations for this time period</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Approved Requests */}
              {groupedApproved.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Approved Reservations
                  </h5>
                  <div className="space-y-3">
                    {groupedApproved.map(([timeSlot, requests]) => (
                      <div key={timeSlot} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {timeSlot}
                          </span>
                          <span className="text-xs text-gray-500">
                            {requests.reduce((sum: number, req: ConflictRequest) => sum + req.quantity, 0)} unit{requests.reduce((sum: number, req: ConflictRequest) => sum + req.quantity, 0) !== 1 ? 's' : ''} reserved
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          {requests.map((request: ConflictRequest, index: number) => (
                            <div key={`${request.requestId}-${index}`} className="bg-white rounded border border-gray-200 p-2">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <User className="h-3 w-3 text-gray-400" />
                                  <span className="text-xs font-medium text-gray-900">{request.facultyName}</span>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(request.status)}`}>
                                  {request.status}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 mb-1">
                                Quantity: <span className="font-medium">{request.quantity}</span> unit{request.quantity !== 1 ? 's' : ''}
                              </p>
                              {request.purpose && (
                                <p className="text-xs text-gray-500 italic">
                                  Purpose: {request.purpose}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending Requests */}
              {groupedPending.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-yellow-700 mb-2 flex items-center gap-1">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    Pending Requests (not affecting availability)
                  </h5>
                  <div className="space-y-3">
                    {groupedPending.map(([timeSlot, requests]) => (
                      <div key={timeSlot} className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {timeSlot}
                          </span>
                          <span className="text-xs text-yellow-600 font-medium">
                            {requests.reduce((sum: number, req: ConflictRequest) => sum + req.quantity, 0)} unit{requests.reduce((sum: number, req: ConflictRequest) => sum + req.quantity, 0) !== 1 ? 's' : ''} pending
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          {requests.map((request: ConflictRequest, index: number) => (
                            <div key={`${request.requestId}-${index}`} className="bg-white rounded border border-yellow-200 p-2">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <User className="h-3 w-3 text-gray-400" />
                                  <span className="text-xs font-medium text-gray-900">{request.facultyName}</span>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(request.status)}`}>
                                  {request.status}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 mb-1">
                                Quantity: <span className="font-medium">{request.quantity}</span> unit{request.quantity !== 1 ? 's' : ''}
                              </p>
                              {request.purpose && (
                                <p className="text-xs text-gray-500 italic">
                                  Purpose: {request.purpose}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 rounded-b-2xl">
          <p className="text-xs text-gray-500 text-center">
            Try adjusting your time to avoid conflicts with existing reservations
          </p>
        </div>
      </div>
    </div>
  );
}
