import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import DirectoryDrawer, { type DirectoryEntity } from '../components/academic-directory/DirectoryDrawer';
import { directoryApi } from '../services/api';
import type {
  DirectoryBuilding,
  DirectoryDepartment,
  DirectoryProgram,
  DirectoryRoom,
  DirectorySubject,
  DirectoryPayload,
} from '../types/academicDirectory';
import { Table, TableContainer, TableHead, TableHeaderCell, TableBody, TableRow, TableCell } from '../components/shared/Table';
import { IconActionButton } from '../components/shared/TableActionButtons';
import { EmptyState, LoadingState, ErrorState } from '../components/shared/EmptyState';
import { FilterItem } from '../components/shared/FilterGroup';
import CompactFilterPanel from '../components/shared/CompactFilterPanel';
import DropdownField from '../components/shared/DropdownField';
import { InputField } from '../components/shared/InputField';
import TablePagination from '../components/shared/TablePagination';
import { DEFAULT_TABLE_PAGE_SIZE } from '../components/shared/tablePaginationConstants';
import ControlRibbon from '../components/shared/ControlRibbon';
import PageTabGroup from '../components/shared/PageTabGroup';
import { getPageTabId } from '../components/shared/pageTabGroupUtils';

const tabDefinitions: Record<DirectoryEntity, { label: string; description: string; empty: string }> = {
  buildings: {
    label: 'Buildings',
    description: 'Canonical list of campus buildings used by rooms and requests.',
    empty: 'No buildings have been added yet.',
  },
  rooms: {
    label: 'Rooms',
    description: 'Instructional spaces referencing building assignments.',
    empty: 'No rooms have been added yet.',
  },
  programs: {
    label: 'Programs',
    description: 'Academic programs referenced by requests, schedules, and reports.',
    empty: 'No programs have been added yet.',
  },
  subjects: {
    label: 'Subjects',
    description: 'Subject catalog for schedules and borrow requests.',
    empty: 'No subjects have been added yet.',
  },
  departments: {
    label: 'Departments',
    description: 'Faculty department references across the platform.',
    empty: 'No departments have been added yet.',
  },
};

type DirectoryRecord = DirectoryBuilding | DirectoryRoom | DirectoryProgram | DirectorySubject | DirectoryDepartment;

function pageSlice<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

type DrawerState = {
  entity: DirectoryEntity;
  mode: 'create' | 'edit';
  record?: DirectoryRecord;
} | null;

export default function AdminAcademicDirectory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<DirectoryEntity>(() => {
    const tab = searchParams.get('tab') as DirectoryEntity | null;
    return tab && tab in tabDefinitions ? tab : 'buildings';
  });
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [roomBuildingFilter, setRoomBuildingFilter] = useState(() => searchParams.get('building') ?? '');
  const [roomTypeFilter, setRoomTypeFilter] = useState<'all' | 'computerLab' | 'standard'>(
    () => (searchParams.get('roomType') as 'all' | 'computerLab' | 'standard' | null) ?? 'all'
  );
  const [buildingOccupancyFilter, setBuildingOccupancyFilter] = useState<'all' | 'withRooms' | 'withoutRooms'>(
    () => (searchParams.get('occupancy') as 'all' | 'withRooms' | 'withoutRooms' | null) ?? 'all'
  );
  const [drawerState, setDrawerState] = useState<DrawerState>(null);
  const [data, setData] = useState<DirectoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [advancedTogglePortalTarget, setAdvancedTogglePortalTarget] = useState<HTMLDivElement | null>(null);
  const [directoryPage, setDirectoryPage] = useState(1);
  const [directoryPageSize, setDirectoryPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);

  const performLoadData = useCallback(async () => {
    
      return directoryApi.getOverview().then((response) => {
      setData((response.data ?? null) as DirectoryPayload);
      setLastUpdated(new Date());
    
    }).catch((err) => {
      console.error('Failed to load academic directory overview', err);
      setError('Unable to load academic directory data.');
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  // Automatic loads reset pending state when their query changes; refreshes reset it in the event.
  const loadDataInputs: unknown[] = [];
  const [loadDataSource, setloadDataSource] = useState(loadDataInputs);
  if (loadDataInputs.some((value, index) => !Object.is(value, loadDataSource[index]))) {
    setloadDataSource(loadDataInputs);
    setLoading(true);
    setError(null);
  }
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    await performLoadData();
  }, [performLoadData]);

  useEffect(() => { void performLoadData(); }, [performLoadData]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (activeTab !== 'buildings') next.set('tab', activeTab);
    if (search.trim()) next.set('search', search.trim());
    if (roomBuildingFilter) next.set('building', roomBuildingFilter);
    if (roomTypeFilter !== 'all') next.set('roomType', roomTypeFilter);
    if (buildingOccupancyFilter !== 'all') next.set('occupancy', buildingOccupancyFilter);
    setSearchParams(next, { replace: true });
  }, [
    activeTab,
    buildingOccupancyFilter,
    roomBuildingFilter,
    roomTypeFilter,
    search,
    setSearchParams,
  ]);

  const openDrawer = (entity: DirectoryEntity, mode: 'create' | 'edit', record?: DirectoryRecord) => {
    setDrawerState({ entity, mode, record });
  };

  const closeDrawer = () => setDrawerState(null);

  const summary = useMemo(
    () => [
      { key: 'buildings', count: data?.summary.buildings ?? 0 },
      { key: 'rooms', count: data?.summary.rooms ?? 0 },
      { key: 'programs', count: data?.summary.programs ?? 0 },
      { key: 'subjects', count: data?.summary.subjects ?? 0 },
      { key: 'departments', count: data?.summary.departments ?? 0 },
    ],
    [data?.summary]
  );

  const buildingOptions = useMemo(
    () =>
      (data?.buildings ?? [])
        .map((building) => ({ value: building.id, label: building.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [data?.buildings]
  );

  const filteredData = useMemo(() => {
    if (!data) return null;
    const query = search.trim().toLowerCase();
    const matches = (value: string) => value.toLowerCase().includes(query);
    return {
      ...data,
      buildings: data.buildings.filter((item) => {
        const matchesOccupancy =
          buildingOccupancyFilter === 'all' ||
          (buildingOccupancyFilter === 'withRooms' && item.roomCount > 0) ||
          (buildingOccupancyFilter === 'withoutRooms' && item.roomCount === 0);
        return matches(`${item.name} ${item.roomCount}`) && matchesOccupancy;
      }),
      rooms: data.rooms.filter((item) => {
        const matchesBuilding = !roomBuildingFilter || item.buildingId === roomBuildingFilter;
        const matchesType =
          roomTypeFilter === 'all' ||
          (roomTypeFilter === 'computerLab' && item.isComputerLab) ||
          (roomTypeFilter === 'standard' && !item.isComputerLab);
        return matches(`${item.roomNumber ?? ''} ${item.roomName ?? ''} ${item.buildingName ?? ''}`) && matchesBuilding && matchesType;
      }),
      programs: data.programs.filter((item) => matches(`${item.code} ${item.name}`)),
      subjects: data.subjects.filter((item) => matches(`${item.code} ${item.name}`)),
      departments: data.departments.filter((item) => matches(item.name)),
    };
  }, [buildingOccupancyFilter, data, roomBuildingFilter, roomTypeFilter, search]);

  const currentCollection = useMemo(() => {
    if (!filteredData) return [];
    switch (activeTab) {
      case 'buildings':
        return filteredData.buildings;
      case 'rooms':
        return filteredData.rooms;
      case 'programs':
        return filteredData.programs;
      case 'subjects':
        return filteredData.subjects;
      case 'departments':
        return filteredData.departments;
      default:
        return [];
    }
  }, [activeTab, filteredData]);

  const paginatedData = useMemo(() => {
    if (!filteredData) return null;
    return {
      ...filteredData,
      buildings: pageSlice(filteredData.buildings, directoryPage, directoryPageSize),
      rooms: pageSlice(filteredData.rooms, directoryPage, directoryPageSize),
      programs: pageSlice(filteredData.programs, directoryPage, directoryPageSize),
      subjects: pageSlice(filteredData.subjects, directoryPage, directoryPageSize),
      departments: pageSlice(filteredData.departments, directoryPage, directoryPageSize),
    };
  }, [directoryPage, directoryPageSize, filteredData]);

  const pageReset1Inputs = [activeTab, buildingOccupancyFilter, roomBuildingFilter, roomTypeFilter, search, currentCollection.length];
  const [pageReset1Previous, setpageReset1Previous] = useState<unknown[] | null>(null);
  if (!pageReset1Previous || pageReset1Inputs.some((value, index) => !Object.is(value, pageReset1Previous[index]))) {
    setpageReset1Previous(pageReset1Inputs);
    setDirectoryPage(1);
  }

  const appliedFilters = useMemo(() => {
    const chips: { id: 'search' | 'building' | 'roomType' | 'occupancy'; label: string }[] = [];
    if (search.trim()) chips.push({ id: 'search', label: `Search: ${search.trim()}` });
    if (activeTab === 'rooms' && roomBuildingFilter) {
      const buildingLabel = buildingOptions.find((option) => option.value === roomBuildingFilter)?.label ?? roomBuildingFilter;
      chips.push({ id: 'building', label: `Building: ${buildingLabel}` });
    }
    if (activeTab === 'rooms' && roomTypeFilter !== 'all') {
      chips.push({ id: 'roomType', label: `Type: ${roomTypeFilter === 'computerLab' ? 'Computer lab' : 'Standard room'}` });
    }
    if (activeTab === 'buildings' && buildingOccupancyFilter !== 'all') {
      chips.push({
        id: 'occupancy',
        label: `Rooms: ${buildingOccupancyFilter === 'withRooms' ? 'With rooms' : 'No rooms'}`,
      });
    }
    return chips;
  }, [activeTab, buildingOccupancyFilter, buildingOptions, roomBuildingFilter, roomTypeFilter, search]);

  const directoryRibbonSummary = [
    `Entity: ${tabDefinitions[activeTab].label}`,
    appliedFilters.length > 0 ? appliedFilters.map((filter) => filter.label).join(', ') : 'No active filters',
  ].filter(Boolean).join(' · ');

  const clearFilters = () => {
    setSearch('');
    setRoomBuildingFilter('');
    setRoomTypeFilter('all');
    setBuildingOccupancyFilter('all');
  };

  const handleTabChange = (tab: DirectoryEntity) => {
    setActiveTab(tab);
    setSearch('');
    setRoomBuildingFilter('');
    setRoomTypeFilter('all');
    setBuildingOccupancyFilter('all');
  };

  const removeFilter = (id: (typeof appliedFilters)[number]['id']) => {
    if (id === 'search') setSearch('');
    if (id === 'building') setRoomBuildingFilter('');
    if (id === 'roomType') setRoomTypeFilter('all');
    if (id === 'occupancy') setBuildingOccupancyFilter('all');
  };

  const renderTable = () => {
    if (!paginatedData) return null;
    switch (activeTab) {
      case 'buildings':
        return (
          <Table>
            <TableHead>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Rooms</TableHeaderCell>
              <TableHeaderCell align="center" width="6rem">Actions</TableHeaderCell>
            </TableHead>
            <TableBody>
              {paginatedData.buildings.map((building) => (
                <TableRow key={building.id}>
                  <TableCell>
                    <span className="font-semibold text-[#111827]">{building.name}</span>
                  </TableCell>
                  <TableCell>{building.roomCount}</TableCell>
                  <TableCell align="center">
                    <IconActionButton
                      label={`Edit ${building.name}`}
                      onClick={() => openDrawer('buildings', 'edit', building)}
                      icon="edit"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
      case 'rooms':
        return (
          <Table>
            <TableHead>
              <TableHeaderCell>Room No.</TableHeaderCell>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Building</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell align="center" width="6rem">Actions</TableHeaderCell>
            </TableHead>
            <TableBody>
              {paginatedData.rooms.map((room) => (
                <TableRow key={room.id}>
                  <TableCell>
                    <span className="font-semibold text-[#111827]">{room.roomNumber ?? '—'}</span>
                  </TableCell>
                  <TableCell>{room.roomName ?? '—'}</TableCell>
                  <TableCell>{room.buildingName ?? 'Unassigned'}</TableCell>
                  <TableCell>
                    {room.isComputerLab ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#dcfce7] text-[#166534] text-[11px] font-semibold">
                        Computer Lab
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#9ca3af]">Room</span>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <IconActionButton
                      label={`Edit ${room.roomNumber ?? room.roomName ?? 'room'}`}
                      onClick={() => openDrawer('rooms', 'edit', room)}
                      icon="edit"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
      case 'programs':
        return (
          <Table>
            <TableHead>
              <TableHeaderCell>Code</TableHeaderCell>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell align="center" width="6rem">Actions</TableHeaderCell>
            </TableHead>
            <TableBody>
              {paginatedData.programs.map((program) => (
                <TableRow key={program.id}>
                  <TableCell>
                    <span className="font-semibold text-[#111827]">{program.code}</span>
                  </TableCell>
                  <TableCell>{program.name}</TableCell>
                  <TableCell align="center">
                    <IconActionButton
                      label={`Edit ${program.name}`}
                      onClick={() => openDrawer('programs', 'edit', program)}
                      icon="edit"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
      case 'subjects':
        return (
          <Table>
            <TableHead>
              <TableHeaderCell>Code</TableHeaderCell>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell align="center" width="6rem">Actions</TableHeaderCell>
            </TableHead>
            <TableBody>
              {paginatedData.subjects.map((subject) => (
                <TableRow key={subject.id}>
                  <TableCell>
                    <span className="font-semibold text-[#111827]">{subject.code}</span>
                  </TableCell>
                  <TableCell>{subject.name}</TableCell>
                  <TableCell align="center">
                    <IconActionButton
                      label={`Edit ${subject.name}`}
                      onClick={() => openDrawer('subjects', 'edit', subject)}
                      icon="edit"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
      case 'departments':
        return (
          <Table>
            <TableHead>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell align="center" width="6rem">Actions</TableHeaderCell>
            </TableHead>
            <TableBody>
              {paginatedData.departments.map((department) => (
                <TableRow key={department.id}>
                  <TableCell>{department.name}</TableCell>
                  <TableCell align="center">
                    <IconActionButton
                      label={`Edit ${department.name}`}
                      onClick={() => openDrawer('departments', 'edit', department)}
                      icon="edit"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
      default:
        return null;
    }
  };

  const renderDirectoryControls = () => {
    const isRoomsTab = activeTab === 'rooms';
    const isBuildingsTab = activeTab === 'buildings';

    return (
      <div className="filter-toolbar filter-toolbar--sticky mb-1">
        <ControlRibbon
          label="Directory filters"
          activeSummary={directoryRibbonSummary}
          onRefresh={loadData}
          refreshing={loading}
          refreshError={Boolean(error)}
          lastUpdated={lastUpdated}
          actions={
            <button
              type="button"
              onClick={() => openDrawer(activeTab, 'create')}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#800000] px-4 text-xs font-semibold text-white shadow"
            >
              + Add {tabDefinitions[activeTab].label.slice(0, -1)}
            </button>
          }
          bottomControl={(isRoomsTab || isBuildingsTab) ? <div ref={setAdvancedTogglePortalTarget} /> : undefined}
          reserveBottomClearance={!isRoomsTab && !isBuildingsTab}
        >
          <div role="group" aria-label="Directory search and filters" className="flex flex-col gap-3">
            <div role="group" aria-label="Directory filters" className="ribbon-control-group flex flex-wrap gap-2">
              <CompactFilterPanel
            primary={
              <div className="grid grid-cols-1 gap-2.5">
                <FilterItem label={`Search ${tabDefinitions[activeTab].label.toLowerCase()}`} className="min-w-0">
                  <InputField
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={`Search ${tabDefinitions[activeTab].label.toLowerCase()}…`}
                    size="md"
                  />
                </FilterItem>
              </div>
            }
            advanced={
              isRoomsTab || isBuildingsTab ? (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {isRoomsTab && (
                    <>
                      <FilterItem label="Building" className="min-w-0">
                        <DropdownField
                          value={roomBuildingFilter}
                          options={[{ value: '', label: 'All buildings' }, ...buildingOptions]}
                          onChange={setRoomBuildingFilter}
                          placeholder="All buildings"
                        />
                      </FilterItem>
                      <FilterItem label="Room type" className="min-w-0">
                        <DropdownField
                          value={roomTypeFilter}
                          options={[
                            { value: 'all', label: 'All room types' },
                            { value: 'computerLab', label: 'Computer labs' },
                            { value: 'standard', label: 'Standard rooms' },
                          ]}
                          onChange={setRoomTypeFilter}
                          placeholder="All room types"
                        />
                      </FilterItem>
                    </>
                  )}
                  {isBuildingsTab && (
                    <FilterItem label="Room assignment" className="min-w-0">
                      <DropdownField
                        value={buildingOccupancyFilter}
                        options={[
                          { value: 'all', label: 'All buildings' },
                          { value: 'withRooms', label: 'With rooms' },
                          { value: 'withoutRooms', label: 'No rooms assigned' },
                        ]}
                        onChange={setBuildingOccupancyFilter}
                        placeholder="All buildings"
                      />
                    </FilterItem>
                  )}
                </div>
              ) : undefined
            }
            advancedCount={[
              isRoomsTab && Boolean(roomBuildingFilter),
              isRoomsTab && roomTypeFilter !== 'all',
              isBuildingsTab && buildingOccupancyFilter !== 'all',
            ].filter(Boolean).length}
            defaultAdvancedOpen={appliedFilters.some((filter) => filter.id !== 'search')}
            ribbonToggle
            advancedTogglePortalTarget={advancedTogglePortalTarget}
            hasActiveFilters={appliedFilters.length > 0}
            onReset={clearFilters}
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
                        onClick={() => removeFilter(chip.id)}
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#b77b7b] transition hover:bg-[#fce7e7] hover:text-[#800000]"
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
            </div>
          </div>
        </ControlRibbon>
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return <LoadingState message="Loading directory data…" />;
    }
    if (error) {
      return <ErrorState message={error} onRetry={loadData} />;
    }
    if (!data) {
      return null;
    }

    const noData = currentCollection.length === 0;

    return (
      <div className="space-y-3 lg:space-y-4">
        <div aria-hidden="true" className="h-0.5 w-full rounded-full bg-[#c8aaa2]" />
        <div className="pb-4">
          {noData ? (
            <div className="px-4 lg:px-6">
              <EmptyState
                title={appliedFilters.length > 0 ? 'No matching records' : tabDefinitions[activeTab].empty}
                description={appliedFilters.length > 0 ? 'Try different filters or reset the current filter set.' : ''}
                variant="dashed"
              />
            </div>
          ) : (
            <section className="rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
              <div className="px-4 py-5 lg:px-6">
                <TableContainer>{renderTable()}</TableContainer>
                <TablePagination
                  currentPage={directoryPage}
                  pageSize={directoryPageSize}
                  totalItems={currentCollection.length}
                  onPageChange={setDirectoryPage}
                  onPageSizeChange={(size) => {
                    setDirectoryPageSize(size);
                    setDirectoryPage(1);
                  }}
                />
              </div>
            </section>
          )}
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="mx-auto responsive-workspace space-y-4 p-2 lg:p-3">
        {data && renderDirectoryControls()}
        <div className="page-control-ribbon--flush px-0 pt-3 pb-0">
          <PageTabGroup
            tabs={(Object.keys(tabDefinitions) as DirectoryEntity[]).map((tab) => ({
              id: tab,
              label: tabDefinitions[tab].label,
              description: tabDefinitions[tab].description,
              count: summary.find((item) => item.key === tab)?.count ?? 0,
            }))}
            value={activeTab}
            onChange={(value) => handleTabChange(value as DirectoryEntity)}
            ariaLabel="Academic directory entities"
            panelId="academic-directory-tabpanel"
          />
        </div>

        <div
          id="academic-directory-tabpanel"
          role="tabpanel"
          aria-labelledby={getPageTabId('academic-directory-tabpanel', activeTab)}
          tabIndex={0}
          className="min-w-0"
        >
          {renderContent()}
        </div>
      </div>
      {drawerState && data && (
        <DirectoryDrawer
          entity={drawerState.entity}
          mode={drawerState.mode}
          record={drawerState.record}
          buildings={data.buildings}
          onClose={closeDrawer}
          onSuccess={() => {
            closeDrawer();
            loadData();
          }}
        />
      )}
    </AdminLayout>
  );
}
