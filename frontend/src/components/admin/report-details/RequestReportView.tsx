import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { reportsApi } from '../../../services/api';
import { toast } from '../../../stores/toastStore';
import type { BorrowRequest, BorrowRequestStatus } from '../../../types/requests';
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
import { downloadPrintableReport } from '../printableReportUtils';
import '../reportDocumentStyles.css';
import { buildDemandRows, buildRequestPrintRows, demandGroupDescriptions, demandGroupLabels, demandRoomLabels, demandSourceLabels, demandStatusScopeLabels, formatDate, formatSectionLabel, getRequestUnits, inDateRange, reportableStatuses, reportYearLevels, statusLabels, type DateRange, type DemandGroupBy, type DemandRoomFilter, type DemandRow, type DemandSortBy, type DemandSourceFilter, type DemandStatusScope, type ReportCatalog, type RequestPrintRow } from './reportData';
import { FormalReportFrame, RequestReportOutputMenu } from './ReportOutput';

export function RequestDemandPanel({
  title,
  description,
  rows,
  emptyMessage,
  sortBy = 'requests',
  showTopEquipment = false,
}: {
  title: string;
  description: string;
  rows: DemandRow[];
  emptyMessage: string;
  sortBy?: DemandSortBy;
  showTopEquipment?: boolean;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const maxRankValue = Math.max(...rows.map((row) => (sortBy === 'requests' ? row.requests : row.units)), 1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="rounded-2xl border border-[#eee5e3] bg-[#fffcfb] p-4 lg:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[#241f20]">{title}</h3>
          <p className="mt-1 max-w-[34rem] text-xs leading-5 text-[#756b6b]">
            {description}
            {showTopEquipment && ` Ranked by ${sortBy === 'requests' ? 'request records' : 'units requested'}.`}
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
              const rank = (safePage - 1) * pageSize + index + 1;
              const rankValue = sortBy === 'requests' ? row.requests : row.units;
              const share = Math.max((rankValue / maxRankValue) * 100, 8);
              return (
                <div key={row.key} className="grid grid-cols-[28px_1fr_auto] items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f4e8e5] text-[11px] font-bold text-[#7f3f35]">
                    {rank}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <p
                        title={row.label}
                        className="break-words text-xs font-semibold leading-4 text-[#3f3636]"
                      >
                        {row.label}
                      </p>
                      <p className="shrink-0 text-[11px] font-semibold text-[#756b6b]">
                        {row.requests}{' '}
                        {showTopEquipment
                          ? row.requests === 1 ? 'request record' : 'request records'
                          : row.requests === 1 ? 'request' : 'requests'}
                      </p>
                    </div>
                    <p className="mt-1 text-[10px] text-[#9a9090]">
                      {showTopEquipment ? (
                        row.topEquipment ? (
                          <>
                            Top equipment: <span className="font-semibold text-[#756b6b]">{row.topEquipment.name}</span>
                            {' · '}{row.topEquipment.requests}{' '}
                            {row.topEquipment.requests === 1 ? 'request record' : 'request records'}
                          </>
                        ) : (
                          'No equipment details recorded'
                        )
                      ) : (
                        <>
                          {row.detail} · {row.studentSubmitted} student-submitted · {row.facultySubmitted} faculty-submitted
                        </>
                      )}
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f1e9e7]">
                      <div
                        className="h-full rounded-full bg-[#9b5a4e]"
                        style={{ width: `${share}%` }}
                        title={`${rankValue} ${sortBy === 'requests' ? 'request records' : 'units requested'}`}
                      />
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-[11px] text-[#8c8080]" title={`${row.units} units requested`}>
                    {row.units} {row.units === 1 ? 'unit' : 'units'}
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

export function RequestReportView({
  requests,
  range,
  catalog,
  academicPeriod,
  primaryFilterPortalTarget,
  advancedFilterPortalTarget,
  bottomControlPortalTarget,
  actionPortalTarget,
}: {
  requests: BorrowRequest[];
  range: DateRange;
  catalog: ReportCatalog;
  academicPeriod: AcademicPeriodSelection;
  primaryFilterPortalTarget: HTMLDivElement | null;
  advancedFilterPortalTarget: HTMLDivElement | null;
  bottomControlPortalTarget: HTMLDivElement | null;
  actionPortalTarget: HTMLDivElement | null;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('requestSearch') ?? '');
  const [status, setStatus] = useState<BorrowRequestStatus | 'ALL'>(() => {
    const value = searchParams.get('requestStatus');
    return value && value in statusLabels ? value as BorrowRequestStatus : 'ALL';
  });
  const [room, setRoom] = useState(() => searchParams.get('requestRoom') ?? 'ALL');
  const [program, setProgram] = useState(() => searchParams.get('requestProgram') ?? 'ALL');
  const [year, setYear] = useState(() => searchParams.get('requestYear') ?? 'ALL');
  const [demandGroupBy, setDemandGroupBy] = useState<DemandGroupBy>(() => {
    const value = searchParams.get('requestDemandGroup');
    return value && value in demandGroupLabels ? value as DemandGroupBy : 'faculty';
  });
  const [demandSource, setDemandSource] = useState<DemandSourceFilter>(() => {
    const value = searchParams.get('requestDemandSource');
    return value === 'STUDENT' || value === 'FACULTY' ? value : 'ALL';
  });
  const [demandRoomType, setDemandRoomType] = useState<DemandRoomFilter>(() => {
    const value = searchParams.get('requestDemandRoomType');
    return value === 'COMPUTER_LAB' || value === 'OTHER' ? value : 'ALL';
  });
  const [demandStatusScope, setDemandStatusScope] = useState<DemandStatusScope>(() =>
    searchParams.get('requestDemandStatus') === 'ALL' ? 'ALL' : 'ACTIVE'
  );
  const [printMode, setPrintMode] = useState<'period' | 'filtered' | 'demand' | null>(null);
  const [pdfExporting, setPdfExporting] = useState(false);

  useEffect(() => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      const setOrDelete = (key: string, value: string, defaultValue = '') => {
        if (value && value !== defaultValue) next.set(key, value);
        else next.delete(key);
      };
      setOrDelete('requestSearch', search.trim());
      setOrDelete('requestStatus', status, 'ALL');
      setOrDelete('requestRoom', room, 'ALL');
      setOrDelete('requestProgram', program, 'ALL');
      setOrDelete('requestYear', year, 'ALL');
      setOrDelete('requestDemandGroup', demandGroupBy, 'faculty');
      setOrDelete('requestDemandSource', demandSource, 'ALL');
      setOrDelete('requestDemandRoomType', demandRoomType, 'ALL');
      setOrDelete('requestDemandStatus', demandStatusScope, 'ACTIVE');
      return next;
    }, { replace: true });
  }, [
    demandGroupBy,
    demandRoomType,
    demandSource,
    demandStatusScope,
    program,
    room,
    search,
    setSearchParams,
    status,
    year,
  ]);

  const periodRequests = useMemo(
    () => requests.filter((request) => inDateRange(request.dateNeeded, range)),
    [range, requests]
  );

  const options = useMemo(() => {
    return {
      rooms: Array.from(new Set([
        ...catalog.rooms,
        ...periodRequests.map((request) => request.location).filter((value): value is string => Boolean(value)),
      ])).sort(),
      programs: Array.from(new Set([
        ...catalog.programs,
        ...periodRequests.map((request) => request.program).filter((value): value is string => Boolean(value)),
      ])).sort(),
      years: Array.from(new Set([
        ...catalog.yearLevels.filter((value) => reportYearLevels.has(value)),
        ...periodRequests
          .map((request) => request.yearLevel)
          .filter((value): value is number => value != null && reportYearLevels.has(value)),
      ])).sort(
        (first, second) => Number(first) - Number(second)
      ),
    };
  }, [catalog, periodRequests]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return periodRequests
      .filter((request) => status === 'ALL' || request.status === status)
      .filter((request) => room === 'ALL' || request.location === room)
      .filter((request) => program === 'ALL' || request.program === program)
      .filter((request) => year === 'ALL' || String(request.yearLevel) === year)
      .filter((request) => {
        if (!query) return true;
        const haystack = [
          request.requesterName,
          request.location,
          request.equipmentList,
          request.program,
              request.facultyName,
              request.subject,
          request.status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      });
  }, [periodRequests, program, room, search, status, year]);

  const [requestPage, setRequestPage] = useState(1);
  const [requestPageSize, setRequestPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const paginatedRequests = useMemo(() => {
    const start = (requestPage - 1) * requestPageSize;
    return filteredRequests.slice(start, start + requestPageSize);
  }, [filteredRequests, requestPage, requestPageSize]);

  const pageReset1Inputs = [program, range.from, range.to, room, search, status, year, filteredRequests.length];
  const [pageReset1Previous, setpageReset1Previous] = useState<unknown[] | null>(null);
  if (!pageReset1Previous || pageReset1Inputs.some((value, index) => !Object.is(value, pageReset1Previous[index]))) {
    setpageReset1Previous(pageReset1Inputs);
    setRequestPage(1);
  }

  const requestFilterCount = [
    search.trim(),
    status !== 'ALL',
    room !== 'ALL',
    program !== 'ALL',
    year !== 'ALL',
  ].filter(Boolean).length;

  const filteredPrintRows = useMemo(
    () => buildRequestPrintRows(filteredRequests),
    [filteredRequests]
  );
  const periodPrintRows = useMemo(
    () => buildRequestPrintRows(periodRequests),
    [periodRequests]
  );
  const requestLogDefinition = useMemo<PrintableReportDefinition<RequestPrintRow>>(
    () => ({
      title: 'Borrow Request Log',
      filename: `smartlab-request-log${range.from ? `-${range.from}` : ''}${range.to ? `-to-${range.to}` : ''}${
        requestFilterCount > 0 ? '-filtered' : ''
      }.csv`,
      rows: filteredPrintRows,
      columns: [
        { key: 'date', label: 'Date', width: '9%' },
        { key: 'room', label: 'Room', width: '9%' },
        { key: 'equipment', label: 'Equipment', width: '17%' },
        { key: 'requester', label: 'Requester', width: '16%' },
        { key: 'programYear', label: 'Section', width: '11%' },
        { key: 'faculty', label: 'Faculty-in-Charge', width: '15%' },
        { key: 'time', label: 'Time', width: '9%' },
        { key: 'status', label: 'Status', width: '7%' },
        { key: 'subject', label: 'Subject', width: '7%' },
      ],
    }),
    [filteredPrintRows, range.from, range.to, requestFilterCount]
  );
  const printableRows = printMode === 'period' ? periodPrintRows : filteredPrintRows;
  const printableDefinition = useMemo(
    () => ({ ...requestLogDefinition, rows: printableRows }),
    [printableRows, requestLogDefinition]
  );

  const appliedFilters = useMemo(() => {
    const chips: Array<{
      id:
        | 'search'
        | 'status'
        | 'room'
        | 'program'
        | 'year'
        | 'demandGroupBy'
        | 'demandSource'
        | 'demandRoomType'
        | 'demandStatusScope';
      label: string;
    }> = [];

    if (search.trim()) chips.push({ id: 'search', label: `Search: ${search.trim()}` });
    if (status !== 'ALL') chips.push({ id: 'status', label: `Status: ${statusLabels[status]}` });
    if (room !== 'ALL') chips.push({ id: 'room', label: `Room: ${room}` });
    if (program !== 'ALL') chips.push({ id: 'program', label: `Program: ${program}` });
    if (year !== 'ALL') chips.push({ id: 'year', label: `Year: ${year}` });
    if (demandGroupBy !== 'faculty') {
      chips.push({ id: 'demandGroupBy', label: `Group by: ${demandGroupLabels[demandGroupBy]}` });
    }
    if (demandSource !== 'ALL') {
      chips.push({ id: 'demandSource', label: `Submitted through: ${demandSourceLabels[demandSource]}` });
    }
    if (demandRoomType !== 'ALL') {
      chips.push({ id: 'demandRoomType', label: `Room type: ${demandRoomLabels[demandRoomType]}` });
    }
    if (demandStatusScope !== 'ACTIVE') {
      chips.push({ id: 'demandStatusScope', label: `Status scope: ${demandStatusScopeLabels[demandStatusScope]}` });
    }

    return chips;
  }, [demandGroupBy, demandRoomType, demandSource, demandStatusScope, program, room, search, status, year]);

  const removeFilter = (id: (typeof appliedFilters)[number]['id']) => {
    if (id === 'search') setSearch('');
    if (id === 'status') setStatus('ALL');
    if (id === 'room') setRoom('ALL');
    if (id === 'program') setProgram('ALL');
    if (id === 'year') setYear('ALL');
    if (id === 'demandGroupBy') setDemandGroupBy('faculty');
    if (id === 'demandSource') setDemandSource('ALL');
    if (id === 'demandRoomType') setDemandRoomType('ALL');
    if (id === 'demandStatusScope') setDemandStatusScope('ACTIVE');
  };

  const demandAppliedFilters = appliedFilters.filter(
    (filter) =>
      filter.id === 'demandSource' ||
      filter.id === 'demandRoomType' ||
      filter.id === 'demandStatusScope' ||
      filter.id === 'demandGroupBy'
  );
  const requestAppliedFilters = appliedFilters.filter(
    (filter) =>
      filter.id === 'search' ||
      filter.id === 'status' ||
      filter.id === 'room' ||
      filter.id === 'program' ||
      filter.id === 'year'
  );

  const clearDemandFilters = () => {
    setDemandGroupBy('faculty');
    setDemandSource('ALL');
    setDemandRoomType('ALL');
    setDemandStatusScope('ACTIVE');
  };

  const requestSummary = useMemo(() => {
    const completed = filteredRequests.filter(
      (request) => request.status === 'BORROWED' || request.status === 'RETURNED'
    ).length;
    const units = filteredRequests.reduce((total, request) => total + getRequestUnits(request), 0);
    const pending = filteredRequests.filter((request) => request.status === 'PENDING').length;

    return {
      requests: filteredRequests.length,
      units,
      pending,
      completed,
    };
  }, [filteredRequests]);

  const demandRows = useMemo(() => {
    const demandRequests = filteredRequests
      .filter((request) => demandStatusScope === 'ALL' || reportableStatuses.has(request.status))
      .filter((request) => demandSource === 'ALL' || request.requesterRole === demandSource)
      .filter((request) => {
        if (demandRoomType === 'ALL') return true;
        if (demandRoomType === 'COMPUTER_LAB') return request.isComputerLab === true;
        return request.isComputerLab !== true;
      });
    return buildDemandRows(demandRequests, demandGroupBy);
  }, [demandGroupBy, demandRoomType, demandSource, demandStatusScope, filteredRequests]);
  const demandAnalysisDefinition = useMemo<PrintableReportDefinition<DemandRow>>(
    () => ({
      title: `Request Demand Analysis – ${demandGroupLabels[demandGroupBy]}`,
      filename: `smartlab-request-demand-analysis-${demandGroupBy}.csv`,
      rows: demandRows,
      columns: [
        { key: 'label', label: 'Group', width: '28%' },
        { key: 'detail', label: 'Group type', width: '20%' },
        { key: 'requests', label: 'Requests', width: '12%' },
        { key: 'units', label: 'Equipment units', width: '14%' },
        { key: 'studentSubmitted', label: 'Student-submitted', width: '13%' },
        { key: 'facultySubmitted', label: 'Faculty-submitted', width: '13%' },
      ],
    }),
    [demandGroupBy, demandRows]
  );
  const handleExport = () => {
    downloadPrintableReport(requestLogDefinition);
  };

  const exportRequestPdf = async (scope: 'period' | 'filtered') => {
    setPdfExporting(true);
    try {
      const response = await reportsApi.downloadBorrowRequestPdf({
        scope,
        academicYearId: academicPeriod.academicYearId || undefined,
        termId: academicPeriod.termId || undefined,
        from: range.from || undefined,
        to: range.to || undefined,
        ...(scope === 'filtered'
          ? {
              search: search.trim() || undefined,
              status: status === 'ALL' ? undefined : status,
              room: room === 'ALL' ? undefined : room,
              program: program === 'ALL' ? undefined : program,
              year: year === 'ALL' ? undefined : year,
            }
          : {}),
      });
      const contentDisposition = response.headers['content-disposition'] as string | undefined;
      const filename =
        contentDisposition?.match(/filename="?([^"]+)"?/)?.[1] ??
        `smartlab-request-log${scope === 'filtered' ? '-filtered' : ''}.pdf`;
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('The PDF report was generated and downloaded.');
    } catch (error) {
      console.error('Failed to export the request report PDF.', error);
      toast.error((error as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'The PDF report could not be generated. Please try again.');
    } finally {
      setPdfExporting(false);
    }
  };

  const exportPdfFullReport = () => exportRequestPdf('period');

  const exportPdfFilteredTable = () => exportRequestPdf('filtered');

  const exportDemandPdf = async () => {
    setPdfExporting(true);
    try {
      const response = await reportsApi.downloadDemandAnalysisPdf({
        scope: 'filtered',
        academicYearId: academicPeriod.academicYearId || undefined,
        termId: academicPeriod.termId || undefined,
        from: range.from || undefined,
        to: range.to || undefined,
        search: search.trim() || undefined,
        status: status === 'ALL' ? undefined : status,
        room: room === 'ALL' ? undefined : room,
        program: program === 'ALL' ? undefined : program,
        year: year === 'ALL' ? undefined : year,
        groupBy: demandGroupBy,
        demandSource,
        demandRoomType,
        demandStatusScope,
      });
      const contentDisposition = response.headers['content-disposition'] as string | undefined;
      const filename =
        contentDisposition?.match(/filename="?([^"]+)"?/)?.[1] ??
        `smartlab-request-demand-analysis-${demandGroupBy}.pdf`;
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('The demand analysis PDF was generated and downloaded.');
    } catch (error) {
      console.error('Failed to export the demand analysis PDF.', error);
      toast.error((error as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'The demand analysis PDF could not be generated. Please try again.');
    } finally {
      setPdfExporting(false);
    }
  };

  const printFullReport = () => {
    setPrintMode('period');
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.print());
    });
  };

  const printFilteredTable = () => {
    setPrintMode('filtered');
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.print());
    });
  };

  const printDemandAnalysis = () => {
    setPrintMode('demand');
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
    setStatus('ALL');
    setRoom('ALL');
    setProgram('ALL');
    setYear('ALL');
    setDemandSource('ALL');
    setDemandRoomType('ALL');
    setDemandStatusScope('ACTIVE');
  };

  const hasPeriodData = periodRequests.length > 0;
  const hasFilteredData = filteredRequests.length > 0;
  const requestReportActions = (
    <RequestReportOutputMenu
      onPrintFullReport={printFullReport}
      onPrintFilteredTable={printFilteredTable}
      onPrintDemandAnalysis={printDemandAnalysis}
      onExportPdfFullReport={exportPdfFullReport}
      onExportPdfFilteredTable={exportPdfFilteredTable}
      onExportDemandPdf={exportDemandPdf}
      onExportFilteredTable={handleExport}
      disabled={pdfExporting || !hasFilteredData}
      demandDisabled={pdfExporting || demandRows.length === 0}
    />
  );

  return (
    <>
      <FormalReportFrame
        title="SmartLab Borrow Request Report"
        subtitle="Analyze borrowing demand by faculty, submitter, program, subject, or requested room."
        range={range}
        className="request-report-screen"
      >
        <div className="space-y-4">
          {actionPortalTarget
            ? createPortal(<div className="flex flex-wrap gap-2">{requestReportActions}</div>, actionPortalTarget)
            : <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">{requestReportActions}</div>}
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
                   placeholder="Search name, room, equipment, faculty…"
                   size="md"
                 />
               </FilterItem>
             }
          advanced={
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <FilterItem label="Status" className="min-w-0">
                <DropdownField
                  value={status}
                  options={[
                    { value: 'ALL', label: 'All statuses' },
                    ...Object.entries(statusLabels).map(([value, label]) => ({
                      value: value as BorrowRequestStatus,
                      label,
                    })),
                  ]}
                  onChange={setStatus}
                   placeholder="All statuses"
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
          advancedCount={[status !== 'ALL', room !== 'ALL', program !== 'ALL', year !== 'ALL'].filter(Boolean).length}
          defaultAdvancedOpen={status !== 'ALL' || room !== 'ALL' || program !== 'ALL' || year !== 'ALL'}
          hasActiveFilters={requestAppliedFilters.length > 0}
          onReset={clearFilters}
          activeFilters={
            requestAppliedFilters.length > 0 ? (
              <div className="reports-detail-active-filter-row flex flex-wrap items-center gap-2 border-t border-[#e5e7eb] pt-3">
                <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Active</span>
                {requestAppliedFilters.map((chip) => (
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
            { label: 'Requests shown', value: requestSummary.requests, detail: 'Matching the period and filters', tone: 'maroon' },
            { label: 'Equipment units', value: requestSummary.units, detail: 'Units across matching requests', tone: 'blue' },
            { label: 'Pending review', value: requestSummary.pending, detail: 'Requests awaiting action', tone: 'amber' },
            { label: 'Borrowed or returned', value: requestSummary.completed, detail: 'Completed or in-use requests', tone: 'green' },
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
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9a7770]">Demand overview</p>
              <h3 className="mt-1 text-base font-semibold text-[#241f20]">Where is equipment demand coming from?</h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-[#8c8080]">
                Compare the groups behind the current request volume using an explicit request-status scope.
              </p>
            </div>
          </div>
          <CompactFilterPanel
            className="mb-4"
            primary={
              <FilterItem label="Group by" className="min-w-0">
                <DropdownField
                  value={demandGroupBy}
                  options={Object.entries(demandGroupLabels).map(([value, label]) => ({
                    value: value as DemandGroupBy,
                    label,
                  }))}
                  onChange={setDemandGroupBy}
                  placeholder="Select grouping"
                />
              </FilterItem>
            }
            advanced={
              <div className="grid gap-2.5 sm:grid-cols-3">
                <FilterItem label="Submitted through" className="min-w-0">
                  <DropdownField
                    value={demandSource}
                    options={Object.entries(demandSourceLabels).map(([value, label]) => ({
                      value: value as DemandSourceFilter,
                      label,
                    }))}
                    onChange={setDemandSource}
                    placeholder="All submitters"
                  />
                </FilterItem>
                <FilterItem label="Room type" className="min-w-0">
                  <DropdownField
                    value={demandRoomType}
                    options={Object.entries(demandRoomLabels).map(([value, label]) => ({
                      value: value as DemandRoomFilter,
                      label,
                    }))}
                    onChange={setDemandRoomType}
                    placeholder="All room types"
                  />
                </FilterItem>
                <FilterItem label="Status scope" className="min-w-0">
                  <DropdownField
                    value={demandStatusScope}
                    options={Object.entries(demandStatusScopeLabels).map(([value, label]) => ({
                      value: value as DemandStatusScope,
                      label,
                    }))}
                    onChange={setDemandStatusScope}
                    placeholder="Active borrowing demand"
                  />
                </FilterItem>
              </div>
            }
            advancedCount={[demandSource !== 'ALL', demandRoomType !== 'ALL', demandStatusScope !== 'ACTIVE'].filter(Boolean).length}
            defaultAdvancedOpen={demandSource !== 'ALL' || demandRoomType !== 'ALL' || demandStatusScope !== 'ACTIVE'}
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
          <div className="grid gap-3 xl:grid-cols-1">
            <RequestDemandPanel
              title={`Demand by ${demandGroupLabels[demandGroupBy].toLowerCase()}`}
              description={demandGroupDescriptions[demandGroupBy]}
              rows={demandRows}
              emptyMessage={
                hasFilteredData
                  ? 'No valid requests match the selected demand filters.'
                  : hasPeriodData
                    ? 'No requests match the current filters. Clear filters to restore the full period.'
                    : 'No requests were recorded in this reporting period.'
              }
            />
          </div>
        </div>

        <div aria-hidden="true" className="h-0.5 w-full rounded-full bg-[#c8aaa2]" />

        <div className="request-detail-table-section rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm lg:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9a7770]">Detailed log</p>
              <h3 className="mt-1 text-base font-semibold text-[#241f20]">Request records</h3>
            </div>
            <p className="text-xs text-[#8c8080]">
              {filteredRequests.length} {filteredRequests.length === 1 ? 'record' : 'records'} shown
            </p>
          </div>
          <TableContainer className="rounded-xl border border-[#e5e7eb]">
            <Table className="report-print-table min-w-[1020px]">
              <TableHead>
                <TableHeaderCell>Date / status</TableHeaderCell>
                <TableHeaderCell>Room / time</TableHeaderCell>
                <TableHeaderCell>Equipment</TableHeaderCell>
                <TableHeaderCell>Requester / section</TableHeaderCell>
                 <TableHeaderCell>Subject</TableHeaderCell>
                <TableHeaderCell>Faculty-in-charge</TableHeaderCell>
              </TableHead>
              <TableBody>
                {filteredRequests.length === 0 ? (
                  <TableRow hover={false}>
                    <TableCell colSpan={6} align="center" className="py-12">
                      <div className="mx-auto max-w-md">
                        <p className="text-sm font-semibold text-[#4d4242]">
                          {hasPeriodData ? 'No requests match the current filters' : 'No requests found for this period'}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[#8c8080]">
                          {hasPeriodData
                            ? 'Try clearing one or more filters to see more request records.'
                            : 'Try changing the report period above to review a different set of request records.'}
                        </p>
                        {hasPeriodData && requestFilterCount > 0 && (
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="mt-4 rounded-full border border-[#800000] px-3 py-2 text-xs font-semibold text-[#800000] hover:bg-[#fff8f8]"
                          >
                            Clear request filters
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="whitespace-nowrap">
                      <p className="font-semibold text-[#3f3636]">{formatDate(request.dateNeeded)}</p>
                      <span className="mt-1 inline-flex rounded-full bg-[#f8eee9] px-2 py-1 text-[10px] font-semibold text-[#8a4b3f]">
                        {statusLabels[request.status]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-[#4d4242]">{request.location || '—'}</p>
                      <p className="mt-1 whitespace-nowrap text-[11px] text-[#8c8080]">
                        {formatTimeRange(request.timeStart, request.timeEnd)}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-[240px]">
                      <p className="line-clamp-2 text-[#5f5454]">{request.equipmentList || '—'}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-[#3f3636]">{request.requesterName}</p>
                      <p className="mt-1 text-[11px] text-[#8c8080]">{formatSectionLabel(request.program, request.yearLevel)}</p>
                    </TableCell>
                     <TableCell className="text-[#5f5454]">{request.subject || '—'}</TableCell>
                    <TableCell className="text-[#5f5454]">{request.facultyName || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            currentPage={requestPage}
            pageSize={requestPageSize}
            totalItems={filteredRequests.length}
            onPageChange={setRequestPage}
            onPageSizeChange={(size) => {
              setRequestPageSize(size);
              setRequestPage(1);
            }}
          />
        </div>
        </div>
      </FormalReportFrame>
      <div className="request-report-print-document">
        {printMode === 'demand' ? (
          <PrintableReportDocument headerPeriod={academicPeriod} headerRange={range}
            definition={demandAnalysisDefinition}
            rows={demandRows}
          />
        ) : (
          <PrintableReportDocument headerPeriod={academicPeriod} headerRange={range}
            definition={printableDefinition}
            rows={printableRows}
          />
        )}
      </div>
    </>
  );
}
