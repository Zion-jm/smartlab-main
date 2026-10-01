import { Minus, Plus, X, Info } from 'lucide-react';
import type { EquipmentAvailability } from '../../hooks/useEquipmentAvailability';
import { getEquipmentStatusColors, type EquipmentStatus } from '../../utils/equipmentStatus';

export interface EquipmentCardData {
  id: string;
  name: string;
  totalQuantity: number;
  isSelected: boolean;
  selectedQuantity: number;
  effectiveAvailable: number;
  availability?: EquipmentAvailability;
}

interface EquipmentCardProps {
  equipment: EquipmentCardData;
  compact?: boolean;
  onChange: (equipmentId: string, quantity: number, max: number) => void;
  onClear: (equipmentId: string) => void;
  onViewDetails: (equipment: EquipmentCardData) => void;
}

const STATUS_MESSAGE: Record<EquipmentStatus, (available: number) => string> = {
  available: () => '✅ Plenty available',
  limited: () => '⚠️ Limited - Book soon',
  critical: (available) => `🔥 Only ${available} left`,
  unavailable: () => '❌ Not available',
};

/**
 * A single equipment row/card used by both the compact and full layouts of
 * UnifiedEquipmentSection. Renders selection controls, live availability, and a
 * shortcut into the reservation-conflict detail modal.
 */
export default function EquipmentCard({ equipment: eq, compact = false, onChange, onClear, onViewDetails }: EquipmentCardProps) {
  const avail = eq.availability;
  const isDisabled = eq.effectiveAvailable === 0;
  const { status, colors } = getEquipmentStatusColors(avail, eq.effectiveAvailable);

  const checkboxSize = compact ? 'h-3 w-3' : '';
  const infoIconSize = compact ? 'h-3 w-3' : 'h-4 w-4';
  const labelSize = compact ? 'text-xs' : 'text-sm';

  return (
    <div
      className={`border rounded-lg transition-all ${compact ? 'p-2' : 'p-3'} ${
        eq.isSelected
          ? `${colors.bg} ${colors.border} ${compact ? '' : 'shadow-sm'}`
          : isDisabled
          ? 'bg-gray-50 border-gray-200 opacity-60'
          : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-gray-50'
      }`}
    >
      <div className={`flex items-center justify-between ${compact ? '' : 'mb-2'}`}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input
            type="checkbox"
            id={`equipment-${eq.id}${compact ? '-compact' : ''}`}
            checked={eq.isSelected}
            disabled={isDisabled}
            onChange={(e) => {
              if (e.target.checked && !isDisabled) {
                onChange(eq.id, 1, eq.effectiveAvailable);
              } else {
                onClear(eq.id);
              }
            }}
            className={`rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0 ${checkboxSize} ${
              isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
            }`}
          />
          <label
            htmlFor={`equipment-${eq.id}${compact ? '-compact' : ''}`}
            className={`font-medium text-gray-700 truncate ${labelSize} ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            title={eq.name}
          >
            {eq.name}
          </label>
          <button
            type="button"
            onClick={() => onViewDetails(eq)}
            className="shrink-0 text-gray-400 hover:text-blue-600 transition-colors"
            title="View reservation details"
          >
            <Info className={infoIconSize} />
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {eq.isSelected ? (
            <div className={`flex items-center gap-1 ${compact ? '' : 'bg-white rounded border border-gray-300 px-2 py-1'}`}>
              <button
                type="button"
                onClick={() => onChange(eq.id, Math.max(1, eq.selectedQuantity - 1), eq.effectiveAvailable)}
                className={`rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors ${
                  compact ? 'w-4 h-4' : 'w-5 h-5'
                }`}
              >
                <Minus className={compact ? 'h-2 w-2' : 'h-2.5 w-2.5'} />
              </button>
              <span className={`font-medium text-gray-800 text-center ${compact ? 'text-xs w-6' : 'text-sm min-w-[2ch]'}`}>
                {eq.selectedQuantity}
              </span>
              <button
                type="button"
                onClick={() => onChange(eq.id, Math.min(eq.selectedQuantity + 1, eq.effectiveAvailable), eq.effectiveAvailable)}
                disabled={eq.selectedQuantity >= eq.effectiveAvailable}
                className={`rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  compact ? 'w-4 h-4' : 'w-5 h-5'
                }`}
              >
                <Plus className={compact ? 'h-2 w-2' : 'h-2.5 w-2.5'} />
              </button>
              {!compact && (
                <button
                  type="button"
                  onClick={() => onClear(eq.id)}
                  className="w-5 h-5 rounded bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors ml-1"
                >
                  <X className="h-2.5 w-2.5 text-red-600" />
                </button>
              )}
            </div>
          ) : (
            !compact &&
            !isDisabled && (
              <button
                type="button"
                onClick={() => onChange(eq.id, 1, eq.effectiveAvailable)}
                className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
              >
                Select
              </button>
            )
          )}
        </div>
      </div>

      {avail && compact && (
        <div className="flex items-center gap-2 mt-1">
          <div className="flex items-center gap-1">
            <div className={`w-8 h-1 rounded ${colors.progress}`} />
            <span className="text-xs text-gray-600">{avail.percentage}%</span>
          </div>
          <span className="text-xs text-gray-500">{avail.available} of {avail.total} available</span>
        </div>
      )}

      {avail && !compact && (
        <>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${colors.text}`}>{colors.label}</span>
              <span className={`text-xs font-medium ${colors.text}`}>{avail.percentage.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div className={`${colors.progress} h-1.5 rounded-full transition-all duration-300`} style={{ width: `${avail.percentage}%` }} />
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>Avail: {avail.available}</span>
              <span>Used: {avail.used}</span>
              <span>Total: {avail.total}</span>
            </div>
          </div>
          <div className={`mt-2 p-1.5 rounded text-xs ${colors.bg} ${colors.text}`}>
            <p>{STATUS_MESSAGE[status](avail.available)}</p>
          </div>
        </>
      )}
    </div>
  );
}
