import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { directoryApi } from '../../services/api';
import type {
  DirectoryBuilding,
  DirectoryDepartment,
  DirectoryProgram,
  DirectoryRoom,
  DirectorySubject,
} from '../../types/academicDirectory';
import { toast } from '../../stores/toastStore';

export type DirectoryEntity = 'buildings' | 'rooms' | 'programs' | 'subjects' | 'departments';

type DrawerMode = 'create' | 'edit';

type DrawerRecord =
  | DirectoryBuilding
  | DirectoryRoom
  | DirectoryProgram
  | DirectorySubject
  | DirectoryDepartment
  | null;

interface DirectoryDrawerProps {
  entity: DirectoryEntity;
  mode: DrawerMode;
  record?: DrawerRecord;
  buildings?: DirectoryBuilding[];
  onClose: () => void;
  onSuccess?: () => void;
}

type SubmitState = {
  error: string | null;
  loading: boolean;
};

const entityMeta: Record<DirectoryEntity, { singular: string; title: string }> = {
  buildings: { singular: 'Building', title: 'Manage building' },
  rooms: { singular: 'Room', title: 'Manage room' },
  programs: { singular: 'Program', title: 'Manage program' },
  subjects: { singular: 'Subject', title: 'Manage subject' },
  departments: { singular: 'Department', title: 'Manage department' },
};

const DrawerSection = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-[#374151] mb-1">{label}</label>
    {children}
  </div>
);

export default function DirectoryDrawer({ entity, mode, record = null, buildings = [], onClose, onSuccess }: DirectoryDrawerProps) {
  const [formValues, setFormValues] = useState(() => {
    switch (entity) {
      case 'buildings':
        return { name: record && 'name' in record ? record.name : '' };
      case 'rooms': {
        const room = record as DirectoryRoom | null;
        return {
          roomNumber: room?.roomNumber ?? '',
          roomName: room?.roomName ?? '',
          buildingId: room?.buildingId ?? '',
          isComputerLab: room?.isComputerLab ?? false,
        };
      }
      case 'programs': {
        const program = record as DirectoryProgram | null;
        return {
          code: program?.code ?? '',
          name: program?.name ?? '',
        };
      }
      case 'subjects': {
        const subject = record as DirectorySubject | null;
        return {
          code: subject?.code ?? '',
          name: subject?.name ?? '',
        };
      }
      case 'departments': {
        const department = record as DirectoryDepartment | null;
        return {
          name: department?.name ?? '',
        };
      }
      default:
        return {};
    }
  });

  const [submitState, setSubmitState] = useState<SubmitState>({ error: null, loading: false });

  const title = useMemo(() => {
    const action = mode === 'create' ? 'Add' : 'Edit';
    return `${action} ${entityMeta[entity].singular}`;
  }, [entity, mode]);

  const handleInput = (name: string, value: string | boolean) => {
    setFormValues((prev: Record<string, unknown>) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const fail = (message: string) => {
      setSubmitState({ loading: false, error: message });
    };

    setSubmitState({ loading: true, error: null });
    try {
      if (entity === 'buildings') {
        const payload = { name: String(formValues.name ?? '').trim() };
        if (!payload.name) return fail('Building name is required.');
        if (mode === 'create') await directoryApi.createBuilding(payload);
        else await directoryApi.updateBuilding((record as DirectoryBuilding).id, payload);
      } else if (entity === 'rooms') {
        const roomNumber = String(formValues.roomNumber ?? '').trim();
        const roomNameValue = String(formValues.roomName ?? '').trim();
        const payload = {
          roomNumber: roomNumber || null,
          roomName: roomNameValue || null,
          buildingId: formValues.buildingId ? String(formValues.buildingId) : null,
          isComputerLab: Boolean(formValues.isComputerLab),
        };
        if (!payload.roomNumber && !payload.roomName) return fail('Room number or room name is required.');
        if (mode === 'create') await directoryApi.createRoom(payload);
        else await directoryApi.updateRoom((record as DirectoryRoom).id, payload);
      } else if (entity === 'programs') {
        const payload = {
          code: String(formValues.code ?? '').trim().toUpperCase(),
          name: String(formValues.name ?? '').trim(),
        };
        if (!payload.code || !payload.name) return fail('Program code and name are required.');
        if (mode === 'create') await directoryApi.createProgram(payload);
        else await directoryApi.updateProgram((record as DirectoryProgram).id, payload);
      } else if (entity === 'subjects') {
        const payload = {
          code: String(formValues.code ?? '').trim().toUpperCase(),
          name: String(formValues.name ?? '').trim(),
        };
        if (!payload.code || !payload.name) return fail('Subject code and name are required.');
        if (mode === 'create') await directoryApi.createSubject(payload);
        else await directoryApi.updateSubject((record as DirectorySubject).id, payload);
      } else if (entity === 'departments') {
        const payload = { name: String(formValues.name ?? '').trim() };
        if (!payload.name) return fail('Department name is required.');
        if (mode === 'create') await directoryApi.createDepartment(payload);
        else await directoryApi.updateDepartment((record as DirectoryDepartment).id, payload);
      }

      setSubmitState({ loading: false, error: null });
      toast.success(`${entityMeta[entity].singular} ${mode === 'create' ? 'added' : 'updated'} successfully.`);
      onSuccess?.();
    } catch (error) {
      console.error('DirectoryDrawer submission error:', error);
      const message =
        typeof error === 'object' && error && 'response' in error
          ? ((error as { response?: { data?: { error?: string; message?: string } } }).response?.data?.message ??
              (error as { response?: { data?: { error?: string; message?: string } } }).response?.data?.error ??
              'Failed to save record.')
          : 'Failed to save record.';
      setSubmitState({ loading: false, error: message });
      toast.error(message);
    }
  };

  const buildingOptions = buildings.map((building) => ({
    label: building.name,
    value: building.id,
  }));

  return (
    <div className="admin-mobile-drawer fixed inset-0 z-50 h-dvh">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-[#f3f4f6] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#111827]">{title}</p>
            <p className="text-xs text-[#6b7280]">{entityMeta[entity].title}</p>
          </div>
          <button className="text-[#6b7280] hover:text-[#111827]" type="button" onClick={onClose}>
            ✕
          </button>
        </div>
        <form className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4" onSubmit={handleSubmit}>
          {entity === 'buildings' && (
            <DrawerSection label="Building name">
              <input
                type="text"
                value={String(formValues.name ?? '')}
                onChange={(event) => handleInput('name', event.target.value)}
                required
                className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#800000]"
                placeholder="e.g., Engineering Building"
              />
            </DrawerSection>
          )}

          {entity === 'rooms' && (
            <>
              <DrawerSection label="Room number (optional)">
                <input
                  type="text"
                  value={String(formValues.roomNumber ?? '')}
                  onChange={(event) => handleInput('roomNumber', event.target.value)}
                  className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#800000]"
                  placeholder="e.g., LAB-101"
                />
              </DrawerSection>
              <DrawerSection label="Room name (provide at least a number or a name)">
                <input
                  type="text"
                  value={String(formValues.roomName ?? '')}
                  onChange={(event) => handleInput('roomName', event.target.value)}
                  className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#800000]"
                  placeholder="e.g., Computer Laboratory 1"
                />
              </DrawerSection>
              <DrawerSection label="Building">
                <select
                  value={String(formValues.buildingId ?? '')}
                  onChange={(event) => handleInput('buildingId', event.target.value)}
                  className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#800000]"
                >
                  <option value="">Unassigned</option>
                  {buildingOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </DrawerSection>
              <label className="flex items-center gap-2 text-sm text-[#374151]">
                <input
                  type="checkbox"
                  checked={Boolean(formValues.isComputerLab)}
                  onChange={(event) => handleInput('isComputerLab', event.target.checked)}
                  className="rounded border-[#d1d5db] text-[#800000] focus:ring-[#800000]"
                />
                Computer laboratory
              </label>
            </>
          )}

          {(entity === 'programs' || entity === 'subjects') && (
            <>
              <DrawerSection label="Code">
                <input
                  type="text"
                  value={String(formValues.code ?? '')}
                  onChange={(event) => handleInput('code', event.target.value)}
                  required
                  maxLength={16}
                  className="w-full uppercase rounded-xl border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#800000]"
                  placeholder="e.g., BSIT / IT101"
                />
              </DrawerSection>
              <DrawerSection label="Name">
                <input
                  type="text"
                  value={String(formValues.name ?? '')}
                  onChange={(event) => handleInput('name', event.target.value)}
                  required
                  className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#800000]"
                  placeholder="Enter descriptive name"
                />
              </DrawerSection>
            </>
          )}

          {entity === 'departments' && (
            <DrawerSection label="Department name">
              <input
                type="text"
                value={String(formValues.name ?? '')}
                onChange={(event) => handleInput('name', event.target.value)}
                required
                className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#800000]"
                placeholder="e.g., Department of IT"
              />
            </DrawerSection>
          )}

          {submitState.error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{submitState.error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#374151] rounded-full border border-[#e5e7eb]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitState.loading}
              className={`px-4 py-2 text-xs font-semibold text-white rounded-full shadow-[0_4px_12px_rgba(128,0,0,0.25)] ${
                submitState.loading ? 'bg-[#b56565] cursor-not-allowed' : 'bg-[#800000]'
              }`}
            >
              {submitState.loading ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
