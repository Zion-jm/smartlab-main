import { isAxiosError } from 'axios';
import { useMemo, useState, type FormEvent } from 'react';
import { equipmentApi } from '../../services/api';
import type { EquipmentItem, EquipmentStatus } from '../../types/equipment';
import { toast } from '../../stores/toastStore';
import SidebarDrawer from '../shared/SidebarDrawer';
import { PackagePlus, Pencil } from 'lucide-react';

export type EquipmentDrawerMode = 'create' | 'edit';

interface EquipmentDrawerProps {
  open: boolean;
  mode: EquipmentDrawerMode;
  record?: EquipmentItem | null;
  onClose: () => void;
  onSaved?: () => void;
}

const MAX_TOTAL_QUANTITY = 2147483647;


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
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const stockChanged = !isCreateMode && !!record && (formValues.totalQuantity !== record.totalQuantity || formValues.damagedQuantity !== record.damagedQuantity);
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
    setAdjustmentReason('');
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
    if (formValues.name.trim().replace(/\s+/g, ' ').length > 150) return 'Equipment name must be at most 150 characters.';
    if (formValues.description.length > 1000) return 'Description must be at most 1000 characters.';
    if (formValues.totalQuantity > MAX_TOTAL_QUANTITY || formValues.damagedQuantity > MAX_TOTAL_QUANTITY) return 'Quantity exceeds the supported limit.';
    if (stockChanged && !adjustmentReason.trim()) return 'Explain why the stock quantity is changing.';
    if (adjustmentReason.length > 500) return 'Stock adjustment reason must be at most 500 characters.';
    return null;
  };

  const handleInputChange = (field: keyof typeof formValues, value: string | number) => {
    if (field === 'totalQuantity' || field === 'borrowedQuantity' || field === 'damagedQuantity') {
      const parsedValue = typeof value === 'number' ? value : Number(value);
      setFormValues((prev) => ({ ...prev, [field]: parsedValue }));
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
        await equipmentApi.update(record.id, { ...payload, expectedUpdatedAt: record.updatedAt, adjustmentReason: stockChanged ? adjustmentReason.trim() : undefined });
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
  const formId = 'equipment-sidebar-form';

  return (
    <SidebarDrawer title={mode==='create'?'Add equipment':'Edit equipment'} subtitle="Maintain inventory accuracy and availability." icon={mode==='create'?<PackagePlus size={23} strokeWidth={1.75}/>:<Pencil size={22} strokeWidth={1.75}/>} badge={record?.retiredAt?<span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-800">Archived</span>:undefined} onClose={onClose} closeDisabled={submitting} labelledBy="equipment-drawer-title" footer={<><button type="button" onClick={onClose} disabled={submitting} className="min-h-11 rounded-full border border-[#e5e7eb] px-5 text-sm font-semibold text-[#374151] disabled:opacity-50">Cancel</button><button type="submit" form={formId} disabled={submitting} className={`min-h-11 rounded-full px-5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(128,0,0,0.25)] ${submitting?'cursor-not-allowed bg-[#b56565]':'bg-[#800000] hover:bg-[#680000]'}`}>{submitting?'Saving…':mode==='create'?'Add equipment':'Save changes'}</button></>}>
        {record?.retiredAt && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Archived. Stock edits will not restore this item; use Restore in the equipment list.</p>}
        <form id={formId} className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1">Equipment name</label>
            <input
              type="text"
              maxLength={150}
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
              maxLength={1000}
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
          {stockChanged && <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1" htmlFor="equipment-adjustment-reason">Stock adjustment reason</label>
            <textarea id="equipment-adjustment-reason" value={adjustmentReason} onChange={event => setAdjustmentReason(event.target.value)} maxLength={500} required rows={3}
              placeholder="e.g., Two units damaged during inspection"
              className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2 text-sm" />
          </div>}
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
        </form>
    </SidebarDrawer>
  );
}
