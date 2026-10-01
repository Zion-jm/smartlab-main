import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { reportsApi } from '../../../services/api';
import { toast } from '../../../stores/toastStore';
import type { ApiLabSchedule } from '../../../types/labSchedule';
import { formatTimeRange } from '../../../utils/dateTime';
import type { AcademicPeriodSelection } from '../../shared/AcademicPeriodFilter';
import CompactFilterPanel from '../../shared/CompactFilterPanel';
import DropdownField from '../../shared/DropdownField';
import { FilterItem } from '../../shared/FilterGroup';
import { InputField } from '../../shared/InputField';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeaderCell, TableRow } from '../../shared/Table';
import TablePagination from '../../shared/TablePagination';
import { DEFAULT_TABLE_PAGE_SIZE } from '../../shared/tablePaginationConstants';
import {
PrintableReportDocument,
type PrintableReportDefinition,
} from '../PrintableReportDocument';
import '../reportDocumentStyles.css';
import { buildScheduleDemandRows, buildSchedulePrintRows, dayNames, downloadCsv, formatDate, formatSectionLabel, inDateRange, scheduleDay, scheduleDemandGroupDescriptions, scheduleDemandGroupLabels, scheduleFaculty, scheduleProgram, scheduleRoom, scheduleSubject, type DateRange, type ScheduleDemandGroupBy, type ScheduleDemandRow, type ScheduleDemandSortBy, type SchedulePrintRow } from './reportData';
import { FormalReportFrame, ScheduleReportOutputMenu } from './ReportOutput';

export function ScheduleDemandPanel({
  rows,
  emptyMessage,
  title,
  description,
  sortBy = 'entries',
}: {
  rows: ScheduleDemandRow[];
  emptyMessage: string;
  title: string;
  description: string;
  sortBy?: ScheduleDemandSortBy;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const maxRankValue = Math.max(...rows.map((row) => (sortBy === 'entries' ? row.entries : row.rooms)), 1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="rounded-2xl border border-[#eee5e3] bg-[#fffcfb] p-4 lg:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[#241f20]">{title}</h3>
          <p className="mt-1 max-w-[34rem] text-xs leading-5 text-[#756b6b]">
            {description} Ranked by {sortBy === 'entries' ? 'schedule entries' : 'rooms used'}.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9a7770]">
          {rows.length > 0 ? `${rows.length} ${rows.length === 1 ? 'group' : 'groups'}` : 'No data'}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-xs text-[#9a9090]">{emptyMessage}</p>
      ) : (
        <>
          <div className="mt-5 space-y-3">
            {paginatedRows.map((row, index) => {
              const rankValue = sortBy === 'entries' ? row.entries : row.rooms;
              const share = Math.max((rankValue / maxRankValue) * 100, 8);
              return (
                <div key={row.key} className="grid grid-cols-[28px_1fr_auto] items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f4e8e5] text-[11px] font-bold text-[#7f3f35]">
                    {(safePage - 1) * pageSize + index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <p title={row.section} className="break-words text-xs font-semibold leading-4 text-[#3f3636]">
                        {row.section}
                      </p>
                      <p className="shrink-0 text-[11px] font-semibold text-[#756b6b]">
                        {row.entries} {row.entries === 1 ? 'entry' : 'entries'}
                      </p>
                    </div>
                    <p className="mt-1 text-[10px] text-[#9a9090]">
                      {row.rooms} {row.rooms === 1 ? 'room' : 'rooms'} · {row.recurring} recurring
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f1e9e7]">
                      <div className="h-full rounded-full bg-[#9b5a4e]" style={{ width: `${share}%` }} />
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-[11px] text-[#8c8080]">
                    {row.recurring} recurring
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-5 overflow-hidden rounded-xl border border-[#eee5e3] bg-white">
            <TablePagination
              currentPage={safePage}
              pageSize={pageSize}
              totalItems={rows.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setCurrentPage(1);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

export function ScheduleReportView({
  schedules,
  range,
  academicPeriod,
  primaryFilterPortalTarget,
  advancedFilterPortalTarget,
  bottomControlPortalTarget,
  actionPortalTarget,
}: {
  schedules: ApiLabSchedule[];
  range: DateRange;
  academicPeriod: AcademicPeriodSelection;
  primaryFilterPortalTarget: HTMLDivElement | null;
  advancedFilterPortalTarget: HTMLDivElement | null;
  bottomControlPortalTarget: HTMLDivElement | null;
  actionPortalTarget: HTMLDivElement | null;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('scheduleSearch') ?? '');
  const [day, setDay] = useState(() => searchParams.get('scheduleDay') ?? 'ALL');
  const [room, setRoom] = useState(() => searchParams.get('scheduleRoom') ?? 'ALL');
  const [roomType, setRoomType] = useState<'ALL' | 'COMPUTER_LAB' | 'OTHER'>(() => {
    const value = searchParams.get('scheduleRoomType');
    return value === 'COMPUTER_LAB' || value === 'OTHER' ? value : 'ALL';
  });
  const [program, setProgram] = useState(() => searchParams.get('scheduleProgram') ?? 'ALL');
  const [year, setYear] = useState(() => searchParams.get('scheduleYear') ?? 'ALL');
  const [type, setType] = useState<'ALL' | 'WEEKLY' | 'ONE_TIME'>(() => {
    const value = searchParams.get('scheduleType');
    return value === 'WEEKLY' || value === 'ONE_TIME' ? value : 'ALL';
  });
  const [demandGroupBy, setDemandGroupBy] = useState<ScheduleDemandGroupBy>(() => {
    const value = searchParams.get('scheduleDemandGroup');
    return value === 'subject' || value === 'room' || value === 'faculty' ? value : 'program';
  });
  const [demandSortBy, setDemandSortBy] = useState<ScheduleDemandSortBy>(() =>
    searchParams.get('scheduleDemandSort') === 'rooms' ? 'rooms' : 'entries'
  );
  const [demandType, setDemandType] = useState<'ALL' | 'WEEKLY' | 'ONE_TIME'>(() => {
    const value = searchParams.get('scheduleDemandType');
    return value === 'WEEKLY' || value === 'ONE_TIME' ? value : 'ALL';
  });
  const [demandRoomType, setDemandRoomType] = useState<'ALL' | 'COMPUTER_LAB' | 'OTHER'>(() => {
    const value = searchParams.get('scheduleDemandRoomType');
    return value === 'COMPUTER_LAB' || value === 'OTHER' ? value : 'ALL';
  });
  const [demandDay, setDemandDay] = useState(() => searchParams.get('scheduleDemandDay') ?? 'ALL');
  const [printMode, setPrintMode] = useState<'period' | 'filtered' | 'analysis' | null>(null);
  const [pdfExporting, setPdfExporting] = useState(false);

  useEffect(() => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      const setOrDelete = (key: string, value: string, defaultValue = '') => {
        if (value && value !== defaultValue) next.set(key, value);
        else next.delete(key);
      };
      setOrDelete('scheduleSearch', search.trim());
      setOrDelete('scheduleDay', day, 'ALL');
      setOrDelete('scheduleRoom', room, 'ALL');
      setOrDelete('scheduleRoomType', roomType, 'ALL');
      setOrDelete('scheduleProgram', program, 'ALL');
      setOrDelete('scheduleYear', year, 'ALL');
      setOrDelete('scheduleType', type, 'ALL');
      setOrDelete('scheduleDemandGroup', demandGroupBy, 'program');
      setOrDelete('scheduleDemandSort', demandSortBy, 'entries');
      setOrDelete('scheduleDemandType', demandType, 'ALL');
      setOrDelete('scheduleDemandRoomType', demandRoomType, 'ALL');
      setOrDelete('scheduleDemandDay', demandDay, 'ALL');
      return next;
    }, { replace: true });
  }, [
    day,
    demandDay,
    demandGroupBy,
    demandRoomType,
    demandSortBy,
    demandType,
    program,
    room,
    roomType,
    search,
    setSearchParams,
    type,
    year,
  ]);

  const periodSchedules = useMemo(
    () => schedules.filter((schedule) => schedule.scheduleType === 'WEEKLY' || inDateRange(schedule.scheduleDate, range)),
    [range, schedules]
  );

  const options = useMemo(() => ({
    rooms: Array.from(new Set(periodSchedules.map(scheduleRoom))).sort(),
    programs: Array.from(new Set(periodSchedules.map(scheduleProgram).filter((value) => value !== '—'))).sort(),
    years: Array.from(new Set(periodSchedules.map((schedule) => schedule.yearLevel).filter((value) => value != null))).sort(
      (first, second) => Number(first) - Number(second)
    ),
  }), [periodSchedules]);

  const filteredSchedules = useMemo(() => {
    const query = search.trim().toLowerCase();
    return periodSchedules
      .filter((schedule) => day === 'ALL' || scheduleDay(schedule) === day)
      .filter((schedule) => room === 'ALL' || scheduleRoom(schedule) === room)
      .filter((schedule) =>
        roomType === 'ALL' ||
        (roomType === 'COMPUTER_LAB' ? schedule.room?.isComputerLab === true : schedule.room?.isComputerLab !== true)
      )
      .filter((schedule) => program === 'ALL' || scheduleProgram(schedule) === program)
      .filter((schedule) => year === 'ALL' || String(schedule.yearLevel) === year)
      .filter((schedule) => type === 'ALL' || schedule.scheduleType === type)
      .filter((schedule) => {
        if (!query) return true;
        return [scheduleRoom(schedule), scheduleFaculty(schedule), scheduleSubject(schedule), scheduleProgram(schedule), scheduleDay(schedule)]
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort((first, second) => {
        if (first.scheduleType === 'WEEKLY' && second.scheduleType !== 'WEEKLY') return 1;
        if (first.scheduleType !== 'WEEKLY' && second.scheduleType === 'WEEKLY') return -1;
        return new Date(first.scheduleDate ?? first.timeStart).getTime() - new Date(second.scheduleDate ?? second.timeStart).getTime();
      });
  }, [day, periodSchedules, program, room, roomType, search, type, year]);

  const [schedulePage, setSchedulePage] = useState(1);
  const [schedulePageSize, setSchedulePageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const paginatedSchedules = useMemo(() => {
    const start = (schedulePage - 1) * schedulePageSize;
    return filteredSchedules.slice(start, start + schedulePageSize);
  }, [filteredSchedules, schedulePage, schedulePageSize]);

  const pageReset1Inputs = [day, program, range.from, range.to, room, roomType, search, type, year, filteredSchedules.length];
  const [pageReset1Previous, setpageReset1Previous] = useState<unknown[] | null>(null);
  if (!pageReset1Previous || pageReset1Inputs.some((value, index) => !Object.is(value, pageReset1Previous[index]))) {
    setpageReset1Previous(pageReset1Inputs);
    setSchedulePage(1);
  }

  const activeFilterCount = [
    search.trim(),
    day !== 'ALL',
    room !== 'ALL',
    roomType !== 'ALL',
    program !== 'ALL',
    year !== 'ALL',
    type !== 'ALL',
  ].filter(Boolean).length;

  const appliedFilters = useMemo(() => {
    const chips: Array<{ id: 'search' | 'day' | 'type' | 'room' | 'roomType' | 'program' | 'year'; label: string }> = [];
    if (search.trim()) chips.push({ id: 'search', label: `Search: ${search.trim()}` });
    if (day !== 'ALL') chips.push({ id: 'day', label: `Day: ${day}` });
    if (type !== 'ALL') chips.push({ id: 'type', label: `Type: ${type === 'WEEKLY' ? 'Recurring' : 'One-time'}` });
    if (room !== 'ALL') chips.push({ id: 'room', label: `Room: ${room}` });
    if (roomType !== 'ALL') {
      chips.push({ id: 'roomType', label: `Room type: ${roomType === 'COMPUTER_LAB' ? 'Computer labs' : 'Other rooms'}` });
    }
    if (program !== 'ALL') chips.push({ id: 'program', label: `Program: ${program}` });
    if (year !== 'ALL') chips.push({ id: 'year', label: `Year: ${year}` });
    return chips;
  }, [day, program, room, roomType, search, type, year]);

  const removeFilter = (id: (typeof appliedFilters)[number]['id']) => {
    if (id === 'search') setSearch('');
    if (id === 'day') setDay('ALL');
    if (id === 'type') setType('ALL');
    if (id === 'room') setRoom('ALL');
    if (id === 'roomType') setRoomType('ALL');
    if (id === 'program') setProgram('ALL');
    if (id === 'year') setYear('ALL');
  };

  const scheduleSummary = useMemo(
    () => ({
      schedules: filteredSchedules.length,
      recurring: filteredSchedules.filter((schedule) => schedule.scheduleType === 'WEEKLY').length,
      rooms: new Set(filteredSchedules.map(scheduleRoom)).size,
      sections: new Set(
        filteredSchedules.map((schedule) => formatSectionLabel(schedule.program?.code ?? schedule.program?.name, schedule.yearLevel))
      ).size,
    }),
    [filteredSchedules]
  );

  const periodPrintRows = useMemo(() => buildSchedulePrintRows(periodSchedules), [periodSchedules]);
  const filteredPrintRows = useMemo(() => buildSchedulePrintRows(filteredSchedules), [filteredSchedules]);
  const scheduleLogDefinition = useMemo<PrintableReportDefinition<SchedulePrintRow>>(
    () => ({
      title: 'Laboratory Schedule Log',
      filename: 'smartlab-schedule-log.csv',
      rows: filteredPrintRows,
      columns: [
        { key: 'dayDate', label: 'Day / date', width: '13%' },
        { key: 'room', label: 'Room', width: '13%' },
        { key: 'subject', label: 'Subject', width: '18%' },
        { key: 'faculty', label: 'Faculty-in-charge', width: '18%' },
        { key: 'section', label: 'Section', width: '16%' },
        { key: 'time', label: 'Time', width: '12%' },
        { key: 'type', label: 'Schedule type', width: '10%' },
      ],
    }),
    [filteredPrintRows]
  );
  const printableScheduleRows = printMode === 'period' ? periodPrintRows : filteredPrintRows;
  const printableScheduleDefinition = useMemo(
    () => ({ ...scheduleLogDefinition, rows: printableScheduleRows }),
    [printableScheduleRows, scheduleLogDefinition]
  );

  const demandSchedules = useMemo(
    () =>
      filteredSchedules
        .filter((schedule) => demandType === 'ALL' || schedule.scheduleType === demandType)
        .filter(
          (schedule) =>
            demandRoomType === 'ALL' ||
            (demandRoomType === 'COMPUTER_LAB'
              ? schedule.room?.isComputerLab === true
              : schedule.room?.isComputerLab !== true)
        )
        .filter((schedule) => demandDay === 'ALL' || scheduleDay(schedule) === demandDay),
    [demandDay, demandRoomType, demandType, filteredSchedules]
  );

  const scheduleDemandRows = useMemo(
    () => buildScheduleDemandRows(demandSchedules, demandGroupBy, demandSortBy),
    [demandGroupBy, demandSortBy, demandSchedules]
  );

  const demandAppliedFilters = useMemo(() => {
    const chips: Array<{
      id: 'demandGroupBy' | 'demandSortBy' | 'demandType' | 'demandRoomType' | 'demandDay';
      label: string;
    }> = [];
    if (demandGroupBy !== 'program') {
      chips.push({ id: 'demandGroupBy', label: `Group by: ${scheduleDemandGroupLabels[demandGroupBy]}` });
    }
    if (demandSortBy !== 'entries') {
      chips.push({ id: 'demandSortBy', label: 'Rank by: Rooms used' });
    }
    if (demandType !== 'ALL') {
      chips.push({ id: 'demandType', label: `Schedule type: ${demandType === 'WEEKLY' ? 'Recurring' : 'One-time'}` });
    }
    if (demandRoomType !== 'ALL') {
      chips.push({
        id: 'demandRoomType',
        label: `Room type: ${demandRoomType === 'COMPUTER_LAB' ? 'Computer labs' : 'Other rooms'}`,
      });
    }
    if (demandDay !== 'ALL') chips.push({ id: 'demandDay', label: `Day: ${demandDay}` });
    return chips;
  }, [demandDay, demandGroupBy, demandRoomType, demandSortBy, demandType]);

  const clearDemandFilters = () => {
    setDemandGroupBy('program');
    setDemandSortBy('entries');
    setDemandType('ALL');
    setDemandRoomType('ALL');
    setDemandDay('ALL');
  };

  const removeDemandFilter = (id: (typeof demandAppliedFilters)[number]['id']) => {
    if (id === 'demandGroupBy') setDemandGroupBy('program');
    if (id === 'demandSortBy') setDemandSortBy('entries');
    if (id === 'demandType') setDemandType('ALL');
    if (id === 'demandRoomType') setDemandRoomType('ALL');
    if (id === 'demandDay') setDemandDay('ALL');
  };

  const scheduleAnalysisDefinition = useMemo<PrintableReportDefinition<ScheduleDemandRow>>(
    () => ({
      title: 'Schedule Section Analysis',
      filename: 'smartlab-schedule-analysis.csv',
      rows: scheduleDemandRows,
      columns: [
        { key: 'section', label: 'Program / year level', width: '40%' },
        { key: 'entries', label: 'Schedule entries', width: '20%' },
        { key: 'rooms', label: 'Rooms used', width: '20%' },
        { key: 'recurring', label: 'Recurring entries', width: '20%' },
      ],
    }),
    [scheduleDemandRows]
  );

  const handleExport = () => {
    downloadCsv(
      'smartlab-schedule-report.csv',
      ['Day / date', 'Room', 'Subject', 'Faculty', 'Section', 'Time', 'Type'],
      filteredSchedules.map((schedule) => [
        schedule.scheduleType === 'WEEKLY' ? `Every ${scheduleDay(schedule)}` : formatDate(schedule.scheduleDate),
        scheduleRoom(schedule),
        scheduleSubject(schedule),
        scheduleFaculty(schedule),
        formatSectionLabel(schedule.program?.code ?? schedule.program?.name, schedule.yearLevel),
        formatTimeRange(schedule.timeStart, schedule.timeEnd),
        schedule.scheduleType === 'WEEKLY' ? 'Recurring' : 'One-time',
      ])
    );
  };

  const exportSchedulePdf = async (scope: 'period' | 'filtered', view: 'log' | 'analysis' = 'log') => {
    setPdfExporting(true);
    try {
      const response = await reportsApi.downloadLabSchedulePdf({
        scope,
        view,
        academicYearId: academicPeriod.academicYearId || undefined,
        termId: academicPeriod.termId || undefined,
        from: range.from || undefined,
        to: range.to || undefined,
        ...(scope === 'filtered'
          ? {
              search: search.trim() || undefined,
              day: day === 'ALL' ? undefined : day,
              room: room === 'ALL' ? undefined : room,
              roomType,
              program: program === 'ALL' ? undefined : program,
              year: year === 'ALL' ? undefined : year,
              scheduleType: type,
            }
          : {}),
      });
      const contentDisposition = response.headers['content-disposition'] as string | undefined;
      const fallbackName =
        view === 'analysis'
          ? 'smartlab-schedule-analysis.pdf'
          : `smartlab-schedule-log${scope === 'filtered' ? '-filtered' : ''}.pdf`;
      const filename = contentDisposition?.match(/filename="?([^"]+)"?/)?.[1] ?? fallbackName;
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(
        view === 'analysis'
          ? 'The schedule analysis PDF was generated and downloaded.'
          : 'The schedule PDF was generated and downloaded.'
      );
    } catch (error) {
      console.error('Failed to export the schedule report PDF.', error);
      toast.error((error as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'The schedule PDF could not be generated. Please try again.');
    } finally {
      setPdfExporting(false);
    }
  };

  const startPrint = (mode: 'period' | 'filtered' | 'analysis') => {
    setPrintMode(mode);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.print());
    });
  };

  useEffect(() => {
    if (!printMode) return undefined;
    const resetPrintMode = () => setPrintMode(null);
    window.addEventListener('afterprint', resetPrintMode);
    return () => window.removeEventListener('afterprint', resetPrintMode);
  }, [printMode]);

  const clearFilters = () => {
    setSearch('');
    setDay('ALL');
    setRoom('ALL');
    setRoomType('ALL');
    setProgram('ALL');
    setYear('ALL');
    setType('ALL');
  };

  const hasPeriodData = periodSchedules.length > 0;
  const hasFilteredData = filteredSchedules.length > 0;
  const scheduleReportActions = (
    <ScheduleReportOutputMenu
      onPrintFullReport={() => startPrint('period')}
      onPrintFilteredTable={() => startPrint('filtered')}
      onPrintAnalysis={() => startPrint('analysis')}
      onExportPdfFullReport={() => exportSchedulePdf('period')}
      onExportPdfFilteredTable={() => exportSchedulePdf('filtered')}
      onExportPdfAnalysis={() => exportSchedulePdf('filtered', 'analysis')}
      onExportFilteredTable={handleExport}
      fullReportDisabled={!hasPeriodData}
      filteredReportDisabled={!hasFilteredData}
      analysisDisabled={scheduleDemandRows.length === 0}
      pdfExporting={pdfExporting}
    />
  );

  return (
    <>
      <FormalReportFrame
        title="SmartLab Laboratory Schedule Report"
        subtitle="Analyze room and class schedules by day, schedule type, program, and year level."
        range={range}
        className="schedule-report-screen"
      >
      <div className="space-y-4">
        {actionPortalTarget
          ? createPortal(<div className="flex flex-wrap gap-2">{scheduleReportActions}</div>, actionPortalTarget)
          : <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">{scheduleReportActions}</div>}
         {primaryFilterPortalTarget && advancedFilterPortalTarget ? (
           <CompactFilterPanel
             className="w-full reports-detail-filter-panel"
             ribbonToggle
             primaryPortalTarget={primaryFilterPortalTarget}
             advancedPortalTarget={advancedFilterPortalTarget}
             advancedTogglePortalTarget={bottomControlPortalTarget}
             primary={
               <FilterItem label="Search" className="min-w-0">
                 <InputField
                   type="search"
                   value={search}
                   onChange={(event) => setSearch(event.target.value)}
                   placeholder="Search faculty, room, subject, or program…"
                   size="md"
                 />
               </FilterItem>
             }
          advanced={
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <FilterItem label="Day" className="min-w-0">
                <DropdownField
                  value={day}
                  options={[{ value: 'ALL', label: 'All days' }, ...dayNames.map((value) => ({ value, label: value }))]}
                  onChange={setDay}
                   placeholder="All days"
                 />
              </FilterItem>
              <FilterItem label="Type" className="min-w-0">
                <DropdownField
                  value={type}
                  options={[
                    { value: 'ALL', label: 'All types' },
                    { value: 'WEEKLY', label: 'Recurring' },
                    { value: 'ONE_TIME', label: 'One-time' },
                  ]}
                  onChange={setType}
                  placeholder="All types"
                />
              </FilterItem>
              <FilterItem label="Room" className="min-w-0">
                <DropdownField
                  value={room}
                  options={[{ value: 'ALL', label: 'All rooms' }, ...options.rooms.map((value) => ({ value, label: value }))]}
                  onChange={setRoom}
                  placeholder="All rooms"
                />
              </FilterItem>
              <FilterItem label="Room type" className="min-w-0">
                <DropdownField
                  value={roomType}
                  options={[
                    { value: 'ALL', label: 'All room types' },
                    { value: 'COMPUTER_LAB', label: 'Computer labs' },
                    { value: 'OTHER', label: 'Other rooms' },
                  ]}
                  onChange={setRoomType}
                  placeholder="All room types"
                />
              </FilterItem>
              <FilterItem label="Program" className="min-w-0">
                <DropdownField
                  value={program}
                  options={[{ value: 'ALL', label: 'All programs' }, ...options.programs.map((value) => ({ value, label: value }))]}
                  onChange={setProgram}
                  placeholder="All programs"
                />
              </FilterItem>
              <FilterItem label="Year level" className="min-w-0">
                <DropdownField
                  value={year}
                  options={[
                    { value: 'ALL', label: 'All year levels' },
                    ...options.years.map((value) => ({ value: String(value), label: `${value} Year` })),
                  ]}
                  onChange={setYear}
                  placeholder="All year levels"
                />
              </FilterItem>
            </div>
          }
          advancedCount={[
            day !== 'ALL',
            type !== 'ALL',
            room !== 'ALL',
            roomType !== 'ALL',
            program !== 'ALL',
            year !== 'ALL',
          ].filter(Boolean).length}
          defaultAdvancedOpen={activeFilterCount > 1 || (activeFilterCount === 1 && !search.trim())}
          hasActiveFilters={appliedFilters.length > 0}
          onReset={clearFilters}
          activeFilters={
            appliedFilters.length > 0 ? (
              <div className="reports-detail-active-filter-row flex flex-wrap items-center gap-2 border-t border-[#e5e7eb] pt-3">
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
          ) : null}

        <div aria-hidden="true" className="h-0.5 w-full rounded-full bg-[#c8aaa2]" />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Schedules shown', value: scheduleSummary.schedules, detail: 'Matching the period and filters', tone: 'maroon' },
            { label: 'Recurring schedules', value: scheduleSummary.recurring, detail: 'Weekly entries in the result', tone: 'blue' },
            { label: 'Rooms in use', value: scheduleSummary.rooms, detail: 'Distinct rooms in the result', tone: 'amber' },
            { label: 'Sections covered', value: scheduleSummary.sections, detail: 'Program and year combinations', tone: 'green' },
          ].map((metric) => (
            <div key={metric.label} className={`rounded-2xl border p-4 ${
              metric.tone === 'maroon'
                ? 'border-[#f1d4d4] bg-[#fff8f8]'
                : metric.tone === 'blue'
                  ? 'border-[#dce9fb] bg-[#f7faff]'
                  : metric.tone === 'amber'
                    ? 'border-[#f6e8b1] bg-[#fffdf5]'
                    : 'border-[#d8f0df] bg-[#f7fdf9]'
            }`}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">{metric.label}</p>
              <p className="mt-1 text-2xl font-bold text-[#111827]">{metric.value}</p>
              <p className="mt-1 text-xs text-[#6b7280]">{metric.detail}</p>
            </div>
          ))}
        </div>

        <div aria-hidden="true" className="h-0.5 w-full rounded-full bg-[#c8aaa2]" />

        <div>
          <div className="mb-4 rounded-2xl border border-[#eee5e3] bg-white p-4 lg:p-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9a7770]">Schedule overview</p>
              <h3 className="mt-1 text-base font-semibold text-[#241f20]">Where is schedule demand coming from?</h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-[#8c8080]">
                Compare schedule concentration across compatible groups using the current schedule filters.
              </p>
            </div>
          </div>
          <CompactFilterPanel
            className="mb-4"
            primary={
              <FilterItem label="Group by" className="min-w-0">
                <DropdownField
                  value={demandGroupBy}
                  options={Object.entries(scheduleDemandGroupLabels).map(([value, label]) => ({
                    value: value as ScheduleDemandGroupBy,
                    label,
                  }))}
                  onChange={(value) => setDemandGroupBy(value as ScheduleDemandGroupBy)}
                  placeholder="Select grouping"
                />
              </FilterItem>
             }
            advanced={
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                <FilterItem label="Rank by" className="min-w-0">
                  <DropdownField
                    value={demandSortBy}
                    options={[
                      { value: 'entries', label: 'Schedule entries' },
                      { value: 'rooms', label: 'Rooms used' },
                    ]}
                    onChange={(value) => setDemandSortBy(value as ScheduleDemandSortBy)}
                    placeholder="Schedule entries"
                  />
                </FilterItem>
                <FilterItem label="Schedule type" className="min-w-0">
                  <DropdownField
                    value={demandType}
                    options={[
                      { value: 'ALL', label: 'All types' },
                      { value: 'WEEKLY', label: 'Recurring' },
                      { value: 'ONE_TIME', label: 'One-time' },
                    ]}
                    onChange={(value) => setDemandType(value as 'ALL' | 'WEEKLY' | 'ONE_TIME')}
                    placeholder="All types"
                  />
                </FilterItem>
                <FilterItem label="Room type" className="min-w-0">
                  <DropdownField
                    value={demandRoomType}
                    options={[
                      { value: 'ALL', label: 'All room types' },
                      { value: 'COMPUTER_LAB', label: 'Computer labs' },
                      { value: 'OTHER', label: 'Other rooms' },
                    ]}
                    onChange={(value) => setDemandRoomType(value as 'ALL' | 'COMPUTER_LAB' | 'OTHER')}
                    placeholder="All room types"
                  />
                </FilterItem>
                <FilterItem label="Day" className="min-w-0">
                  <DropdownField
                    value={demandDay}
                    options={[{ value: 'ALL', label: 'All days' }, ...dayNames.map((value) => ({ value, label: value }))]}
                    onChange={setDemandDay}
                    placeholder="All days"
                  />
                </FilterItem>
              </div>
            }
            advancedCount={[
              demandSortBy !== 'entries',
              demandType !== 'ALL',
              demandRoomType !== 'ALL',
              demandDay !== 'ALL',
            ].filter(Boolean).length}
            defaultAdvancedOpen={
              demandSortBy !== 'entries' ||
              demandType !== 'ALL' ||
              demandRoomType !== 'ALL' ||
              demandDay !== 'ALL'
            }
            hasActiveFilters={demandAppliedFilters.length > 0}
            onReset={clearDemandFilters}
            activeFilters={
              demandAppliedFilters.length > 0 ? (
                <div className="reports-detail-active-filter-row flex flex-wrap items-center gap-2 border-t border-[#e5e7eb] pt-3">
                  <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Active</span>
                  {demandAppliedFilters.map((chip) => (
                    <span
                      key={chip.id}
                      className="filter-active-chip inline-flex items-center gap-2 rounded-full border border-[#f1caca] bg-[#fff7f7] px-3 py-1.5 text-[11px] font-semibold text-[#800000]"
                    >
                      <span className="filter-active-chip__label">{chip.label}</span>
                      <button
                        type="button"
                        onClick={() => removeDemandFilter(chip.id)}
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
          <ScheduleDemandPanel
            title={`Demand by ${scheduleDemandGroupLabels[demandGroupBy].toLowerCase()}`}
            description={scheduleDemandGroupDescriptions[demandGroupBy]}
            rows={scheduleDemandRows}
            sortBy={demandSortBy}
            emptyMessage={
              hasFilteredData
                ? 'No schedule entries match the selected demand filters.'
                : hasPeriodData
                  ? 'No schedules match the current filters. Clear one or more filters to restore the period.'
                  : 'No schedules were recorded in this reporting period.'
            }
          />
        </div>

        <div aria-hidden="true" className="h-0.5 w-full rounded-full bg-[#c8aaa2]" />

        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm lg:p-5">
          <div className="mb-4 rounded-2xl border border-[#eee5e3] bg-white p-4 lg:p-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9a7770]">Detailed log</p>
              <h3 className="mt-1 text-base font-semibold text-[#241f20]">Schedule records</h3>
            </div>
            <p className="text-xs text-[#8c8080]">
              {filteredSchedules.length} {filteredSchedules.length === 1 ? 'record' : 'records'} shown
            </p>
          </div>
          <TableContainer className="rounded-xl border border-[#e5e7eb]">
            <Table className="report-print-table min-w-[980px]">
              <TableHead>
                <TableHeaderCell>Day / date</TableHeaderCell>
                <TableHeaderCell>Room / time</TableHeaderCell>
                <TableHeaderCell>Subject</TableHeaderCell>
                <TableHeaderCell>Faculty-in-charge</TableHeaderCell>
                <TableHeaderCell>Section</TableHeaderCell>
                <TableHeaderCell>Schedule type</TableHeaderCell>
              </TableHead>
              <TableBody>
                {filteredSchedules.length === 0 ? (
                  <TableRow hover={false}>
                    <TableCell colSpan={6} align="center" className="py-12">
                      <div className="mx-auto max-w-md">
                        <p className="text-sm font-semibold text-[#4d4242]">
                          {hasPeriodData ? 'No schedules match the current filters' : 'No schedules found for this period'}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[#8c8080]">
                          {hasPeriodData
                            ? 'Try clearing one or more filters to see more schedule records.'
                            : 'Try changing the report period above to review a different set of schedule records.'}
                        </p>
                        {hasPeriodData && activeFilterCount > 0 && (
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="mt-4 rounded-full border border-[#800000] px-3 py-2 text-xs font-semibold text-[#800000] hover:bg-[#fff8f8]"
                          >
                            Clear schedule filters
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedSchedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="whitespace-nowrap">
                      <p className="font-semibold text-[#3f3636]">
                        {schedule.scheduleType === 'WEEKLY' ? `Every ${scheduleDay(schedule)}` : formatDate(schedule.scheduleDate)}
                      </p>
                      <span className="mt-1 inline-flex rounded-full bg-[#f8eee9] px-2 py-1 text-[10px] font-semibold text-[#8a4b3f]">
                        {scheduleDay(schedule)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-[#4d4242]">{scheduleRoom(schedule)}</p>
                      <p className="mt-1 whitespace-nowrap text-[11px] text-[#8c8080]">
                        {formatTimeRange(schedule.timeStart, schedule.timeEnd)}
                      </p>
                    </TableCell>
                    <TableCell className="text-[#5f5454]">{scheduleSubject(schedule)}</TableCell>
                    <TableCell className="text-[#5f5454]">{scheduleFaculty(schedule)}</TableCell>
                    <TableCell>
                      <p className="font-semibold text-[#3f3636]">
                        {formatSectionLabel(schedule.program?.code ?? schedule.program?.name, schedule.yearLevel)}
                      </p>
                      <p className="mt-1 text-[11px] text-[#8c8080]">{schedule.program?.name || 'Program not assigned'}</p>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex rounded-full bg-[#f8eee9] px-2 py-1 text-[10px] font-semibold text-[#8a4b3f]">
                        {schedule.scheduleType === 'WEEKLY' ? 'Recurring' : 'One-time'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            currentPage={schedulePage}
            pageSize={schedulePageSize}
            totalItems={filteredSchedules.length}
            onPageChange={setSchedulePage}
            onPageSizeChange={(size) => {
              setSchedulePageSize(size);
              setSchedulePage(1);
            }}
          />
        </div>
      </div>
      </FormalReportFrame>
      <div className="schedule-report-print-document">
        {printMode === 'analysis' ? (
          <PrintableReportDocument definition={scheduleAnalysisDefinition} rows={scheduleDemandRows} />
        ) : (
          <PrintableReportDocument definition={printableScheduleDefinition} rows={printableScheduleRows} />
        )}
      </div>
    </>
  );
}
