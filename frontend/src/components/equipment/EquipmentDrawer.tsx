import { isAxiosError } from 'axios';
import { useMemo, useState, type FormEvent } from 'react';
import { equipmentApi } from '../../services/api';
import type { EquipmentItem, EquipmentStatus } from '../../types/equipment';
import { toast } from '../../stores/toastStore';

export type EquipmentDrawerMode = 'create' | 'edit';

interface EquipmentDrawerProps {
  open: boolean;
  mode: EquipmentDrawerMode;
  record?: EquipmentItem | null;
  onClose: () => void;
  onSaved?: () => void;
}

const MAX_TOTAL_QUANTITY = 9999;

const clampValue = (value: number, min: number, max?: number) => {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (typeof max === 'number' && value > max) return max;
  return value;
};

export default function EquipmentDrawer({ open, mode, record = null, onClose, onSaved }: EquipmentDrawerProps) {
  const isCreateMode = mode === 'create';
  const [formValues, setFormValues] = useState({
    name: '',
    description: '',
    totalQuantity: 0,
    borrowedQuantity: 0,
    damagedQuantity: 0,
    status: 'AVAILABLE' as EquipmentStatus,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [source, setSource] = useState({ mode, open: false, record });
  if (source.mode !== mode || source.open !== open || source.record !== record) {
    setSource({ mode, open, record });
    if (open) {
    if (mode === 'edit' && record) {
      setFormValues({
        name: record.name,
        description: record.description ?? '',
        totalQuantity: record.totalQuantity,
        borrowedQuantity: record.borrowedQuantity,
        damagedQuantity: record.damagedQuantity,
        status: record.status,
      });
    } else {
      setFormValues({
        name: '',
        description: '',
        totalQuantity: 0,
        borrowedQuantity: 0,
        damagedQuantity: 0,
        status: 'AVAILABLE',
      });
    }
    setError(null);
    }
  }

  const derivedAvailable = useMemo(() => {
    return Math.max(formValues.totalQuantity - formValues.borrowedQuantity - formValues.damagedQuantity, 0);
  }, [formValues]);

  const validateForm = () => {
    if (!formValues.name.trim()) {
      return 'Equipment name is required.';
    }
    if (![formValues.totalQuantity, formValues.borrowedQuantity, formValues.damagedQuantity].every(Number.isInteger)) return 'Stock quantities must be whole numbers.';
    if (formValues.totalQuantity < 0) {
      return 'Total quantity cannot be negative.';
    }
    if (formValues.borrowedQuantity < 0 || formValues.damagedQuantity < 0) {
      return 'Borrowed and damaged quantities cannot be negative.';
    }
    if (formValues.borrowedQuantity + formValues.damagedQuantity > formValues.totalQuantity) {
      return 'Borrowed + damaged cannot exceed total quantity.';
    }
    return null;
  };

  const handleInputChange = (field: keyof typeof formValues, value: string | number) => {
    if (field === 'totalQuantity' || field === 'borrowedQuantity' || field === 'damagedQuantity') {
      const parsedValue = typeof value === 'number' ? value : Number(value);
      setFormValues((prev) => {
        if (field === 'totalQuantity') {
          const safeTotal = clampValue(parsedValue, 0, MAX_TOTAL_QUANTITY);
          const adjustedDamaged = Math.min(prev.damagedQuantity, Math.max(safeTotal - prev.borrowedQuantity, 0));
          return { ...prev, totalQuantity: safeTotal, damagedQuantity: adjustedDamaged };
        }
        if (field === 'damagedQuantity') {
          const maxDamage = Math.max(prev.totalQuantity - prev.borrowedQuantity, 0);
          const safeDamage = clampValue(parsedValue, 0, maxDamage);
          return { ...prev, damagedQuantity: safeDamage };
        }
        const safeNumber = clampValue(parsedValue, 0, prev.totalQuantity || MAX_TOTAL_QUANTITY);
        return { ...prev, [field]: safeNumber };
      });
      return;
    }

    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      name: formValues.name.trim(),
      description: formValues.description?.trim() || null,
      totalQuantity: formValues.totalQuantity,
      borrowedQuantity: formValues.borrowedQuantity,
      damagedQuantity: formValues.damagedQuantity,
    };

    try {
      if (mode === 'create') {
        await equipmentApi.create(payload);
      } else if (record) {
        await equipmentApi.update(record.id, payload);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('EquipmentDrawer submit error', err);
      const apiMessage = isAxiosError(err) ? err.response?.data?.error : undefined;
      const message = typeof apiMessage === 'string' ? apiMessage : 'Failed to save equipment. Please try again.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-[#f3f4f6] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#111827]">{mode === 'create' ? 'Add equipment' : 'Edit equipment'}</p>
            <p className="text-xs text-[#6b7280]">Maintain inventory accuracy and availability.</p>
          </div>
          <button className="text-[#6b7280] hover:text-[#111827]" type="button" onClick={onClose}>
            ✕
          </button>
        </div>
        {record?.retiredAt && <p className="px-5 py-3 text-sm text-amber-800 bg-amber-50">Archived. Stock edits will not restore this item; use Restore in the equipment list.</p>}
        <form className="flex-1 overflow-y-auto px-5 py-4 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1">Equipment name</label>
            <input
              type="text"
              value={formValues.name}
              onChange={(event) => handleInputChange('name', event.target.value)}
              required
              className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#800000]"
              placeholder="e.g., Microscope"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1">Description (optional)</label>
            <textarea
              value={formValues.description}
              onChange={(event) => handleInputChange('description', event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#800000]"
              placeholder="Add context like brand, lab location, etc."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Total quantity</label>
              <input
                type="number"
                min={0}
                max={MAX_TOTAL_QUANTITY}
                value={formValues.totalQuantity}
                onChange={(event) => handleInputChange('totalQuantity', Number(event.target.value))}
                className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#800000]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Stock status (auto)</label>
              <input
                type="text"
                value={derivedAvailable > 0 ? 'Available' : formValues.borrowedQuantity > 0 ? 'Borrowed' : formValues.damagedQuantity > 0 ? 'Damaged' : 'Empty'}
                readOnly
                className="w-full rounded-xl border border-[#f3f4f6] bg-[#f9fafb] px-3 py-2 text-sm text-[#6b7280]"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Borrowed</label>
              <input
                type="number"
                min={0}
                value={formValues.borrowedQuantity}
                readOnly
                className="w-full rounded-xl border border-[#f3f4f6] bg-[#f9fafb] px-3 py-2 text-sm text-[#6b7280]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Damaged</label>
              <input
                type="number"
                min={0}
                value={formValues.damagedQuantity}
                onChange={(event) => !isCreateMode && handleInputChange('damagedQuantity', Number(event.target.value))}
                readOnly={isCreateMode}
                max={Math.max(formValues.totalQuantity - formValues.borrowedQuantity, 0)}
                className={`w-full rounded-xl px-3 py-2 text-sm ${
                  isCreateMode
                    ? 'border border-[#f3f4f6] bg-[#f9fafb] text-[#6b7280]'
                    : 'border border-[#e5e7eb] focus:outline-none focus:ring-2 focus:ring-[#800000]'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Available (auto)</label>
              <input
                type="number"
                value={derivedAvailable}
                readOnly
                min={0}
                className="w-full rounded-xl border border-[#f3f4f6] bg-[#f9fafb] px-3 py-2 text-sm text-[#6b7280]"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
        </form>
        <div className="px-5 py-4 border-t border-[#f3f4f6] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#374151] rounded-full border border-[#e5e7eb]"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-full shadow-[0_4px_12px_rgba(128,0,0,0.25)] ${
              submitting ? 'bg-[#b56565]' : 'bg-[#800000]'
            }`}
          >
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
