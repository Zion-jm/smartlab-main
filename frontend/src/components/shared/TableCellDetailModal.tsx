import React from 'react';

type TableCellDetailModalProps<T = Record<string, unknown>> = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  data: T;
  status?: string;
  statusBadge?: string;
  fields: {
    label: string;
    key: keyof T;
    formatter?: (value: unknown, data?: T) => string | React.ReactNode;
    condition?: (value: unknown) => boolean;
    fullWidth?: boolean;
  }[];
  actions?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'default' | 'danger' | 'success' | 'warning';
    disabled?: boolean;
  }[];
};

export default function TableCellDetailModal<T = Record<string, unknown>>({
  isOpen,
  onClose,
  title,
  subtitle,
  data,
  status,
  statusBadge,
  fields,
  actions = [],
}: TableCellDetailModalProps<T>) {
  if (!isOpen) return null;

  const renderFieldValue = (field: typeof fields[0]) => {
    const value = data[field.key];
    
    // Check condition if provided
    if (field.condition && !field.condition(value)) {
      return null;
    }
    
    // Use formatter if provided, otherwise convert to string
    if (field.formatter) {
      return field.formatter(value, data);
    }
    
    if (value === null || value === undefined || value === '') {
      return <span className="text-gray-400">—</span>;
    }
    
    return String(value);
  };

  const requester = data as unknown as {
    requesterName?: string;
    requesterRole?: string;
    requesterEmail?: string;
  };

  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('pending')) return 'bg-yellow-100 text-yellow-800';
    if (statusLower.includes('approved')) return 'bg-green-100 text-green-800';
    if (statusLower.includes('rejected') || statusLower.includes('declined')) return 'bg-red-100 text-red-800';
    if (statusLower.includes('borrowed')) return 'bg-blue-100 text-blue-800';
    if (statusLower.includes('returned')) return 'bg-purple-100 text-purple-800';
    if (statusLower.includes('cancelled')) return 'bg-gray-100 text-gray-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getActionVariant = (variant?: string) => {
    switch (variant) {
      case 'primary': return 'bg-red-800 text-white hover:bg-red-700';
      case 'danger': return 'bg-red-600 text-white hover:bg-red-500';
      case 'success': return 'bg-green-600 text-white hover:bg-green-500';
      case 'warning': return 'bg-yellow-600 text-white hover:bg-yellow-500';
      default: return 'bg-gray-600 text-white hover:bg-gray-500';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-60 backdrop-blur-[1px] px-4" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden max-h-[90vh]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-orange-50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-red-800">{subtitle}</span>
            {statusBadge && (
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(status)}`}>
                {statusBadge}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-light transition-colors"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          <h3 className="text-base font-bold text-gray-900 mb-3">{title}</h3>
          
          {/* Requester Card */}
          {requester.requesterName && (
            <div className="flex items-center gap-3 p-2.5 bg-red-50 border border-red-100 rounded-lg mb-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-700 to-red-800 text-yellow-400 flex items-center justify-center font-bold text-xs">
                {requester.requesterName.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 text-sm">{requester.requesterName}</div>
                <div className="text-xs text-gray-500 truncate">
                  {requester.requesterRole} • {requester.requesterEmail}
                </div>
              </div>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {fields.map((field, index) => {
              const renderedValue = renderFieldValue(field);
              if (renderedValue === null) return null;
              
              return (
                <div 
                  key={index} 
                  className={`${field.fullWidth ? 'col-span-2' : 'col-span-1'}`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-orange-700 uppercase tracking-wider">
                      {field.label}
                    </span>
                    <div className="text-xs font-medium text-gray-700">
                      {renderedValue}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        {actions.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-200 flex flex-wrap gap-2 justify-end bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            {actions.map((action, index) => (
              <button
                key={index}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  action.disabled
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : getActionVariant(action.variant)
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
