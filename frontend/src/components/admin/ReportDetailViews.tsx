import type { EquipmentItem } from '../../types/equipment';
import type { ApiLabSchedule } from '../../types/labSchedule';
import type { BorrowRequest } from '../../types/requests';
import type { AcademicPeriodSelection } from '../shared/AcademicPeriodFilter';
import { EquipmentReportView } from './report-details/EquipmentReportView';
import { type DateRange, type ReportCatalog } from './report-details/reportData';
import { RequestReportView } from './report-details/RequestReportView';
import { ScheduleReportView } from './report-details/ScheduleReportView';
import './reportDocumentStyles.css';

export type ReportTab = 'overview' | 'requests' | 'schedule' | 'equipment';

type ReportDetailViewsProps = {
  activeTab: Exclude<ReportTab, 'overview'>;
  requests: BorrowRequest[];
  schedules: ApiLabSchedule[];
  equipment: EquipmentItem[];
  range: DateRange;
  catalog: ReportCatalog;
  academicPeriod: AcademicPeriodSelection;
  primaryFilterPortalTarget: HTMLDivElement | null;
  advancedFilterPortalTarget: HTMLDivElement | null;
  bottomControlPortalTarget: HTMLDivElement | null;
  actionPortalTarget: HTMLDivElement | null;
};

export default function ReportDetailViews({
  activeTab,
  requests,
  schedules,
  equipment,
  range,
  catalog,
  academicPeriod,
  primaryFilterPortalTarget,
  advancedFilterPortalTarget,
  bottomControlPortalTarget,
  actionPortalTarget,
}: ReportDetailViewsProps) {
  return (
    <div className="reports-print-scope">
      <style>{`
        .request-report-print-document,
        .schedule-report-print-document,
        .equipment-report-print-document {
          position: absolute;
          left: -10000px;
          top: 0;
          width: 13in;
          visibility: hidden;
          pointer-events: none;
        }
        @media print {
          @page { size: 13in 8.5in; margin: 0; }
          body * { visibility: hidden; }
          .reports-print-scope, .reports-print-scope * { visibility: visible; }
          .reports-print-scope { position: absolute; left: 0; top: 0; width: 100%; }
          .reports-print-scope .request-report-screen,
          .reports-print-scope .schedule-report-screen,
          .reports-print-scope .equipment-report-screen { display: none !important; }
          .reports-print-scope .request-report-print-document,
          .reports-print-scope .schedule-report-print-document,
          .reports-print-scope .equipment-report-print-document {
            display: block !important;
            position: static;
            left: auto;
            top: auto;
            width: 100%;
            visibility: visible;
            pointer-events: auto;
          }
          .reports-print-scope .printable-report-measurement { display: none !important; }
          .reports-print-scope .request-report-print-document .print-report-paper,
          .reports-print-scope .schedule-report-print-document .print-report-paper,
          .reports-print-scope .equipment-report-print-document .print-report-paper {
            width: 100%;
            max-width: none;
          }
          .reports-print-scope .request-report-print-document .print-report-page,
          .reports-print-scope .schedule-report-print-document .print-report-page,
          .reports-print-scope .equipment-report-print-document .print-report-page {
            width: 100%;
            height: 214mm;
            min-height: 214mm;
            max-height: 214mm;
          }
          .reports-print-scope section { border: 0; box-shadow: none; }
          .reports-print-scope .report-filter-toolbar { display: none; }
          .reports-print-scope button, .reports-print-scope input, .reports-print-scope select { display: none; }
          .formal-report-table,
          .report-print-table {
            table-layout: fixed;
            font-family: "Times New Roman", serif;
          }
          .formal-report-table thead,
          .report-print-table thead { display: table-header-group; }
          .formal-report-table tr,
          .report-print-table tr { break-inside: avoid; }
          .formal-report-table th,
          .formal-report-table td,
          .report-print-table th,
          .report-print-table td {
            border: 1px solid #666;
            padding: 4px 5px;
            overflow-wrap: anywhere;
            text-align: center;
            vertical-align: middle;
            font-family: "Times New Roman", serif;
          }
          .formal-report-table th,
          .report-print-table th {
            background: #f4b183;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .formal-report-table td,
          .report-print-table td { font-size: 9px; }
          .formal-report-document .rounded-2xl { border-radius: 0; }
        }
      `}</style>
      {activeTab === 'requests' && (
        <RequestReportView
          requests={requests}
          range={range}
          catalog={catalog}
          academicPeriod={academicPeriod}
          primaryFilterPortalTarget={primaryFilterPortalTarget}
          advancedFilterPortalTarget={advancedFilterPortalTarget}
          bottomControlPortalTarget={bottomControlPortalTarget}
          actionPortalTarget={actionPortalTarget}
        />
      )}
      {activeTab === 'schedule' && (
        <ScheduleReportView
          schedules={schedules}
          range={range}
          academicPeriod={academicPeriod}
          primaryFilterPortalTarget={primaryFilterPortalTarget}
          advancedFilterPortalTarget={advancedFilterPortalTarget}
          bottomControlPortalTarget={bottomControlPortalTarget}
          actionPortalTarget={actionPortalTarget}
        />
      )}
      {activeTab === 'equipment' && (
        <EquipmentReportView
          equipment={equipment}
          requests={requests}
          range={range}
          academicPeriod={academicPeriod}
          primaryFilterPortalTarget={primaryFilterPortalTarget}
          advancedFilterPortalTarget={advancedFilterPortalTarget}
          bottomControlPortalTarget={bottomControlPortalTarget}
          actionPortalTarget={actionPortalTarget}
        />
      )}
    </div>
  );
}
