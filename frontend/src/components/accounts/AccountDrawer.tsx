import { useMemo, useState } from 'react';
import type { Account } from '../../types/account';
import DropdownField from '../shared/DropdownField';
import { ROLE_VALUE_TO_ID, STATUS_VALUE_TO_ID } from '../../constants/roles';
import { userApi } from '../../services/api';
import { toast } from '../../stores/toastStore';
import { YEAR_LEVELS } from '../../constants/yearLevels';

interface RoleOption {
  label: string;
  value: Account['role'];
}

interface StatusOption {
  label: string;
  value: Account['status'];
}

type SelectOption = {
  label: string;
  value: string;
};

interface AccountDrawerProps {
  account?: Account;
  mode: 'view' | 'edit' | 'create';
  onClose: () => void;
  roleOptions: RoleOption[];
  statusOptions: StatusOption[];
  statusStyles: Record<Account['status'], string>;
  departmentOptions: SelectOption[];
  programOptions: SelectOption[];
  onUpdated?: () => void;
}

export default function AccountDrawer({
  account,
  mode,
  onClose,
  roleOptions,
  statusOptions,
  statusStyles,
  departmentOptions,
  programOptions,
  onUpdated,
}: AccountDrawerProps) {
  const selectableCreateRoles = useMemo(
    () => roleOptions.filter((option) => option.value !== 'ADMIN'),
    [roleOptions]
  );
  const defaultRole =
    account?.role ?? (mode === 'create' ? selectableCreateRoles[0]?.value : roleOptions[0]?.value) ?? 'STUDENT';
  const defaultStatus = statusOptions[0]?.value ?? 'ACTIVE';
  const [formValues, setFormValues] = useState({
    firstName: account?.firstName ?? account?.name?.split(' ')[0] ?? '',
    lastName: account?.lastName ?? account?.name?.split(' ').slice(1).join(' ') ?? '',
    email: account?.email ?? '',
    role: account?.role ?? defaultRole,
    status: account?.status ?? defaultStatus,
    department: account?.departmentId ?? '',
    program: account?.programId ?? '',
    yearLevel: account?.yearLevel ? String(account.yearLevel) : '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isCreate = mode === 'create';
  const isEdit = mode === 'edit';
  const isView = mode === 'view';
  const isFacultyRole = formValues.role === 'FACULTY';
  const isStudentRole = formValues.role === 'STUDENT';

  const departmentPlaceholder = departmentOptions.length > 0 ? 'Select department' : 'No departments available';
  const programPlaceholder = programOptions.length > 0 ? 'Select program' : 'No programs available';
  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (value: Account['role']) => {
    setFormValues((prev) => ({
      ...prev,
      role: value,
      department: value === 'FACULTY' ? prev.department : '',
      program: value === 'STUDENT' ? prev.program : '',
      yearLevel: value === 'STUDENT' ? prev.yearLevel : '',
    }));
  };

  const handleStatusChange = (value: Account['status']) => {
    setFormValues((prev) => ({ ...prev, status: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formValues.firstName || !formValues.lastName) {
      setSubmitError('First and last name are required.');
      return;
    }

    if (isCreate && !formValues.password) {
      setSubmitError('Provide a temporary password for the new account.');
      return;
    }

    if (isFacultyRole && !formValues.department) {
      setSubmitError('Select a department for faculty accounts.');
      return;
    }

    if (isStudentRole && (!formValues.program || !formValues.yearLevel)) {
      setSubmitError('Select program and year level for student accounts.');
      return;
    }

    try {
      setSubmitError(null);
      setIsSubmitting(true);

      const payload: Record<string, unknown> = {
        first_name: formValues.firstName,
        last_name: formValues.lastName,
        full_name: `${formValues.firstName} ${formValues.lastName}`.trim(),
        gmail: formValues.email,
        role_id: ROLE_VALUE_TO_ID[formValues.role],
        status_id: STATUS_VALUE_TO_ID[formValues.status],
      };

      if (isCreate) {
        payload.password = formValues.password;
      }

      if (isFacultyRole) {
        payload.department_id = formValues.department || null;
        payload.program_id = null;
        payload.year = null;
      } else if (isStudentRole) {
        payload.program_id = formValues.program || null;
        payload.year = Number(formValues.yearLevel);
        payload.department_id = null;
      } else {
        payload.department_id = null;
        payload.program_id = null;
        payload.year = null;
      }

      if (isCreate) {
        await userApi.create(payload);
        toast.success('Account created successfully.');
      } else if (account) {
        await userApi.update(account.id, payload);
        toast.success('Account updated successfully.');
      }
      onUpdated?.();
      onClose();
    } catch (error: unknown) {
      const fallbackMessage = isCreate ? 'Failed to create account. Please try again.' : 'Failed to update account. Please try again.';
      let message = fallbackMessage;
      if (typeof error === 'object' && error && 'response' in error) {
        const apiError = error as { response?: { data?: { message?: string } } };
        message = apiError.response?.data?.message ?? fallbackMessage;
      }
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const nameDisplay = useMemo(
    () => `${formValues.firstName} ${formValues.lastName}`.trim(),
    [formValues.firstName, formValues.lastName]
  );

  const headingLabel = isCreate ? 'Add account' : isEdit ? 'Update access' : 'Account details';
  const subLabel = isCreate ? 'Invite a new user to SmartLab.' : account?.email ?? '';

  return (
    <div className="admin-mobile-drawer fixed inset-0 z-50 h-dvh">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-[#f3f4f6] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#111827]">{headingLabel}</p>
            <p className="text-xs text-[#6b7280]">{subLabel}</p>
          </div>
          <button className="text-[#6b7280] hover:text-[#111827]" type="button" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {isView ? (
            <div className="space-y-4 text-sm text-[#374151]">
              <div>
                <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">Name</p>
                <p className="mt-1 font-medium text-[#111827]">{account?.name ?? nameDisplay}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">Email</p>
                <p className="mt-1 font-medium text-[#111827]">{account?.email}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">Role</p>
                  <p className="mt-1 font-medium text-[#111827]">{account?.role}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">Status</p>
                  {account && (
                    <span className={`inline-flex mt-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusStyles[account.status]}`}>
                      {account.status}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">Department / Course</p>
                <p className="mt-1 font-medium text-[#111827]">{account?.department}</p>
              </div>
            </div>
          ) : (
            <form className="space-y-3" onSubmit={handleSubmit}>
              {isCreate && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280] mb-2">Role</p>
                  <div className="flex gap-2">
                    {selectableCreateRoles.map((option) => {
                      const isActive = formValues.role === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleRoleChange(option.value)}
                          className={`flex-1 rounded-2xl border px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#800000] ${
                            isActive
                              ? 'bg-[#800000] text-white border-[#800000] shadow-[0_8px_16px_rgba(128,0,0,0.25)]'
                              : 'bg-white text-[#374151] border-[#e5e7eb] hover:border-[#cbd5f5]'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[11px] text-[#6b7280]">Choose the account type to create.</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">First name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formValues.firstName}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#800000]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Last name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formValues.lastName}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#800000]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Email address</label>
                <input
                  type="email"
                  name="email"
                  value={formValues.email}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#800000]"
                />
              </div>
              {!isCreate && (
                <DropdownField
                  label="Role"
                  value={formValues.role}
                  options={roleOptions}
                  onChange={handleRoleChange}
                  disabled
                />
              )}
              {isCreate ? (
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Status</label>
                  <div className="w-full rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-2 text-sm font-semibold text-[#1f2937]">
                    Active (default)
                  </div>
                  <input type="hidden" name="status" value={formValues.status} />
                </div>
              ) : (
                <DropdownField
                  label="Status"
                  value={formValues.status}
                  options={statusOptions}
                  onChange={handleStatusChange}
                />
              )}
              {isCreate && (
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">Temporary password</label>
                  <input
                    type="text"
                    name="password"
                    value={formValues.password}
                    onChange={handleChange}
                    placeholder="Enter a password to share with the user"
                    className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#800000]"
                  />
                </div>
              )}
              {isFacultyRole && (
                <DropdownField
                  label="Faculty department"
                  value={formValues.department}
                  placeholder={departmentPlaceholder}
                  options={departmentOptions}
                  onChange={(value) => setFormValues((prev) => ({ ...prev, department: value }))}
                  disabled={departmentOptions.length === 0}
                />
              )}
              {isStudentRole && (
                <div className="grid grid-cols-2 gap-3">
                  <DropdownField
                    label="Program"
                    value={formValues.program}
                    placeholder={programPlaceholder}
                    options={programOptions}
                    onChange={(value) => setFormValues((prev) => ({ ...prev, program: value }))}
                    disabled={programOptions.length === 0}
                  />
                  <DropdownField
                    label="Year level"
                    value={formValues.yearLevel}
                    placeholder="Select year"
                    options={YEAR_LEVELS.map((year) => ({ label: `Year ${year}`, value: year }))}
                    onChange={(value) => setFormValues((prev) => ({ ...prev, yearLevel: value }))}
                  />
                </div>
              )}
              {submitError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{submitError}</p>}
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
                  disabled={isSubmitting}
                  className={`px-4 py-2 text-xs font-semibold text-white rounded-full shadow-[0_4px_12px_rgba(128,0,0,0.25)] ${
                    isSubmitting ? 'bg-[#b56565] cursor-not-allowed' : 'bg-[#800000]'
                  }`}
                >
                  {isSubmitting ? 'Saving…' : isCreate ? 'Create account' : 'Save changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
