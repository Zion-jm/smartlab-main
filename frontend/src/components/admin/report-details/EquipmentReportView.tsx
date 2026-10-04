import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { reportsApi } from '../../../services/api';
import { toast } from '../../../stores/toastStore';
import type { EquipmentItem, EquipmentStatus } from '../../../types/equipment';
import type { BorrowRequest } from '../../../types/requests';
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
import { buildDemandRows, buildSectionDemand, createEquipmentUsage, demandGroupDescriptions, demandGroupLabels, demandSourceLabels, demandStatusScopeLabels, downloadCsv, equipmentReportStatusOrder, equipmentStatusLabels, inDateRange, reportableStatuses, statusLabels, toEquipmentPrintRow, type DateRange, type DemandGroupBy, type DemandSortBy, type DemandSourceFilter, type DemandStatusScope, type EquipmentAnalysisPrintRow, type EquipmentOverviewRow, type EquipmentPrintRow, type EquipmentUsage } from './reportData';
import { EquipmentReportOutputMenu, FormalReportFrame } from './ReportOutput';
import { RequestDemandPanel } from './RequestReportView';

export function EquipmentReportView({
  equipment,
  requests,
  range,
  academicPeriod,
  primaryFilterPortalTarget,
  advancedFilterPortalTarget,
  bottomControlPortalTarget,
  actionPortalTarget,
}: {
  equipment: EquipmentItem[];
  requests: BorrowRequest[];
  range: DateRange;
  academicPeriod: AcademicPeriodSelection;
  primaryFilterPortalTarget: HTMLDivElement | null;
  advancedFilterPortalTarget: HTMLDivElement | null;
  bottomControlPortalTarget: HTMLDivElement | null;
  actionPortalTarget: HTMLDivElement | null;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('equipmentSearch') ?? '');
  const [status, setStatus] = useState<EquipmentStatus | 'ALL'>(() => {
    const value = searchParams.get('equipmentStatus');
    return value && value in equipmentStatusLabels ? value as EquipmentStatus : 'ALL';
  });
  const [printMode, setPrintMode] = useState<'period' | 'filtered' | 'analysis' | null>(null);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(() => searchParams.get('equipmentLowStock') === '1');
  const [reportMode, setReportMode] = useState<'USAGE' | 'INVENTORY'>(
    () => searchParams.get('equipmentView') === 'USAGE' || range.from || range.to ? 'USAGE' : 'INVENTORY'
  );
  const [demandGroupBy, setDemandGroupBy] = useState<DemandGroupBy>(() => {
    const value = searchParams.get('equipmentDemandGroup');
    return value && value in demandGroupLabels ? value as DemandGroupBy : 'program';
  });
  const [demandSource, setDemandSource] = useState<DemandSourceFilter>(() => {
    const value = searchParams.get('equipmentDemandSource');
    return value === 'STUDENT' || value === 'FACULTY' ? value : 'ALL';
  });
  const [demandSortBy, setDemandSortBy] = useState<DemandSortBy>(() =>
    searchParams.get('equipmentDemandSort') === 'units' ? 'units' : 'requests'
  );
  const [demandStatusScope, setDemandStatusScope] = useState<DemandStatusScope>(() =>
    searchParams.get('equipmentDemandStatus') === 'ALL' ? 'ALL' : 'ACTIVE'
  );

  useEffect(() => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      const setOrDelete = (key: string, value: string, defaultValue = '') => {
        if (value && value !== defaultValue) next.set(key, value);
        else next.delete(key);
      };
      setOrDelete('equipmentSearch', search.trim());
      setOrDelete('equipmentStatus', status, 'ALL');
      setOrDelete('equipmentView', reportMode, range.from || range.to ? 'USAGE' : 'INVENTORY');
      setOrDelete('equipmentLowStock', lowStockOnly ? '1' : '');
      setOrDelete('equipmentDemandGroup', demandGroupBy, 'program');
      setOrDelete('equipmentDemandSource', demandSource, 'ALL');
      setOrDelete('equipmentDemandSort', demandSortBy, 'requests');
      setOrDelete('equipmentDemandStatus', demandStatusScope, 'ACTIVE');
      next.delete('equipmentDemandRoomType');
      return next;
    }, { replace: true });
  }, [
    demandGroupBy,
    demandSortBy,
    demandSource,
    demandStatusScope,
    lowStockOnly,
    range.from,
    range.to,
    reportMode,
    search,
    setSearchParams,
    status,
  ]);
  const hasRange = reportMode === 'USAGE';
  const hasSelectedRange = Boolean(range.from || range.to);

  const RangeInputs = [range.from, range.to];
  const [RangePrevious, setRangePrevious] = useState<unknown[] | null>(null);
  if (!RangePrevious || RangeInputs.some((value, index) => !Object.is(value, RangePrevious[index]))) {
    setRangePrevious(RangeInputs);
    if (range.from || range.to) setReportMode('USAGE');
  }

  const periodRequests = useMemo(
    () =>
      hasRange
        ? requests.filter((request) => !hasSelectedRange || inDateRange(request.dateNeeded, range))
        : [],
    [hasRange, hasSelectedRange, range, requests]
  );

  const usageByEquipment = useMemo(() => {
    const usage = new Map<string, EquipmentUsage>();
    periodRequests.forEach((request) => {
      const equipmentInRequest = new Set<string>();
      (request.items ?? []).forEach((item) => {
        const current = usage.get(item.equipmentId) ?? createEquipmentUsage();
        current.unitsRequested += item.quantity;
        if (request.status === 'RETURNED') current.unitsReturned += item.quantity;
        if (!equipmentInRequest.has(item.equipmentId)) {
          current.timesRequested += 1;
          current.statusCounts[request.status].requests += 1;
          equipmentInRequest.add(item.equipmentId);
        }
        current.statusCounts[request.status].units += item.quantity;
        usage.set(item.equipmentId, current);
      });
    });
    return usage;
  }, [periodRequests]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return equipment
      .filter((item) => status === 'ALL' || item.status === status)
      .filter((item) => !lowStockOnly || (item.totalQuantity > 1 && item.availableQuantity <= 1))
      .filter((item) => {
        if (!query) return true;
        return `${item.name} ${item.description ?? ''} ${item.status}`.toLowerCase().includes(query);
      })
      .map((item) => ({
        item,
        usage: usageByEquipment.get(item.id) ?? createEquipmentUsage(),
      }))
      .sort((first, second) =>
        hasRange
          ? second.usage.timesRequested - first.usage.timesRequested ||
            second.usage.unitsRequested - first.usage.unitsRequested ||
            first.item.name.localeCompare(second.item.name)
          : second.item.totalQuantity - first.item.totalQuantity || first.item.name.localeCompare(second.item.name)
      );
  }, [equipment, hasRange, lowStockOnly, search, status, usageByEquipment]);

  const allEquipmentPrintRows = useMemo(
    () =>
      equipment
        .map((item) => ({
          item,
          usage: usageByEquipment.get(item.id) ?? createEquipmentUsage(),
        }))
        .sort((first, second) =>
          hasRange
            ? second.usage.timesRequested - first.usage.timesRequested ||
              second.usage.unitsRequested - first.usage.unitsRequested ||
              first.item.name.localeCompare(second.item.name)
            : second.item.totalQuantity - first.item.totalQuantity ||
              first.item.name.localeCompare(second.item.name)
        )
        .map(toEquipmentPrintRow),
    [equipment, hasRange, usageByEquipment]
  );
  const filteredEquipmentPrintRows = useMemo(
    () => rows.map(toEquipmentPrintRow),
    [rows]
  );

  const [equipmentPage, setEquipmentPage] = useState(1);
  const [equipmentPageSize, setEquipmentPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const paginatedRows = useMemo(() => {
    const start = (equipmentPage - 1) * equipmentPageSize;
    return rows.slice(start, start + equipmentPageSize);
  }, [equipmentPage, equipmentPageSize, rows]);

  const pageReset1Inputs = [equipmentPageSize, hasRange, lowStockOnly, range.from, range.to, search, status, rows.length];
  const [pageReset1Previous, setpageReset1Previous] = useState<unknown[] | null>(null);
  if (!pageReset1Previous || pageReset1Inputs.some((value, index) => !Object.is(value, pageReset1Previous[index]))) {
    setpageReset1Previous(pageReset1Inputs);
    setEquipmentPage(1);
  }

  const activeFilterCount = [search.trim(), status !== 'ALL', lowStockOnly].filter(Boolean).length;

  const appliedFilters = useMemo(() => {
    const chips: Array<{ id: 'search' | 'status' | 'reportMode' | 'lowStock'; label: string }> = [];
    if (search.trim()) chips.push({ id: 'search', label: `Search: ${search.trim()}` });
    if (status !== 'ALL') chips.push({ id: 'status', label: `Status: ${equipmentStatusLabels[status]}` });
    if (reportMode !== (range.from || range.to ? 'USAGE' : 'INVENTORY')) {
      chips.push({ id: 'reportMode', label: `Report view: ${reportMode === 'USAGE' ? 'Usage activity' : 'Current inventory'}` });
    }
    if (lowStockOnly) chips.push({ id: 'lowStock', label: 'Low stock only' });
    return chips;
  }, [lowStockOnly, range.from, range.to, reportMode, search, status]);

  const removeFilter = (id: (typeof appliedFilters)[number]['id']) => {
    if (id === 'search') setSearch('');
    if (id === 'status') setStatus('ALL');
    if (id === 'reportMode') setReportMode(range.from || range.to ? 'USAGE' : 'INVENTORY');
    if (id === 'lowStock') setLowStockOnly(false);
  };

  const selectedEquipmentIds = useMemo(() => new Set(rows.map(({ item }) => item.id)), [rows]);

  const matchingPeriodRequests = useMemo(
    () =>
      periodRequests.filter((request) =>
        (request.items ?? []).some((item) => selectedEquipmentIds.has(item.equipmentId))
      ),
    [periodRequests, selectedEquipmentIds]
  );

  const equipmentSummary = useMemo(() => {
    const unitsRequested = rows.reduce((total, row) => total + row.usage.unitsRequested, 0);
    const unitsReturned = rows.reduce((total, row) => total + row.usage.unitsReturned, 0);
    const totalUnits = rows.reduce((total, row) => total + row.item.totalQuantity, 0);
    const availableUnits = rows.reduce((total, row) => total + row.item.availableQuantity, 0);
    const pendingRequests = matchingPeriodRequests.filter((request) => request.status === 'PENDING').length;
    const approvedRequests = matchingPeriodRequests.filter((request) => request.status === 'APPROVED').length;
    const declinedRequests = matchingPeriodRequests.filter((request) => request.status === 'REJECTED').length;
    const atRiskItems = rows.filter(
      ({ item }) =>
        item.status === 'DAMAGED' ||
        item.status === 'UNAVAILABLE' ||
        (item.totalQuantity > 1 && item.availableQuantity <= 1)
    ).length;

    return {
      shown: rows.length,
      requestRecords: matchingPeriodRequests.length,
      primary: hasRange ? unitsRequested : totalUnits,
      secondary: hasRange ? unitsReturned : availableUnits,
      tertiary: hasRange ? Math.max(unitsRequested - unitsReturned, 0) : atRiskItems,
      pendingRequests,
      approvedRequests,
      declinedRequests,
    };
  }, [hasRange, matchingPeriodRequests, rows]);

  const overviewRows = useMemo<EquipmentOverviewRow[]>(() => {
    if (hasRange) {
      return rows
        .filter(({ usage }) => usage.unitsRequested > 0)
        .map(({ item, usage }) => ({
          key: item.id,
          name: item.name,
          primary: usage.unitsRequested,
          primaryLabel: usage.unitsRequested === 1 ? 'unit' : 'units',
          detail: `${usage.timesRequested} ${usage.timesRequested === 1 ? 'request' : 'requests'} · ${usage.unitsRequested} ${usage.unitsRequested === 1 ? 'unit' : 'units'}`,
          secondary: `${Math.max(usage.unitsRequested - usage.unitsReturned, 0)} unreturned`,
          statusCounts: usage.statusCounts,
        }));
    }

    return rows.map(({ item }) => ({
      key: item.id,
      name: item.name,
      primary: item.totalQuantity,
      primaryLabel: item.totalQuantity === 1 ? 'unit' : 'units',
      detail: `${item.borrowedQuantity} borrowed · ${item.damagedQuantity} damaged`,
      secondary: `${item.availableQuantity} available`,
    }));
  }, [hasRange, rows]);

  const equipmentLogDefinition = useMemo<PrintableReportDefinition<EquipmentPrintRow>>(
    () => ({
      title: hasRange ? 'Equipment Usage Log' : 'Equipment Inventory Log',
      filename: hasRange ? 'smartlab-equipment-usage-print' : 'smartlab-equipment-inventory-print',
      rows: allEquipmentPrintRows,
      columns: hasRange
        ? [
            { key: 'equipment', label: 'Equipment', width: '25%' },
            { key: 'status', label: 'Status', width: '12%' },
            { key: 'totalQuantity', label: 'Total qty', width: '10%' },
            { key: 'timesRequested', label: 'Request records', width: '13%' },
            { key: 'unitsRequested', label: 'Units requested', width: '13%' },
            { key: 'unitsReturned', label: 'Units returned', width: '13%' },
            { key: 'unreturned', label: 'Unreturned', width: '14%' },
          ]
        : [
            { key: 'equipment', label: 'Equipment', width: '30%' },
            { key: 'status', label: 'Status', width: '14%' },
            { key: 'totalQuantity', label: 'Total qty', width: '14%' },
            { key: 'availableQuantity', label: 'Available', width: '14%' },
            { key: 'borrowedQuantity', label: 'Borrowed', width: '14%' },
            { key: 'damagedQuantity', label: 'Damaged', width: '14%' },
          ],
    }),
    [allEquipmentPrintRows, hasRange]
  );

  const equipmentAnalysisRows = useMemo<EquipmentAnalysisPrintRow[]>(
    () =>
      overviewRows.map((row, index) => ({
        rank: index + 1,
        equipment: row.name,
        primary: `${row.primary} ${row.primaryLabel}`,
        detail: row.detail,
        secondary: row.secondary,
        statusBreakdown: row.statusCounts
          ? equipmentReportStatusOrder
              .filter((requestStatus) => row.statusCounts?.[requestStatus].requests)
              .map((requestStatus) => {
                const count = row.statusCounts?.[requestStatus];
                return count
                  ? `${statusLabels[requestStatus]}: ${count.requests} requests / ${count.units} units`
                  : '';
              })
              .join('; ')
          : '—',
      })),
    [overviewRows]
  );
  const equipmentAnalysisDefinition = useMemo<PrintableReportDefinition<EquipmentAnalysisPrintRow>>(
    () => ({
      title: hasRange ? 'Equipment Usage Analysis' : 'Equipment Inventory Analysis',
      filename: 'smartlab-equipment-analysis-print',
      rows: equipmentAnalysisRows,
      columns: [
        { key: 'rank', label: 'Rank', width: '6%' },
        { key: 'equipment', label: 'Equipment', width: '22%' },
        { key: 'primary', label: hasRange ? 'Units requested' : 'Total quantity', width: '14%' },
        { key: 'detail', label: 'Activity / condition', width: '20%' },
        { key: 'secondary', label: hasRange ? 'Unreturned' : 'Available', width: '12%' },
        { key: 'statusBreakdown', label: 'Request status mix', width: '26%' },
      ],
    }),
    [equipmentAnalysisRows, hasRange]
  );

  const sectionDemand = useMemo(() => {
    if (!hasRange || rows.length === 0) return [];
    const matchingRequests = periodRequests
      .filter((request) => reportableStatuses.has(request.status))
      .filter((request) => (request.items ?? []).some((item) => selectedEquipmentIds.has(item.equipmentId)))
      .map((request) => ({
        ...request,
        items: (request.items ?? []).filter((item) => selectedEquipmentIds.has(item.equipmentId)),
      }));
    return buildSectionDemand(matchingRequests, true);
  }, [hasRange, periodRequests, rows, selectedEquipmentIds]);

  const equipmentDemandRows = useMemo(() => {
    if (rows.length === 0) return [];
    const demandRequests = hasRange ? periodRequests : requests;
    const matchingRequests = demandRequests
      .filter((request) => demandStatusScope === 'ALL' || reportableStatuses.has(request.status))
      .filter((request) => demandSource === 'ALL' || request.requesterRole === demandSource)
      .filter((request) => (request.items ?? []).some((item) => selectedEquipmentIds.has(item.equipmentId)))
      .map((request) => ({
        ...request,
        items: (request.items ?? []).filter((item) => selectedEquipmentIds.has(item.equipmentId)),
      }));

    return buildDemandRows(matchingRequests, demandGroupBy, demandSortBy, true);
  }, [
    demandGroupBy,
    demandSortBy,
    demandSource,
    demandStatusScope,
    hasRange,
    periodRequests,
    requests,
    rows,
    selectedEquipmentIds,
  ]);

  const demandAppliedFilters = useMemo(() => {
    const chips: Array<{
      id: 'demandGroupBy' | 'demandSource' | 'demandSortBy' | 'demandStatusScope';
      label: string;
    }> = [];
    if (demandGroupBy !== 'program') {
      chips.push({ id: 'demandGroupBy', label: `Group by: ${demandGroupLabels[demandGroupBy]}` });
    }
    if (demandSource !== 'ALL') {
      chips.push({ id: 'demandSource', label: `Submitted through: ${demandSourceLabels[demandSource]}` });
    }
    if (demandSortBy !== 'requests') {
      chips.push({ id: 'demandSortBy', label: 'Rank by: Units requested' });
    }
    if (demandStatusScope !== 'ACTIVE') {
      chips.push({ id: 'demandStatusScope', label: `Status scope: ${demandStatusScopeLabels[demandStatusScope]}` });
    }
    return chips;
  }, [demandGroupBy, demandSortBy, demandSource, demandStatusScope]);

  const clearDemandFilters = () => {
    setDemandGroupBy('program');
    setDemandSource('ALL');
    setDemandSortBy('requests');
    setDemandStatusScope('ACTIVE');
  };

  const removeDemandFilter = (id: (typeof demandAppliedFilters)[number]['id']) => {
    if (id === 'demandGroupBy') setDemandGroupBy('program');
    if (id === 'demandSource') setDemandSource('ALL');
    if (id === 'demandSortBy') setDemandSortBy('requests');
    if (id === 'demandStatusScope') setDemandStatusScope('ACTIVE');
  };

  const handleExport = () => {
    if (hasRange) {
      downloadCsv(
        'smartlab-equipment-usage-report.csv',
        ['Name', 'Status', 'Total Qty', 'Request Records', 'Units Requested', 'Units Returned', 'Unreturned'],
        rows.map(({ item, usage }) => [
          item.name,
          equipmentStatusLabels[item.status],
          item.totalQuantity,
          usage.timesRequested,
          usage.unitsRequested,
          usage.unitsReturned,
          Math.max(usage.unitsRequested - usage.unitsReturned, 0),
        ])
      );
      return;
    }
    downloadCsv(
      'smartlab-equipment-inventory-report.csv',
      ['Name', 'Status', 'Total Qty', 'Available', 'Borrowed', 'Damaged'],
      rows.map(({ item }) => [
        item.name,
        equipmentStatusLabels[item.status],
        item.totalQuantity,
        item.availableQuantity,
        item.borrowedQuantity,
        item.damagedQuantity,
      ])
    );
  };

  const handleSectionExport = () => {
    downloadCsv(
      'smartlab-equipment-demand-by-section.csv',
      ['Rank', 'Section', 'Request records', 'Equipment units', 'Most requested equipment'],
      sectionDemand.map((row, index) => [index + 1, row.section, row.requests, row.units, row.topEquipment ?? ''])
    );
  };

  const exportEquipmentPdf = async (
    scope: 'period' | 'filtered',
    report: 'log' | 'analysis'
  ) => {
    setPdfExporting(true);
    try {
      const response = await reportsApi.downloadEquipmentPdf({
        scope,
        view: hasRange ? 'usage' : 'inventory',
        report,
        academicYearId: academicPeriod.academicYearId || undefined,
        termId: academicPeriod.termId || undefined,
        from: range.from || undefined,
        to: range.to || undefined,
        ...(scope === 'filtered'
          ? {
              search: search.trim() || undefined,
              status: status === 'ALL' ? undefined : status,
              lowStock: lowStockOnly || undefined,
            }
          : {}),
      });
      const contentDisposition = response.headers['content-disposition'] as string | undefined;
      const fallback = `smartlab-equipment-${hasRange ? 'usage' : 'inventory'}-${report}${
        scope === 'filtered' ? '-filtered' : ''
      }.pdf`;
      const filename = contentDisposition?.match(/filename="?([^"]+)"?/)?.[1] ?? fallback;
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('The equipment PDF report was generated and downloaded.');
    } catch (error) {
      console.error('Failed to export the equipment report PDF.', error);
      toast.error((error as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'The equipment PDF report could not be generated. Please try again.');
    } finally {
      setPdfExporting(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('ALL');
    setLowStockOnly(false);
  };

  const hasEquipmentData = equipment.length > 0;
  const hasFilteredData = rows.length > 0;
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
  const equipmentReportActions = (
    <EquipmentReportOutputMenu
      onPrintFullReport={() => startPrint('period')}
      onPrintFilteredTable={() => startPrint('filtered')}
      onPrintAnalysis={() => startPrint('analysis')}
      onExportPdfFullReport={() => exportEquipmentPdf('period', 'log')}
      onExportPdfFilteredTable={() => exportEquipmentPdf('filtered', 'log')}
      onExportPdfAnalysis={() => exportEquipmentPdf('filtered', 'analysis')}
      onExportFilteredTable={handleExport}
      onExportSectionTable={handleSectionExport}
      fullReportDisabled={!hasEquipmentData}
      filteredReportDisabled={!hasFilteredData}
      analysisDisabled={equipmentAnalysisRows.length === 0}
      sectionExportDisabled={!hasRange || sectionDemand.length === 0}
      pdfExporting={pdfExporting}
    />
  );

  return (
    <>
    <FormalReportFrame
      title={hasRange ? 'SmartLab Equipment Usage Report' : 'SmartLab Equipment Inventory Report'}
      subtitle="Review equipment demand and inventory health using the equipment catalog and borrowing records."
      range={range}
      className="equipment-report-screen"
    >
      <div className="space-y-4">
        {actionPortalTarget
          ? createPortal(<div className="flex flex-wrap gap-2">{equipmentReportActions}</div>, actionPortalTarget)
          : <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">{equipmentReportActions}</div>}
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
                   placeholder="Search equipment name, description, or status…"
                   size="md"
                 />
               </FilterItem>
             }
          advanced={
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              <FilterItem label="Inventory status" className="min-w-0">
                <DropdownField
                  value={status}
                  options={[
                    { value: 'ALL', label: 'All statuses' },
                    ...Object.entries(equipmentStatusLabels).map(([value, label]) => ({
                      value: value as EquipmentStatus,
                      label,
                    })),
                  ]}
                  onChange={setStatus}
                   placeholder="All statuses"
                 />
              </FilterItem>
              <FilterItem label="Report view" className="min-w-0">
                <DropdownField
                  value={reportMode}
                  options={[
                    { value: 'USAGE', label: 'Usage activity' },
                    { value: 'INVENTORY', label: 'Current inventory' },
                  ]}
                  onChange={setReportMode}
                  placeholder="Select report view"
                />
              </FilterItem>
              <FilterItem label="Stock level" className="min-w-0">
                <label className="flex min-h-[42px] items-center gap-2 text-xs font-semibold text-[#374151]">
                  <input
                    type="checkbox"
                    checked={lowStockOnly}
                    onChange={(event) => setLowStockOnly(event.target.checked)}
                    className="h-4 w-4 accent-[#800000]"
                  />
                  Low stock only
                </label>
              </FilterItem>
            </div>
          }
          advancedCount={[status !== 'ALL', reportMode !== 'USAGE', lowStockOnly].filter(Boolean).length}
          defaultAdvancedOpen={status !== 'ALL' || lowStockOnly}
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
            { label: 'Equipment shown', value: equipmentSummary.shown, detail: 'Matching the filters', tone: 'maroon' },
            {
              label: hasRange ? 'Request records' : 'Total units',
              value: hasRange ? equipmentSummary.requestRecords : equipmentSummary.primary,
              detail: hasRange
                ? 'Unique requests touching shown equipment'
                : 'Catalog quantity across shown items',
              tone: 'blue',
            },
            {
              label: hasRange ? 'Units requested' : 'Available units',
              value: hasRange ? equipmentSummary.primary : equipmentSummary.secondary,
              detail: hasRange ? 'Across all request statuses' : 'Ready for borrowing',
              tone: 'amber',
            },
            {
              label: hasRange ? 'Pending requests' : 'At-risk items',
              value: hasRange ? equipmentSummary.pendingRequests : equipmentSummary.tertiary,
              detail: hasRange
                ? `${equipmentSummary.approvedRequests} approved · ${equipmentSummary.declinedRequests} declined`
                : 'Damaged, unavailable, or low stock',
              tone: 'green',
            },
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
                Compare equipment demand by group using the selected equipment and available request history.
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
                <FilterItem label="Rank by" className="min-w-0">
                  <DropdownField
                    value={demandSortBy}
                    options={[
                      { value: 'requests', label: 'Request records' },
                      { value: 'units', label: 'Units requested' },
                    ]}
                    onChange={(value) => setDemandSortBy(value as DemandSortBy)}
                    placeholder="Request records"
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
            advancedCount={[
              demandSource !== 'ALL',
              demandSortBy !== 'requests',
              demandStatusScope !== 'ACTIVE',
            ].filter(Boolean).length}
            defaultAdvancedOpen={
              demandSource !== 'ALL' ||
              demandSortBy !== 'requests' ||
              demandStatusScope !== 'ACTIVE'
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
          <RequestDemandPanel
            title={`Demand by ${demandGroupLabels[demandGroupBy].toLowerCase()}`}
            description={demandGroupDescriptions[demandGroupBy]}
            rows={equipmentDemandRows}
            sortBy={demandSortBy}
            showTopEquipment
            emptyMessage={
              hasFilteredData
                ? 'No requests match the selected equipment and demand filters.'
                : hasEquipmentData
                  ? 'No equipment matches the current filters. Clear one or more filters to restore the catalog.'
                  : 'No equipment records are available.'
            }
          />
        </div>

        <div aria-hidden="true" className="h-0.5 w-full rounded-full bg-[#c8aaa2]" />

        <div id="equipment-request-ranking" className="scroll-mt-6 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm lg:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9a7770]">Detailed log</p>
              <h3 className="mt-1 text-base font-semibold text-[#241f20]">
                {hasRange ? 'Most requested equipment' : 'Equipment inventory records'}
              </h3>
            </div>
            <p className="text-xs text-[#8c8080]">
              {rows.length} {rows.length === 1 ? 'record' : 'records'} shown
            </p>
          </div>
          <TableContainer className="rounded-xl border border-[#e5e7eb]">
            <Table className={`equipment-mobile-report ${hasRange ? 'equipment-range-report' : 'equipment-stock-report'} report-print-table ${hasRange ? 'min-w-[1100px]' : 'min-w-[900px]'}`}>
              <TableHead>
                <TableHeaderCell>Equipment</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Total qty</TableHeaderCell>
                {hasRange ? (
                  <>
                    <TableHeaderCell>Request records</TableHeaderCell>
                    <TableHeaderCell>Units requested</TableHeaderCell>
                    <TableHeaderCell>Units returned</TableHeaderCell>
                    <TableHeaderCell>Unreturned</TableHeaderCell>
                  </>
                ) : (
                  <>
                    <TableHeaderCell>Available</TableHeaderCell>
                    <TableHeaderCell>Borrowed</TableHeaderCell>
                    <TableHeaderCell>Damaged</TableHeaderCell>
                  </>
                )}
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow hover={false}>
                    <TableCell colSpan={hasRange ? 7 : 6} align="center" className="py-12">
                      <div className="mx-auto max-w-md">
                        <p className="text-sm font-semibold text-[#4d4242]">
                          {hasEquipmentData ? 'No equipment matches the current filters' : 'No equipment records available'}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[#8c8080]">
                          {hasEquipmentData
                            ? 'Try clearing one or more filters to see more equipment records.'
                            : 'Add equipment to the catalog to populate this report.'}
                        </p>
                        {hasEquipmentData && activeFilterCount > 0 && (
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="mt-4 rounded-full border border-[#800000] px-3 py-2 text-xs font-semibold text-[#800000] hover:bg-[#fff8f8]"
                          >
                            Clear equipment filters
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedRows.map(({ item, usage }) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-semibold text-[#3f3636]">{item.name}</p>
                      {item.description && <p className="mt-1 max-w-[240px] text-[11px] text-[#8c8080]">{item.description}</p>}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex rounded-full bg-[#f8eee9] px-2 py-1 text-[10px] font-semibold text-[#8a4b3f]">
                        {equipmentStatusLabels[item.status]}
                      </span>
                    </TableCell>
                    <TableCell>{item.totalQuantity}</TableCell>
                    {hasRange ? (
                      <>
                        <TableCell>{usage.timesRequested}</TableCell>
                        <TableCell className="font-semibold">{usage.unitsRequested}</TableCell>
                        <TableCell>{usage.unitsReturned}</TableCell>
                        <TableCell className="font-semibold">{Math.max(usage.unitsRequested - usage.unitsReturned, 0)}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>{item.availableQuantity}</TableCell>
                        <TableCell>{item.borrowedQuantity}</TableCell>
                        <TableCell>{item.damagedQuantity}</TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            currentPage={equipmentPage}
            pageSize={equipmentPageSize}
            totalItems={rows.length}
            onPageChange={setEquipmentPage}
            onPageSizeChange={(size) => {
              setEquipmentPageSize(size);
              setEquipmentPage(1);
            }}
          />
        </div>
      </div>
    </FormalReportFrame>
    <div className="equipment-report-print-document">
      {printMode === 'analysis' ? (
        <PrintableReportDocument headerPeriod={academicPeriod} headerRange={range}
          definition={equipmentAnalysisDefinition}
          rows={equipmentAnalysisRows}
        />
      ) : (
        <PrintableReportDocument headerPeriod={academicPeriod} headerRange={range}
          definition={equipmentLogDefinition}
          rows={printMode === 'filtered' ? filteredEquipmentPrintRows : allEquipmentPrintRows}
        />
      )}
    </div>
    </>
  );
}
