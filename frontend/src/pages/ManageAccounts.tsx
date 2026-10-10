import { toast } from '../stores/toastStore';
import { useRef } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import FilterToolbar from '../components/FilterToolbar';
import AccountDrawer from '../components/accounts/AccountDrawer';
import type { Account } from '../types/account';
import { directoryApi, userApi } from '../services/api';
import { ROLE_ID_TO_VALUE, STATUS_ID_TO_VALUE } from '../constants/roles';
import { Table, TableContainer, TableHead, TableHeaderCell, TableBody, TableRow, TableCell } from '../components/shared/Table';
import { IconActionButton } from '../components/shared/TableActionButtons';
import { LoadingState, ErrorState, EmptyState } from '../components/shared/EmptyState';
import { FilterItem } from '../components/shared/FilterGroup';
import CompactFilterPanel from '../components/shared/CompactFilterPanel';
import DropdownField from '../components/shared/DropdownField';
import { InputField } from '../components/shared/InputField';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import TablePagination from '../components/shared/TablePagination';
import { DEFAULT_TABLE_PAGE_SIZE } from '../components/shared/tablePaginationConstants';

type RoleFilter = 'all' | 'ADMIN' | 'FACULTY' | 'STUDENT';
type StatusFilter = 'all' | 'ACTIVE' | 'DEACTIVATED';
type AccountStats = { activeStudents:number; activeFaculty:number; administrators:number; archivedAccounts:number; archivedBreakdown:{students:number;faculty:number;administrators:number}; pendingReactivation:number };

const roleFilterOptions: { label: string; value: RoleFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Admin', value: 'ADMIN' },
  { label: 'Faculty', value: 'FACULTY' },
  { label: 'Student', value: 'STUDENT' },
];

const statusFilterOptions: { label: string; value: StatusFilter }[] = [
  { label: 'All statuses', value: 'all' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Deactivated', value: 'DEACTIVATED' },
];

const roleSelectOptions: { label: string; value: Account['role'] }[] = [
  { label: 'Admin', value: 'ADMIN' },
  { label: 'Faculty', value: 'FACULTY' },
  { label: 'Student', value: 'STUDENT' },
];

const statusSelectOptions: { label: string; value: Account['status'] }[] = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Deactivated', value: 'DEACTIVATED' },
];

type SelectOption = { label: string; value: string };

interface ApiUser {
  user_id: string;
  gmail: string;
  role_id: number;
  role_name?: string;
  status_id: number;
  status_name?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  department?: string;
  department_name?: string;
  department_id?: string;
  program?: string;
  program_id?: string;
  program_name?: string;
  program_code?: string;
  year_level?: number;
}

interface ProgramRecord {
  program_id: string;
  program_code: string;
  program_name: string;
}

interface DepartmentRecord {
  department_id: string;
  department_code: string;
  department_name: string;
}

const statusStyles: Record<Account['status'], string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  DEACTIVATED: 'bg-red-100 text-red-600',
};

type DrawerState =
  | { mode: 'create' }
  | { mode: 'view'; account: Account }
  | { mode: 'edit'; account: Account };

export default function ManageAccounts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [resetSending, setResetSending] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [departmentOptions, setDepartmentOptions] = useState<SelectOption[]>([]);
  const [programOptions, setProgramOptions] = useState<SelectOption[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>(() => {
    const value = searchParams.get('role');
    return roleFilterOptions.some((option) => option.value === value) ? value as RoleFilter : 'all';
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const value = searchParams.get('status');
    return statusFilterOptions.some((option) => option.value === value) ? value as StatusFilter : 'all';
  });
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const debouncedSearch = useDebouncedValue(search);
  const [drawerState, setDrawerState] = useState<DrawerState | null>(null);
  const [advancedTogglePortalTarget, setAdvancedTogglePortalTarget] = useState<HTMLDivElement | null>(null);
  const [serverTotal, setServerTotal] = useState(0);
  const [accountPage, setAccountPage] = useState(1);
  const [accountPageSize, setAccountPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [stats, setStats] = useState<AccountStats | null>(null);

  const NewAccountInputs = [searchParams];
  const [NewAccountPrevious, setNewAccountPrevious] = useState<unknown[] | null>(null);
  if (!NewAccountPrevious || NewAccountInputs.some((value, index) => !Object.is(value, NewAccountPrevious[index]))) {
    setNewAccountPrevious(NewAccountInputs);
    if (searchParams.get('new') === '1') {
      setDrawerState({ mode: 'create' });
    }
  }

  const normalizeRole = (roleId: number, roleName?: string): Account['role'] => {
    if (ROLE_ID_TO_VALUE[roleId]) {
      return ROLE_ID_TO_VALUE[roleId];
    }
    const normalized = roleName?.toUpperCase();
    if (normalized?.includes('FACULTY')) return 'FACULTY';
    if (normalized?.includes('STUDENT')) return 'STUDENT';
    return 'ADMIN';
  };

  const normalizeStatus = (statusId: number, statusName?: string): Account['status'] => {
    if (STATUS_ID_TO_VALUE[statusId]) {
      return STATUS_ID_TO_VALUE[statusId];
    }
    const normalized = statusName?.toUpperCase();
    if (normalized === 'DEACTIVATED') return 'DEACTIVATED';
    return 'ACTIVE';
  };

  const requestVersion = useRef(0);
  const performFetchAccounts = useCallback(async () => {
    const version = ++requestVersion.current;
    
      return userApi.getPage({
        page: accountPage, pageSize: accountPageSize,
        ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
        ...(roleFilter !== 'all' ? { role: roleFilter } : {}),
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      }).then((response) => {
      if (version !== requestVersion.current) return;
      const count = Number(response.headers['x-total-count']); setServerTotal(count);
      if (accountPage > 1 && count <= (accountPage - 1) * accountPageSize) setAccountPage(Math.max(1, Math.ceil(count / accountPageSize)));
      const users: ApiUser[] = (response.data ?? []) as ApiUser[];
      const normalized: Account[] = users.map((user) => ({
        id: String(user.user_id),
        roleId: user.role_id,
        role: normalizeRole(user.role_id, user.role_name),
        name: user.full_name || `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.gmail,
        firstName: user.first_name ?? null,
        lastName: user.last_name ?? null,
        email: user.gmail,
        department: user.department || user.department_name || null,
        departmentId: user.department_id ?? null,
        program: user.program || user.program_name || user.program_code || null,
        programId: user.program_id ?? null,
        yearLevel: user.year_level ?? null,
        status: normalizeStatus(user.status_id, user.status_name),
        statusId: user.status_id,
      }));
      setAccounts(normalized);
    
    }).catch((error) => {
      if (version !== requestVersion.current) return;
      const fallbackMessage = 'Failed to load accounts.';
      if (typeof error === 'object' && error && 'response' in error) {
        const apiError = error as { response?: { data?: { message?: string } } };
        setAccountsError(apiError.response?.data?.message ?? fallbackMessage);
      } else {
        setAccountsError(fallbackMessage);
      }
    }).finally(() => {
      if (version !== requestVersion.current) return;
      setAccountsLoading(false);
    });
  }, [accountPage, accountPageSize, debouncedSearch, roleFilter, statusFilter]);

  // Automatic loads reset pending state when their query changes; refreshes reset it in the event.
  const fetchAccountsInputs = [accountPage, accountPageSize, debouncedSearch, roleFilter, statusFilter];
  const [fetchAccountsSource, setfetchAccountsSource] = useState(fetchAccountsInputs);
  if (fetchAccountsInputs.some((value, index) => !Object.is(value, fetchAccountsSource[index]))) {
    setfetchAccountsSource(fetchAccountsInputs);
    setAccountsLoading(true);
    setAccountsError(null);
  }
  const fetchAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsError(null);
    await performFetchAccounts();
  }, [performFetchAccounts]);

  const fetchStats = useCallback(async () => {
    try { const response = await userApi.getStats(); setStats(response.data); }
    catch { setStats(null); }
  }, []);

  const fetchDirectoryOptions = useCallback(async () => {
    
      return Promise.all([
        directoryApi.getPrograms(),
        directoryApi.getDepartments(),
      ]).then(([programRes, departmentRes]) => {

      const programs: ProgramRecord[] = (programRes.data ?? []) as ProgramRecord[];
      const departments: DepartmentRecord[] = (departmentRes.data ?? []) as DepartmentRecord[];

      setProgramOptions(
        programs.map((program) => ({
          label: program.program_name || program.program_code,
          value: String(program.program_id),
        }))
      );

      setDepartmentOptions(
        departments.map((dept) => ({
          label: dept.department_name || dept.department_code,
          value: String(dept.department_id),
        }))
      );
    
    }).catch((error) => {
      console.error('Failed to load department/program lists', error);
    });
  }, []);

  useEffect(() => { void performFetchAccounts(); }, [performFetchAccounts]);
  useEffect(() => {
    let current = true;
    userApi.getStats().then(response => { if (current) setStats(response.data); }).catch(() => { if (current) setStats(null); });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    const next = new URLSearchParams();
    if (search.trim()) next.set('search', search.trim());
    if (roleFilter !== 'all') next.set('role', roleFilter);
    if (statusFilter !== 'all') next.set('status', statusFilter);
    if (searchParams.get('new') === '1') next.set('new', '1');
    setSearchParams(next, { replace: true });
  }, [roleFilter, search, searchParams, setSearchParams, statusFilter]);

  useEffect(() => {
    fetchDirectoryOptions();
  }, [fetchDirectoryOptions]);

  const appliedFilters = useMemo(() => {
    const chips: { id: 'search' | 'role' | 'status'; label: string }[] = [];
    if (search.trim()) {
      chips.push({ id: 'search', label: `Search: ${search.trim()}` });
    }
    if (roleFilter !== 'all') {
      const roleLabel = roleFilterOptions.find((option) => option.value === roleFilter)?.label ?? roleFilter;
      chips.push({ id: 'role', label: `Role: ${roleLabel}` });
    }
    if (statusFilter !== 'all') {
      const statusLabel = statusFilterOptions.find((option) => option.value === statusFilter)?.label ?? statusFilter;
      chips.push({ id: 'status', label: `Status: ${statusLabel}` });
    }
    return chips;
  }, [roleFilter, search, statusFilter]);

  const filtersActiveCount = appliedFilters.length;

  const handleRemoveFilter = (type: 'search' | 'role' | 'status') => {
    if (type === 'search') {
      setSearch('');
    } else if (type === 'role') {
      setRoleFilter('all');
    } else {
      setStatusFilter('all');
    }
  };

  const resetFilters = () => {
    setSearch('');
    setRoleFilter('all');
    setStatusFilter('all');
  };

  const filteredAccounts = accounts;

  const pageReset1Inputs = [roleFilter, statusFilter, search];
  const [pageReset1Previous, setpageReset1Previous] = useState<unknown[] | null>(null);
  if (!pageReset1Previous || pageReset1Inputs.some((value, index) => !Object.is(value, pageReset1Previous[index]))) {
    setpageReset1Previous(pageReset1Inputs);
    setAccountPage(1);
  }

  const paginatedAccounts = accounts;

  const filtersContent = (
    <CompactFilterPanel
      primary={
        <FilterItem label="Search" className="min-w-0">
          <InputField
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or email…"
            size="md"
          />
        </FilterItem>
      }
      advanced={
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <FilterItem label="Role" className="min-w-0">
            <DropdownField
              value={roleFilter}
              options={roleFilterOptions}
              onChange={(value) => setRoleFilter(value)}
              placeholder="All"
            />
          </FilterItem>
          <FilterItem label="Status" className="min-w-0">
            <DropdownField
              value={statusFilter}
              options={statusFilterOptions}
              onChange={(value) => setStatusFilter(value)}
              placeholder="All statuses"
            />
          </FilterItem>
        </div>
      }
      advancedCount={[roleFilter !== 'all', statusFilter !== 'all'].filter(Boolean).length}
      defaultAdvancedOpen={roleFilter !== 'all' || statusFilter !== 'all'}
      ribbonToggle
      advancedTogglePortalTarget={advancedTogglePortalTarget}
      hasActiveFilters={appliedFilters.length > 0}
      onReset={resetFilters}
      activeFilters={
        appliedFilters.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-[#e5e7eb] pt-3">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Active</span>
            {appliedFilters.map((chip) => (
              <span
                key={chip.id}
                className="filter-active-chip inline-flex items-center gap-2 rounded-full border border-[#f1caca] bg-[#fff7f7] px-3 py-1.5 text-[11px] font-semibold text-[#800000]"
              >
                <span className="filter-active-chip__label">{chip.label}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveFilter(chip.id)}
                  className="rounded-full text-[#b77b7b] transition hover:bg-[#fce7e7] hover:text-[#800000]"
                  aria-label={`Remove ${chip.label}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        ) : undefined
      }
    />
  );

  return (
    <AdminLayout>
      <div className="mx-auto responsive-workspace space-y-4 p-2 lg:p-3">
        <FilterToolbar
          searchValue={search}
          onSearchChange={setSearch}
          primaryAction={{
            label: 'Add Account',
            icon: <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />,
            onClick: () => setDrawerState({ mode: 'create' }),
          }}
          searchPlaceholder="Search name or email…"
          searchInFilters
          filters={filtersContent}
          filtersActiveCount={filtersActiveCount}
          defaultFiltersOpen={filtersActiveCount > 0}
          compactFilters
          ribbonSummary="Account search and filters"
          bottomControl={<div ref={setAdvancedTogglePortalTarget} />}
          onRefresh={async()=>{await Promise.all([fetchAccounts(),fetchStats()]);}}
          refreshing={accountsLoading}
          refreshError={Boolean(accountsError)}
          className="mb-1"
        />
        <section aria-label="Account totals" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            {label:'Active students',value:stats?.activeStudents,detail:'Can access the student portal',role:'STUDENT' as RoleFilter,status:'ACTIVE' as StatusFilter},
            {label:'Active faculty',value:stats?.activeFaculty,detail:'Can access the faculty portal',role:'FACULTY' as RoleFilter,status:'ACTIVE' as StatusFilter},
            {label:'Administrators',value:stats?.administrators,detail:'Active administrator accounts',role:'ADMIN' as RoleFilter,status:'ACTIVE' as StatusFilter},
            {label:'Archived accounts',value:stats?.archivedAccounts,detail:stats?`${stats.archivedBreakdown.students} students · ${stats.archivedBreakdown.faculty} faculty`: 'Preserved historical accounts',role:'all' as RoleFilter,status:'DEACTIVATED' as StatusFilter},
            {label:'Pending reactivation',value:stats?.pendingReactivation,detail:'Archived users awaiting review',role:'all' as RoleFilter,status:'DEACTIVATED' as StatusFilter},
          ].map(card => {
            const active=roleFilter===card.role&&statusFilter===card.status&&!search.trim();
            return <button key={card.label} type="button" onClick={()=>{setSearch('');setRoleFilter(card.role);setStatusFilter(card.status);}} aria-pressed={active} className={`rounded-2xl border p-4 text-left shadow-sm transition ${active?'border-[#800000] bg-[#fff5f2] ring-2 ring-[#800000]/10':'border-[#ead7d3] bg-white hover:border-[#c98f83]'}`}>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#786565]">{card.label}</span><strong className="mt-1 block text-2xl text-[#321d1d]">{card.value ?? '—'}</strong><span className={`mt-1 block text-xs ${card.label==='Pending reactivation'&&(card.value??0)>0?'font-semibold text-amber-700':'text-[#786565]'}`}>{card.detail}</span>
            </button>;
          })}
        </section>
        <div aria-hidden="true" className="h-0.5 w-full rounded-full bg-[#c8aaa2]" />
        <section className="rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
          <div className="px-4 py-5 lg:px-6">
            <div className="overflow-x-auto lg:overflow-x-visible overflow-y-visible">
              {accountsLoading ? (
                <LoadingState message="Loading accounts…" />
              ) : accountsError ? (
                <ErrorState message={accountsError} onRetry={fetchAccounts} />
              ) : filteredAccounts.length === 0 ? (
                <EmptyState
                  title="No accounts found"
                  description="No accounts match your filters yet."
                  variant="minimal"
                />
              ) : (
                <>
                  <div className="space-y-3 md:hidden">
                    {paginatedAccounts.map(account => <article key={account.id} className="overflow-hidden rounded-2xl border border-[#ead7d3] bg-white">
                      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f1e6e3] bg-[#fffaf7] p-3"><span className="text-xs font-semibold text-[#800000]">{roleSelectOptions.find(role => role.value === account.role)?.label || account.role}</span><span className={'rounded-full px-2.5 py-1 text-xs font-semibold ' + statusStyles[account.status]}>{account.status === 'ACTIVE' ? 'Active' : 'Deactivated'}</span></header>
                      <div className="space-y-3 p-4"><div><h3 className="break-words text-base font-semibold text-[#321d1d]">{account.name}</h3><p className="mt-1 break-all text-xs text-[#786565]">{account.email}</p></div><div className="rounded-xl bg-[#faf7f5] p-3"><p className="text-xs text-[#786565]">{account.role === 'STUDENT' ? 'Program & year' : 'Department'}</p><p className="mt-1 break-words text-sm text-[#514343]">{(account.role === 'STUDENT' ? [account.program, account.yearLevel ? 'Year ' + account.yearLevel : null].filter(Boolean).join(' · ') : account.department) || 'Not assigned'}</p></div></div>
                      <footer className="grid grid-cols-2 gap-2 border-t border-[#f1e6e3] p-3"><button type="button" onClick={() => setDrawerState({ account, mode: 'edit' })} className="min-h-11 rounded-xl bg-[#800000] px-2 text-xs font-semibold text-white">Edit account</button><button type="button" disabled={resetSending !== null} onClick={async()=>{setResetSending(account.id);try{const {data}=await userApi.sendPasswordReset(account.id);toast.success(data.message);}catch{toast.error('Could not request a reset email. Please try again.');}finally{setResetSending(null);}}} className="min-h-11 rounded-xl border border-[#ead7d3] px-2 text-xs font-semibold text-[#800000] disabled:opacity-50">{resetSending === account.id ? 'Sending…' : 'Send reset link'}</button></footer>
                    </article>)}
                  </div>
                  <div className="hidden md:block"><TableContainer>
                    <Table>
                      <TableHead>
                        <TableHeaderCell>Role</TableHeaderCell>
                        <TableHeaderCell>Name</TableHeaderCell>
                        <TableHeaderCell>Email</TableHeaderCell>
                        <TableHeaderCell>Department / Course</TableHeaderCell>
                        <TableHeaderCell>Status</TableHeaderCell>
                        <TableHeaderCell align="center" width="6rem">Actions</TableHeaderCell>
                      </TableHead>
                      <TableBody>
                        {paginatedAccounts.map((account) => (
                          <TableRow key={account.id}>
                            <TableCell>
                              <span className="font-semibold text-[#111827]">{account.role}</span>
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold text-[#111827]">{account.name}</span>
                            </TableCell>
                            <TableCell>{account.email}</TableCell>
                            <TableCell>
                              {account.role === 'STUDENT'
                                ? [account.program, account.yearLevel ? `Year ${account.yearLevel}` : null].filter(Boolean).join(' • ')
                                : account.department}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusStyles[account.status]}`}>
                                {account.status}
                              </span>
                            </TableCell>
                            <TableCell align="center">
                              <div className="flex min-w-max items-center justify-center gap-2">
                              <IconActionButton
                                label={`Update ${account.name}`}
                                onClick={() => setDrawerState({ account, mode: 'edit' })}
                                icon="edit"
                              />
                              <IconActionButton icon="resetPassword" label={`Send password reset link to ${account.name}`} disabled={resetSending !== null} busy={resetSending === account.id} onClick={async()=>{setResetSending(account.id);try{const {data}=await userApi.sendPasswordReset(account.id);toast.success(data.message);}catch{toast.error('Could not request a reset email. Please try again.');}finally{setResetSending(null);}}} />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer></div>
                  <TablePagination
                    currentPage={accountPage}
                    pageSize={accountPageSize}
                    totalItems={serverTotal}
                    onPageChange={setAccountPage}
                    onPageSizeChange={(size) => {
                      setAccountPageSize(size);
                      setAccountPage(1);
                    }}
                  />
                </>
              )}
            </div>
          </div>
        </section>
      </div>
      {drawerState && (
        <AccountDrawer
          account={drawerState.mode === 'create' ? undefined : drawerState.account}
          mode={drawerState.mode}
          onClose={() => setDrawerState(null)}
          roleOptions={roleSelectOptions}
          statusOptions={statusSelectOptions}
          statusStyles={statusStyles}
          departmentOptions={departmentOptions}
          programOptions={programOptions}
          onUpdated={() => Promise.all([fetchAccounts(),fetchStats()]).then(()=>undefined)}
        />
      )}
    </AdminLayout>
  );
}
