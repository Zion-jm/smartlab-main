import { DomainError } from './domainError';
import { REPORT_MAX_ROWS, assertReportSize, limitedReport } from './reportLimits';
import { manilaDayBounds, validDateKey } from '../utils/manilaTime';
import { renderHtmlPdf } from './chromiumPdfService';
import { access, readFile } from 'node:fs/promises';


import path from 'node:path';
import { EquipmentStatus, Prisma, PrismaClient, RequestStatus, ScheduleType } from '@prisma/client';
import {
  borrowRequestInclude,
  summarizeRequest,
  type RequestSummary,
} from './borrowRequestService';
import { academicPeriodWhere } from './academicPeriodService';


const REPORT_TIME_ZONE = 'Asia/Manila';
const REPORT_PAGE_ROWS = 15;


export type BorrowRequestReportScope = 'period' | 'filtered';

export type BorrowRequestReportFilters = {
  scope: BorrowRequestReportScope;
  academicYearId?: string;
  termId?: string;
  from?: string;
  to?: string;
  search?: string;
  status?: string;
  room?: string;
  program?: string;
  year?: string;
};

export type DemandGroupBy = 'faculty' | 'submittedBy' | 'program' | 'subject' | 'room';
export type DemandSourceFilter = 'ALL' | 'STUDENT' | 'FACULTY';
export type DemandRoomFilter = 'ALL' | 'COMPUTER_LAB' | 'OTHER';
export type DemandStatusScope = 'ACTIVE' | 'ALL';

export type DemandAnalysisReportFilters = BorrowRequestReportFilters & {
  groupBy: DemandGroupBy;
  demandSource: DemandSourceFilter;
  demandRoomType: DemandRoomFilter;
  demandStatusScope: DemandStatusScope;
};

export type ScheduleReportScope = 'period' | 'filtered';
export type ScheduleReportView = 'log' | 'analysis';
export type ScheduleRoomFilter = 'ALL' | 'COMPUTER_LAB' | 'OTHER';
export type ScheduleReportFilters = {
  scope: ScheduleReportScope;
  view: ScheduleReportView;
  academicYearId?: string;
  termId?: string;
  from?: string;
  to?: string;
  search?: string;
  day?: string;
  room?: string;
  roomType?: ScheduleRoomFilter;
  program?: string;
  year?: string;
  scheduleType?: ScheduleType;
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDate = (value: Date | string | null | undefined) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: REPORT_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const formatTime = (value: Date | string | null | undefined) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: REPORT_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const formatTimeRange = (
  start: Date | string | null | undefined,
  end: Date | string | null | undefined
) => {
  const startText = formatTime(start);
  if (!startText) return '—';
  const endText = formatTime(end);
  return endText ? `${startText} – ${endText}` : startText;
};

const formatSectionLabel = (program: string | null | undefined, yearLevel: number | null | undefined) =>
  [program?.trim(), yearLevel != null ? String(yearLevel) : ''].filter(Boolean).join(' ') ||
  'Unassigned program/year';

const parseDateBoundary = (value: string | undefined, endExclusive = false) => {
  if (!value || !validDateKey(value)) return undefined;
  const bounds = manilaDayBounds(value);
  return endExclusive ? bounds.end : bounds.start;
};

const statusLabels: Record<RequestStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  BORROWED: 'Borrowed',
  RETURNED: 'Returned',
  REJECTED: 'Declined',
  CANCELLED: 'Cancelled',
};

const getSearchText = (request: RequestSummary) =>
  [
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

const getReportRows = async (
  prisma: PrismaClient,
  filters: BorrowRequestReportFilters
) => {
  const conditions = [];
  const periodFilter = academicPeriodWhere(filters);
  const from = parseDateBoundary(filters.from);
  const to = parseDateBoundary(filters.to, true);

  if (Object.keys(periodFilter).length > 0) conditions.push(periodFilter);
  if (from) conditions.push({ dateNeeded: { gte: from } });
  if (to) conditions.push({ dateNeeded: { lt: to } });

  if (filters.scope !== 'period') {
    if (filters.status && filters.status !== 'ALL') conditions.push({ status: filters.status as RequestStatus });
    if (filters.year && filters.year !== 'ALL' && Number.isInteger(Number(filters.year))) conditions.push({ yearLevel: Number(filters.year) });
    if (filters.program && filters.program !== 'ALL') conditions.push({ program: { name: filters.program } });
  }
  const requests = await prisma.borrowRequest.findMany({
    take: REPORT_MAX_ROWS + 1,
    where: conditions.length > 0 ? { AND: conditions } : undefined,
    include: { ...borrowRequestInclude, items: { ...borrowRequestInclude.items, take: 101 } },
    orderBy: [{ dateNeeded: 'desc' }, { createdAt: 'desc' }],
  });

  assertReportSize(requests);
  if (requests.some(request => request.items.length > 100)) throw new DomainError(413, 'A request exceeds the report item limit. Narrow the report.', 'REPORT_TOO_LARGE');
  const periodRequests = requests.map(summarizeRequest);
  if (filters.scope === 'period') return periodRequests;

  const search = filters.search?.trim().toLowerCase() ?? '';
  const year = filters.year && filters.year !== 'ALL' ? Number(filters.year) : null;
  const status = filters.status && filters.status !== 'ALL' ? filters.status : null;

  return periodRequests.filter((request) => {
    if (search && !getSearchText(request).includes(search)) return false;
    if (status && request.status !== status) return false;
    if (filters.room && filters.room !== 'ALL' && request.location !== filters.room) return false;
    if (filters.program && filters.program !== 'ALL' && request.program !== filters.program) return false;
    if (year != null && request.yearLevel !== year) return false;
    return true;
  });
};

const readAssetDataUri = async (filename: string) => {
  const candidates = [
    process.env.FRONTEND_PUBLIC_DIR ? path.join(process.env.FRONTEND_PUBLIC_DIR, filename) : null,
    path.resolve(process.cwd(), 'frontend', 'public', filename),
    path.resolve(process.cwd(), '..', 'frontend', 'public', filename),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      await access(candidate);
      const content = await readFile(candidate);
      const mimeType = path.extname(candidate).toLowerCase() === '.svg' ? 'image/svg+xml' : 'image/png';
      return `data:${mimeType};base64,${content.toString('base64')}`;
    } catch {
      // Try the next known project location.
    }
  }

  throw new Error(`Report asset not found: ${filename}`);
};

const renderRows = (rows: RequestSummary[]) =>
  rows
    .map((request) => {
      const cells = [
        formatDate(request.dateNeeded),
        request.location || '',
        request.equipmentList || '',
        request.requesterName,
        formatSectionLabel(request.program, request.yearLevel),
        request.facultyName || '',
        formatTimeRange(request.timeStart, request.timeEnd),
        statusLabels[request.status],
        request.subject || '',
      ];

      return `<tr>${cells
        .map((cell) => `<td title="${escapeHtml(cell)}">${escapeHtml(cell)}</td>`)
        .join('')}</tr>`;
    })
    .join('');

const renderPage = (
  rows: RequestSummary[],
  pageNumber: number,
  totalPages: number,
  logoDataUri: string,
  certificationDataUri: string
) => {
  const currentDate = new Intl.DateTimeFormat('en-US', {
    timeZone: REPORT_TIME_ZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return `
    <section class="report-page">
      <header class="report-header">
        <div class="logo-frame"><img src="${logoDataUri}" alt="" /></div>
        <div class="header-text">
          <p><span>R</span>epublic of the <span>P</span>hilippines</p>
          <p><span>P</span>olytechnic <span>U</span>niversity of the <span>P</span>hilippines</p>
          <p><span>O</span>ffice of the <span>V</span>ice <span>P</span>resident for <span>A</span>cademic <span>A</span>ffairs</p>
          <p>COLLEGE OF COMPUTER AND INFORMATION SCIENCES</p>
        </div>
        <div class="code-stack">
          <p class="page-number">Page: ${pageNumber} of ${totalPages}</p>
          <div class="code-box">
            <p>PUP-ITBL-3-ACAD-010</p>
            <p>REV. 1</p>
            <p>${escapeHtml(currentDate)}</p>
          </div>
        </div>
      </header>
      <div class="table-wrap">
        <table>
          <colgroup>
            <col style="width: 9%" />
            <col style="width: 9%" />
            <col style="width: 17%" />
            <col style="width: 16%" />
            <col style="width: 11%" />
            <col style="width: 15%" />
            <col style="width: 9%" />
            <col style="width: 7%" />
            <col style="width: 7%" />
          </colgroup>
          <thead>
            <tr><th colspan="9" class="title-row">Borrow Request Log</th></tr>
            <tr>
              <th>Date</th><th>Room</th><th>Equipment</th><th>Requester</th>
              <th>Program / Year</th><th>Faculty-in-Charge</th><th>Time</th>
              <th>Status</th><th>Subject</th>
            </tr>
          </thead>
           <tbody>${renderRows(rows)}</tbody>
        </table>
      </div>
      <div class="page-footer">
        <div class="signatures">
          <div><strong>Prepared by:</strong><em>Laboratory Assistant</em></div>
          <div><strong>Noted by:</strong><em>Head, CCIS Laboratory</em></div>
        </div>
        <footer class="institution-footer">
          <div>
            <p>PUP A. Mabini Campus, Anonas Street, Sta. Mesa, Manila 1016</p>
            <p>Direct Line: 335-1730 | Trunk Line: 335-1787 or 335-1777 local 000</p>
            <p>Website: www.pup.edu.ph | Email: inquire@pup.edu.ph</p>
            <p class="slogan">T<small>he</small> C<small>ountry&apos;s</small> <sup>1st</sup> P<small>olytechnic</small>U</p>
          </div>
          <img src="${certificationDataUri}" alt="ISO 9001:2015 certified" />
        </footer>
      </div>
    </section>
  `;
};

const renderDocument = (
  pages: RequestSummary[][],
  logoDataUri: string,
  certificationDataUri: string
) => `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>SmartLab Borrow Request Report</title>
    <style>
      @page { size: 13in 8.5in; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; }
      body { color: #333; font-family: Arial, Helvetica, sans-serif; }
      .report-page {
        display: grid;
        grid-template-rows: 32mm minmax(0, 1fr) 51mm;
        width: 330.2mm;
        height: 214mm;
        min-height: 214mm;
        max-height: 214mm;
        padding: 0 2.5mm;
        overflow: hidden;
        break-after: page;
        page-break-after: always;
      }
      .report-page:last-child { break-after: auto; page-break-after: auto; }
      .report-header {
        display: flex;
        align-items: flex-start;
        gap: 4mm;
        width: 100%;
        height: 32mm;
        min-height: 32mm;
        padding: 4mm;
      }
      .logo-frame { display: flex; width: 28mm; height: 28mm; flex: 0 0 28mm; align-items: center; justify-content: center; }
      .logo-frame img { width: 26mm; height: 26mm; object-fit: contain; }
      .header-text { padding-top: 4mm; color: #111; font-family: "Times New Roman", Georgia, serif; line-height: 1.05; }
      .header-text p { margin: 0; font-variant: small-caps; }
      .header-text p:nth-child(1) { font-size: 11pt; }
      .header-text p:nth-child(2) { font-size: 17pt; }
      .header-text p:nth-child(3) { font-size: 13pt; }
      .header-text p:nth-child(4) { margin-top: .5mm; font-size: 13pt; font-weight: 700; font-variant: normal; text-transform: uppercase; }
      .header-text span { font-variant: normal; }
      .code-stack { align-self: flex-start; margin-left: auto; padding-top: 5mm; text-align: right; }
      .page-number { margin: 0 0 1mm; color: #111; font-size: 7.5pt; text-align: right; }
      .code-box { border: 1px solid #555; border-right-width: 2px; border-bottom-width: 2px; padding: 2mm 3mm; color: #111; text-align: left; font-size: 7.5pt; font-weight: 550; line-height: 1.4; }
      .code-box p { margin: 0; }
      .code-box p:last-child { margin-top: 1mm; }
       .table-wrap { min-height: 0; width: 100%; overflow: hidden; }
      table { width: 100%; height: auto; border-collapse: collapse; border-spacing: 0; table-layout: fixed; margin: 0; font-family: Arial, Helvetica, sans-serif; }
       th, td { height: 6.5mm; min-width: 0; border: 1px solid #000; padding: .5mm .8mm; overflow: visible; overflow-wrap: anywhere; text-overflow: clip; white-space: normal; text-align: center; vertical-align: middle; line-height: 1.15; }
       tr { break-inside: avoid; page-break-inside: avoid; }
      th { background: #f0ad68; font-size: 7pt; font-weight: 700; }
      td { background: #fff; font-size: 7pt; }
      .title-row { height: 8mm; font-family: "Times New Roman", Georgia, serif; font-size: 12pt; line-height: 1; }
      .page-footer { display: grid; grid-template-rows: 24mm 27mm; width: 100%; height: 51mm; min-height: 51mm; max-height: 51mm; overflow: hidden; }
      .signatures { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 40mm; margin: 0 5mm 0 15mm; padding-top: 0; font-size: 9pt; }
      .signatures div { display: flex; flex-direction: column; }
      .signatures em { margin-top: 9mm; font-size: 8pt; font-style: italic; font-weight: 700; }
      .institution-footer { display: flex; align-items: flex-start; justify-content: space-between; gap: 5mm; position: relative; width: 100%; font-size: 7pt; line-height: 1.2; }
      .institution-footer > div { transform: translateX(24mm); }
      .institution-footer p { margin: 0; }
      .institution-footer .slogan { margin-top: 3mm; color: #111; font-family: "Times New Roman", Georgia, serif; font-size: 17pt; font-weight: 400; line-height: 1; }
      .institution-footer .slogan small { font-size: 1.08em; }
      .institution-footer .slogan sup { font-size: .78em; }
      .institution-footer img { width: 32mm; height: 32mm; max-width: 32mm; max-height: 32mm; transform: translateY(-7mm); object-fit: contain; }
    </style>
  </head>
  <body>${pages.map((page, index) => renderPage(page, index + 1, pages.length, logoDataUri, certificationDataUri)).join('')}</body>
</html>
`;



const sanitizeFilenamePart = (value: string) => value.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '');

const buildFilename = (filters: BorrowRequestReportFilters) => {
  const datePart = [
    filters.from ? sanitizeFilenamePart(filters.from) : '',
    filters.to ? `to-${sanitizeFilenamePart(filters.to)}` : '',
  ]
    .filter(Boolean)
    .join('-');
  return `smartlab-request-log${datePart ? `-${datePart}` : ''}${filters.scope === 'filtered' ? '-filtered' : ''}.pdf`;
};

const scheduleDayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SCHEDULE_REPORT_PAGE_ROWS = 15;
const SCHEDULE_ANALYSIS_PAGE_ROWS = 10;

const scheduleReportInclude = {
  room: true,
  faculty: {
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
  },
  program: true,
  subject: true,
} as const;

type ReportSchedule = Prisma.LabScheduleGetPayload<{ include: typeof scheduleReportInclude }>;

const scheduleRoom = (schedule: ReportSchedule) =>
  schedule.room?.name || schedule.room?.roomNumber || 'Unassigned room';

const scheduleFaculty = (schedule: ReportSchedule) =>
  `${schedule.faculty?.user?.firstName ?? ''} ${schedule.faculty?.user?.lastName ?? ''}`.trim() ||
  'Faculty not assigned';

const scheduleSubject = (schedule: ReportSchedule) =>
  schedule.subject?.name || schedule.subject?.code || 'Untitled subject';

const scheduleProgram = (schedule: ReportSchedule) =>
  schedule.program?.name || schedule.program?.code || '—';

const scheduleSection = (schedule: ReportSchedule) =>
  formatSectionLabel(schedule.program?.code ?? schedule.program?.name, schedule.yearLevel);

const scheduleDay = (schedule: ReportSchedule) =>
  typeof schedule.dayOfWeek === 'number' && scheduleDayLabels[schedule.dayOfWeek]
    ? scheduleDayLabels[schedule.dayOfWeek]
    : 'Weekly';

const scheduleSearchText = (schedule: ReportSchedule) =>
  [
    scheduleRoom(schedule),
    scheduleFaculty(schedule),
    scheduleSubject(schedule),
    scheduleProgram(schedule),
    scheduleDay(schedule),
  ]
    .join(' ')
    .toLowerCase();

const getScheduleRows = async (
  prisma: PrismaClient,
  filters: ScheduleReportFilters
): Promise<ReportSchedule[]> => {
  const where: Prisma.LabScheduleWhereInput = {
    ...academicPeriodWhere(filters),
  };
  const from = parseDateBoundary(filters.from);
  const to = parseDateBoundary(filters.to, true);

  if (from || to) {
    where.OR = [
      { scheduleType: ScheduleType.WEEKLY },
      {
        scheduleType: ScheduleType.ONE_TIME,
        ...(from || to ? { scheduleDate: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
      },
    ];
  }

  if (filters.scope !== 'period') {
    if (filters.scheduleType) where.scheduleType = filters.scheduleType;
    if (filters.year && filters.year !== 'ALL' && Number.isInteger(Number(filters.year))) where.yearLevel = Number(filters.year);
    if (filters.roomType === 'COMPUTER_LAB') where.room = { isComputerLab: true };
  }
  const schedules = await prisma.labSchedule.findMany({
    take: REPORT_MAX_ROWS + 1, orderBy: { id: 'asc' },
    where,
    include: scheduleReportInclude,
  });

  assertReportSize(schedules);
  if (filters.scope === 'period') {
    return schedules.sort((first, second) => {
      const firstDate = first.scheduleType === ScheduleType.WEEKLY ? 1 : 0;
      const secondDate = second.scheduleType === ScheduleType.WEEKLY ? 1 : 0;
      return (
        firstDate - secondDate ||
        (first.scheduleDate ?? first.timeStart).getTime() - (second.scheduleDate ?? second.timeStart).getTime()
      );
    });
  }

  const search = filters.search?.trim().toLowerCase() ?? '';
  const year = filters.year && filters.year !== 'ALL' ? Number(filters.year) : null;
  const day = filters.day && filters.day !== 'ALL' ? filters.day : null;
  const room = filters.room && filters.room !== 'ALL' ? filters.room : null;
  const program = filters.program && filters.program !== 'ALL' ? filters.program : null;
  const scheduleType = filters.scheduleType;

  return schedules
    .filter((schedule) => !scheduleType || schedule.scheduleType === scheduleType)
    .filter((schedule) => !day || scheduleDay(schedule) === day)
    .filter((schedule) => !room || scheduleRoom(schedule) === room)
    .filter(
      (schedule) =>
        !filters.roomType ||
        filters.roomType === 'ALL' ||
        (filters.roomType === 'COMPUTER_LAB'
          ? schedule.room?.isComputerLab === true
          : schedule.room?.isComputerLab !== true)
    )
    .filter((schedule) => !program || scheduleProgram(schedule) === program)
    .filter((schedule) => year == null || schedule.yearLevel === year)
    .filter((schedule) => !search || scheduleSearchText(schedule).includes(search))
    .sort((first, second) => {
      const firstDate = first.scheduleType === ScheduleType.WEEKLY ? 1 : 0;
      const secondDate = second.scheduleType === ScheduleType.WEEKLY ? 1 : 0;
      return (
        firstDate - secondDate ||
        (first.scheduleDate ?? first.timeStart).getTime() - (second.scheduleDate ?? second.timeStart).getTime()
      );
    });
};

type SchedulePdfRow = {
  dayDate: string;
  room: string;
  subject: string;
  faculty: string;
  section: string;
  time: string;
  type: string;
};

const buildSchedulePdfRows = (schedules: ReportSchedule[]): SchedulePdfRow[] =>
  schedules.map((schedule) => ({
    dayDate:
      schedule.scheduleType === ScheduleType.WEEKLY
        ? `Every ${scheduleDay(schedule)}`
        : formatDate(schedule.scheduleDate),
    room: scheduleRoom(schedule),
    subject: scheduleSubject(schedule),
    faculty: scheduleFaculty(schedule),
    section: scheduleSection(schedule),
    time: formatTimeRange(schedule.timeStart, schedule.timeEnd),
    type: schedule.scheduleType === ScheduleType.WEEKLY ? 'Recurring' : 'One-time',
  }));

type ScheduleAnalysisPdfRow = {
  section: string;
  entries: number;
  rooms: number;
  recurring: number;
};

const buildScheduleAnalysisRows = (schedules: ReportSchedule[]): ScheduleAnalysisPdfRow[] => {
  const grouped = new Map<string, ScheduleAnalysisPdfRow & { roomNames: Set<string> }>();

  schedules.forEach((schedule) => {
    const section = scheduleSection(schedule);
    const current = grouped.get(section) ?? {
      section,
      entries: 0,
      rooms: 0,
      recurring: 0,
      roomNames: new Set<string>(),
    };
    current.entries += 1;
    current.roomNames.add(scheduleRoom(schedule));
    current.rooms = current.roomNames.size;
    if (schedule.scheduleType === ScheduleType.WEEKLY) current.recurring += 1;
    grouped.set(section, current);
  });

  return Array.from(grouped.values())
    .map(({ roomNames: _roomNames, ...row }) => row)
    .sort(
      (first, second) =>
        second.entries - first.entries ||
        second.rooms - first.rooms ||
        first.section.localeCompare(second.section)
    );
};

const renderScheduleRows = (rows: SchedulePdfRow[]) =>
  rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.dayDate)}</td>
          <td>${escapeHtml(row.room)}</td>
          <td>${escapeHtml(row.subject)}</td>
          <td>${escapeHtml(row.faculty)}</td>
          <td>${escapeHtml(row.section)}</td>
          <td>${escapeHtml(row.time)}</td>
          <td>${escapeHtml(row.type)}</td>
        </tr>
      `
    )
    .join('');

const renderSchedulePage = (
  rows: SchedulePdfRow[],
  pageNumber: number,
  totalPages: number,
  logoDataUri: string,
  certificationDataUri: string
) => {
  const currentDate = new Intl.DateTimeFormat('en-US', {
    timeZone: REPORT_TIME_ZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return `
    <section class="report-page">
      <header class="report-header">
        <div class="logo-frame"><img src="${logoDataUri}" alt="" /></div>
        <div class="header-text">
          <p><span>R</span>epublic of the <span>P</span>hilippines</p>
          <p><span>P</span>olytechnic <span>U</span>niversity of the <span>P</span>hilippines</p>
          <p><span>O</span>ffice of the <span>V</span>ice <span>P</span>resident for <span>A</span>cademic <span>A</span>ffairs</p>
          <p>COLLEGE OF COMPUTER AND INFORMATION SCIENCES</p>
        </div>
        <div class="code-stack">
          <p class="page-number">Page: ${pageNumber} of ${totalPages}</p>
          <div class="code-box">
            <p>PUP-ITBL-3-ACAD-010</p>
            <p>REV. 1</p>
            <p>${escapeHtml(currentDate)}</p>
          </div>
        </div>
      </header>
      <div class="table-wrap">
        <table>
          <colgroup>
            <col style="width: 14%" /><col style="width: 13%" /><col style="width: 18%" />
            <col style="width: 18%" /><col style="width: 16%" /><col style="width: 11%" />
            <col style="width: 10%" />
          </colgroup>
          <thead>
            <tr><th colspan="7" class="title-row">Laboratory Schedule Log</th></tr>
            <tr>
              <th>Day / date</th><th>Room</th><th>Subject</th><th>Faculty-in-charge</th>
              <th>Section</th><th>Time</th><th>Schedule type</th>
            </tr>
          </thead>
          <tbody>${renderScheduleRows(rows)}</tbody>
        </table>
      </div>
      <div class="page-footer">
        <div class="signatures">
          <div><strong>Prepared by:</strong><em>Laboratory Assistant</em></div>
          <div><strong>Noted by:</strong><em>Head, CCIS Laboratory</em></div>
        </div>
        <footer class="institution-footer">
          <div>
            <p>PUP A. Mabini Campus, Anonas Street, Sta. Mesa, Manila 1016</p>
            <p>Direct Line: 335-1730 | Trunk Line: 335-1787 or 335-1777 local 000</p>
            <p>Website: www.pup.edu.ph | Email: inquire@pup.edu.ph</p>
            <p class="slogan">T<small>he</small> C<small>ountry&apos;s</small> <sup>1st</sup> P<small>olytechnic</small>U</p>
          </div>
          <img src="${certificationDataUri}" alt="ISO 9001:2015 certified" />
        </footer>
      </div>
    </section>
  `;
};

const renderScheduleDocument = (
  pages: SchedulePdfRow[][],
  logoDataUri: string,
  certificationDataUri: string
) => `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>SmartLab Laboratory Schedule Report</title>
    <style>
      @page { size: 13in 8.5in; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; }
      body { color: #333; font-family: Arial, Helvetica, sans-serif; }
      .report-page { display: grid; grid-template-rows: 32mm minmax(0, 1fr) 51mm; width: 330.2mm; height: 214mm; min-height: 214mm; max-height: 214mm; padding: 0 2.5mm; overflow: hidden; break-after: page; page-break-after: always; }
      .report-page:last-child { break-after: auto; page-break-after: auto; }
      .report-header { display: flex; align-items: flex-start; gap: 4mm; width: 100%; height: 32mm; min-height: 32mm; padding: 4mm; }
      .logo-frame { display: flex; width: 28mm; height: 28mm; flex: 0 0 28mm; align-items: center; justify-content: center; }
      .logo-frame img { width: 26mm; height: 26mm; object-fit: contain; }
      .header-text { padding-top: 4mm; color: #111; font-family: "Times New Roman", Georgia, serif; line-height: 1.05; }
      .header-text p { margin: 0; font-variant: small-caps; }
      .header-text p:nth-child(1) { font-size: 11pt; }
      .header-text p:nth-child(2) { font-size: 17pt; }
      .header-text p:nth-child(3) { font-size: 13pt; }
      .header-text p:nth-child(4) { margin-top: .5mm; font-size: 13pt; font-weight: 700; font-variant: normal; text-transform: uppercase; }
      .header-text span { font-variant: normal; }
      .code-stack { align-self: flex-start; margin-left: auto; padding-top: 5mm; text-align: right; }
      .page-number { margin: 0 0 1mm; color: #111; font-size: 7.5pt; text-align: right; }
      .code-box { border: 1px solid #555; border-right-width: 2px; border-bottom-width: 2px; padding: 2mm 3mm; color: #111; text-align: left; font-size: 7.5pt; font-weight: 550; line-height: 1.4; }
      .code-box p { margin: 0; }
      .code-box p:last-child { margin-top: 1mm; }
      .table-wrap { min-height: 0; width: 100%; overflow: hidden; }
      table { width: 100%; height: auto; border-collapse: collapse; border-spacing: 0; table-layout: fixed; margin: 0; font-family: Arial, Helvetica, sans-serif; }
      th, td { height: 6.5mm; min-width: 0; border: 1px solid #000; padding: .5mm .8mm; overflow-wrap: anywhere; white-space: normal; text-align: center; vertical-align: middle; line-height: 1.15; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      th { background: #f0ad68; font-size: 7pt; font-weight: 700; }
      td { background: #fff; font-size: 7pt; }
      .title-row { height: 8mm; font-family: "Times New Roman", Georgia, serif; font-size: 12pt; line-height: 1; }
      .page-footer { display: grid; grid-template-rows: 24mm 27mm; width: 100%; height: 51mm; min-height: 51mm; max-height: 51mm; overflow: hidden; }
      .signatures { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 40mm; margin: 0 5mm 0 15mm; padding-top: 0; font-size: 9pt; }
      .signatures div { display: flex; flex-direction: column; }
      .signatures em { margin-top: 9mm; font-size: 8pt; font-style: italic; font-weight: 700; }
      .institution-footer { display: flex; align-items: flex-start; justify-content: space-between; gap: 5mm; position: relative; width: 100%; font-size: 7pt; line-height: 1.2; }
      .institution-footer > div { transform: translateX(24mm); }
      .institution-footer p { margin: 0; }
      .institution-footer .slogan { margin-top: 3mm; color: #111; font-family: "Times New Roman", Georgia, serif; font-size: 17pt; font-weight: 400; line-height: 1; }
      .institution-footer .slogan small { font-size: 1.08em; }
      .institution-footer .slogan sup { font-size: .78em; }
      .institution-footer img { width: 32mm; height: 32mm; max-width: 32mm; max-height: 32mm; transform: translateY(-7mm); object-fit: contain; }
    </style>
  </head>
  <body>${pages
    .map((page, index) => renderSchedulePage(page, index + 1, pages.length, logoDataUri, certificationDataUri))
    .join('')}</body>
</html>
`;

const renderScheduleAnalysisRows = (rows: ScheduleAnalysisPdfRow[]) =>
  rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.section)}</td>
          <td>${row.entries}</td>
          <td>${row.rooms}</td>
          <td>${row.recurring}</td>
        </tr>
      `
    )
    .join('');

const renderScheduleAnalysisDocument = (
  pages: ScheduleAnalysisPdfRow[][],
  logoDataUri: string,
  certificationDataUri: string
) => {
  const currentDate = new Intl.DateTimeFormat('en-US', {
    timeZone: REPORT_TIME_ZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>SmartLab Schedule Section Analysis</title>
    <style>
      @page { size: 13in 8.5in; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; }
      body { color: #333; font-family: Arial, Helvetica, sans-serif; }
      .report-page { display: grid; grid-template-rows: 32mm minmax(0, 1fr) 51mm; width: 330.2mm; height: 214mm; min-height: 214mm; max-height: 214mm; padding: 0 2.5mm; overflow: hidden; break-after: page; page-break-after: always; }
      .report-page:last-child { break-after: auto; page-break-after: auto; }
      .report-header { display: flex; align-items: flex-start; gap: 4mm; width: 100%; height: 32mm; min-height: 32mm; padding: 4mm; }
      .logo-frame { display: flex; width: 28mm; height: 28mm; flex: 0 0 28mm; align-items: center; justify-content: center; }
      .logo-frame img { width: 26mm; height: 26mm; object-fit: contain; }
      .header-text { padding-top: 4mm; color: #111; font-family: "Times New Roman", Georgia, serif; line-height: 1.05; }
      .header-text p { margin: 0; font-variant: small-caps; }
      .header-text p:nth-child(1) { font-size: 11pt; }
      .header-text p:nth-child(2) { font-size: 17pt; }
      .header-text p:nth-child(3) { font-size: 13pt; }
      .header-text p:nth-child(4) { margin-top: .5mm; font-size: 13pt; font-weight: 700; font-variant: normal; text-transform: uppercase; }
      .header-text span { font-variant: normal; }
      .code-stack { align-self: flex-start; margin-left: auto; padding-top: 5mm; text-align: right; }
      .page-number { margin: 0 0 1mm; color: #111; font-size: 7.5pt; text-align: right; }
      .code-box { border: 1px solid #555; border-right-width: 2px; border-bottom-width: 2px; padding: 2mm 3mm; color: #111; text-align: left; font-size: 7.5pt; font-weight: 550; line-height: 1.4; }
      .code-box p { margin: 0; }
      .code-box p:last-child { margin-top: 1mm; }
      .table-wrap { min-height: 0; width: 100%; overflow: hidden; }
      table { width: 100%; height: auto; border-collapse: collapse; border-spacing: 0; table-layout: fixed; margin: 0; font-family: Arial, Helvetica, sans-serif; }
      th, td { height: 6.5mm; min-width: 0; border: 1px solid #000; padding: .5mm .8mm; overflow-wrap: anywhere; white-space: normal; text-align: center; vertical-align: middle; line-height: 1.15; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      th { background: #f0ad68; font-size: 7pt; font-weight: 700; }
      td { background: #fff; font-size: 7pt; }
      .title-row { height: 8mm; font-family: "Times New Roman", Georgia, serif; font-size: 12pt; line-height: 1; }
      .page-footer { display: grid; grid-template-rows: 24mm 27mm; width: 100%; height: 51mm; min-height: 51mm; max-height: 51mm; overflow: hidden; }
      .signatures { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 40mm; margin: 0 5mm 0 15mm; padding-top: 0; font-size: 9pt; }
      .signatures div { display: flex; flex-direction: column; }
      .signatures em { margin-top: 9mm; font-size: 8pt; font-style: italic; font-weight: 700; }
      .institution-footer { display: flex; align-items: flex-start; justify-content: space-between; gap: 5mm; position: relative; width: 100%; font-size: 7pt; line-height: 1.2; }
      .institution-footer > div { transform: translateX(24mm); }
      .institution-footer p { margin: 0; }
      .institution-footer .slogan { margin-top: 3mm; color: #111; font-family: "Times New Roman", Georgia, serif; font-size: 17pt; font-weight: 400; line-height: 1; }
      .institution-footer .slogan small { font-size: 1.08em; }
      .institution-footer .slogan sup { font-size: .78em; }
      .institution-footer img { width: 32mm; height: 32mm; max-width: 32mm; max-height: 32mm; transform: translateY(-7mm); object-fit: contain; }
    </style>
  </head>
  <body>${pages
    .map(
      (rows, index) => `
        <section class="report-page">
          <header class="report-header">
            <div class="logo-frame"><img src="${logoDataUri}" alt="" /></div>
            <div class="header-text">
              <p><span>R</span>epublic of the <span>P</span>hilippines</p>
              <p><span>P</span>olytechnic <span>U</span>niversity of the <span>P</span>hilippines</p>
              <p><span>O</span>ffice of the <span>V</span>ice <span>P</span>resident for <span>A</span>cademic <span>A</span>ffairs</p>
              <p>COLLEGE OF COMPUTER AND INFORMATION SCIENCES</p>
            </div>
            <div class="code-stack">
              <p class="page-number">Page: ${index + 1} of ${pages.length}</p>
              <div class="code-box"><p>PUP-ITBL-3-ACAD-010</p><p>REV. 1</p><p>${escapeHtml(currentDate)}</p></div>
            </div>
          </header>
          <div class="table-wrap">
            <table>
              <colgroup><col style="width: 40%" /><col style="width: 20%" /><col style="width: 20%" /><col style="width: 20%" /></colgroup>
              <thead>
                <tr><th colspan="4" class="title-row">Schedule Section Analysis</th></tr>
                <tr><th>Program / year level</th><th>Schedule entries</th><th>Rooms used</th><th>Recurring entries</th></tr>
              </thead>
              <tbody>${renderScheduleAnalysisRows(rows)}</tbody>
            </table>
          </div>
          <div class="page-footer">
            <div class="signatures">
              <div><strong>Prepared by:</strong><em>Laboratory Assistant</em></div>
              <div><strong>Noted by:</strong><em>Head, CCIS Laboratory</em></div>
            </div>
            <footer class="institution-footer">
              <div>
                <p>PUP A. Mabini Campus, Anonas Street, Sta. Mesa, Manila 1016</p>
                <p>Direct Line: 335-1730 | Trunk Line: 335-1787 or 335-1777 local 000</p>
                <p>Website: www.pup.edu.ph | Email: inquire@pup.edu.ph</p>
                <p class="slogan">T<small>he</small> C<small>ountry&apos;s</small> <sup>1st</sup> P<small>olytechnic</small>U</p>
              </div>
              <img src="${certificationDataUri}" alt="ISO 9001:2015 certified" />
            </footer>
          </div>
        </section>
      `
    )
    .join('')}</body>
</html>
`;
};

const buildScheduleFilename = (filters: ScheduleReportFilters) => {
  const datePart = [
    filters.from ? sanitizeFilenamePart(filters.from) : '',
    filters.to ? `to-${sanitizeFilenamePart(filters.to)}` : '',
  ]
    .filter(Boolean)
    .join('-');
  const base = filters.view === 'analysis' ? 'smartlab-schedule-analysis' : 'smartlab-schedule-log';
  return `${base}${datePart ? `-${datePart}` : ''}${filters.scope === 'filtered' ? '-filtered' : ''}.pdf`;
};

const demandGroupLabels: Record<DemandGroupBy, string> = {
  faculty: 'Faculty in charge',
  submittedBy: 'Submitted by',
  program: 'Program and year level',
  subject: 'Subject',
  room: 'Requested room',
};

const activeDemandStatuses = new Set<RequestStatus>([
  RequestStatus.PENDING,
  RequestStatus.APPROVED,
  RequestStatus.BORROWED,
  RequestStatus.RETURNED,
]);

type DemandPdfRow = {
  label: string;
  detail: string;
  requests: number;
  units: number;
  studentSubmitted: number;
  facultySubmitted: number;
};

const getDemandGroup = (request: RequestSummary, groupBy: DemandGroupBy) => {
  if (groupBy === 'faculty') {
    return {
      key: request.facultyId ? `faculty:${request.facultyId}` : 'faculty:unassigned',
      label: request.facultyName?.trim() || 'Unassigned faculty',
      detail: 'Faculty in charge',
    };
  }

  if (groupBy === 'submittedBy') {
    return {
      key: request.requesterId
        ? `requester:${request.requesterId}`
        : `requester:${request.requesterRole}:${request.requesterName.trim()}`,
      label: request.requesterName.trim() || 'Unnamed submitter',
      detail: request.requesterRole === 'FACULTY' ? 'Faculty account' : 'Student account',
    };
  }

  if (groupBy === 'program') {
    return {
      key: request.programId
        ? `program:${request.programId}`
        : `program:${formatSectionLabel(request.program, request.yearLevel)}`,
      label: formatSectionLabel(request.program, request.yearLevel),
      detail: 'Program and year level',
    };
  }

  if (groupBy === 'room') {
    const location = request.location?.trim();
    return {
      key: request.roomId ? `room:${request.roomId}` : `location:${location || 'unassigned'}`,
      label: request.roomId
        ? location || 'Unnamed room'
        : location
          ? `General location: ${location}`
          : 'Room not assigned',
      detail: request.roomId ? 'Requested room' : 'No room record linked',
    };
  }

  return {
    key: request.subjectId
      ? `subject:${request.subjectId}`
      : `subject:${request.subject || 'unassigned'}`,
    label: request.subject?.trim() || 'Unassigned subject',
    detail: 'Subject',
  };
};

const buildDemandRows = (
  requests: RequestSummary[],
  filters: DemandAnalysisReportFilters
): DemandPdfRow[] => {
  const grouped = new Map<
    string,
    DemandPdfRow
  >();

  requests
    .filter(
      (request) =>
        filters.demandStatusScope === 'ALL' || activeDemandStatuses.has(request.status)
    )
    .filter(
      (request) =>
        filters.demandSource === 'ALL' || request.requesterRole === filters.demandSource
    )
    .filter((request) => {
      if (filters.demandRoomType === 'ALL') return true;
      if (filters.demandRoomType === 'COMPUTER_LAB') return request.isComputerLab === true;
      return request.isComputerLab !== true;
    })
    .forEach((request) => {
      const group = getDemandGroup(request, filters.groupBy);
      const current = grouped.get(group.key) ?? {
        label: group.label,
        detail: group.detail,
        requests: 0,
        units: 0,
        studentSubmitted: 0,
        facultySubmitted: 0,
      };

      current.requests += 1;
      current.units += request.items.reduce((total, item) => total + item.quantity, 0);
      if (request.requesterRole === 'STUDENT') current.studentSubmitted += 1;
      if (request.requesterRole === 'FACULTY') current.facultySubmitted += 1;
      grouped.set(group.key, current);
    });

  return Array.from(grouped.values()).sort(
    (first, second) =>
      second.requests - first.requests ||
      second.units - first.units ||
      first.label.localeCompare(second.label)
  );
};

const DEMAND_REPORT_PAGE_ROWS = 10;

const renderDemandRows = (rows: DemandPdfRow[]) =>
  rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.label)}</td>
          <td>${escapeHtml(row.detail)}</td>
          <td>${row.requests}</td>
          <td>${row.units}</td>
          <td>${row.studentSubmitted}</td>
          <td>${row.facultySubmitted}</td>
        </tr>
      `
    )
    .join('');

const renderDemandPage = (
  rows: DemandPdfRow[],
  pageNumber: number,
  totalPages: number,
  filters: DemandAnalysisReportFilters,
  logoDataUri: string,
  certificationDataUri: string
) => {
  const currentDate = new Intl.DateTimeFormat('en-US', {
    timeZone: REPORT_TIME_ZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return `
    <section class="report-page">
      <header class="report-header">
        <div class="logo-frame"><img src="${logoDataUri}" alt="" /></div>
        <div class="header-text">
          <p><span>R</span>epublic of the <span>P</span>hilippines</p>
          <p><span>P</span>olytechnic <span>U</span>niversity of the <span>P</span>hilippines</p>
          <p><span>O</span>ffice of the <span>V</span>ice <span>P</span>resident for <span>A</span>cademic <span>A</span>ffairs</p>
          <p>COLLEGE OF COMPUTER AND INFORMATION SCIENCES</p>
        </div>
        <div class="code-stack">
          <p class="page-number">Page: ${pageNumber} of ${totalPages}</p>
          <div class="code-box">
            <p>PUP-ITBL-3-ACAD-010</p>
            <p>REV. 1</p>
            <p>${escapeHtml(currentDate)}</p>
          </div>
        </div>
      </header>
      <div class="table-wrap">
        <table>
          <colgroup>
            <col style="width: 28%" />
            <col style="width: 20%" />
            <col style="width: 12%" />
            <col style="width: 14%" />
            <col style="width: 13%" />
            <col style="width: 13%" />
          </colgroup>
          <thead>
            <tr><th colspan="6" class="title-row">Request Demand Analysis — ${escapeHtml(demandGroupLabels[filters.groupBy])}</th></tr>
            <tr>
              <th>Group</th><th>Group type</th><th>Requests</th>
              <th>Equipment units</th><th>Student-submitted</th><th>Faculty-submitted</th>
            </tr>
          </thead>
           <tbody>${renderDemandRows(rows)}</tbody>
        </table>
      </div>
      <div class="page-footer">
        <div class="signatures">
          <div><strong>Prepared by:</strong><em>Laboratory Assistant</em></div>
          <div><strong>Noted by:</strong><em>Head, CCIS Laboratory</em></div>
        </div>
        <footer class="institution-footer">
          <div>
            <p>PUP A. Mabini Campus, Anonas Street, Sta. Mesa, Manila 1016</p>
            <p>Direct Line: 335-1730 | Trunk Line: 335-1787 or 335-1777 local 000</p>
            <p>Website: www.pup.edu.ph | Email: inquire@pup.edu.ph</p>
            <p class="slogan">T<small>he</small> C<small>ountry&apos;s</small> <sup>1st</sup> P<small>olytechnic</small>U</p>
          </div>
          <img src="${certificationDataUri}" alt="ISO 9001:2015 certified" />
        </footer>
      </div>
    </section>
  `;
};

const renderDemandDocument = (
  pages: DemandPdfRow[][],
  filters: DemandAnalysisReportFilters,
  logoDataUri: string,
  certificationDataUri: string
) => `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>SmartLab Request Demand Analysis</title>
    <style>
      @page { size: 13in 8.5in; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; }
      body { color: #333; font-family: Arial, Helvetica, sans-serif; }
      .report-page {
        display: grid;
        grid-template-rows: 32mm minmax(0, 1fr) 51mm;
        width: 330.2mm;
        height: 214mm;
        min-height: 214mm;
        max-height: 214mm;
        padding: 0 2.5mm;
        overflow: hidden;
        break-after: page;
        page-break-after: always;
      }
      .report-page:last-child { break-after: auto; page-break-after: auto; }
      .report-header {
        display: flex;
        align-items: flex-start;
        gap: 4mm;
        width: 100%;
        height: 32mm;
        min-height: 32mm;
        padding: 4mm;
      }
      .logo-frame { display: flex; width: 28mm; height: 28mm; flex: 0 0 28mm; align-items: center; justify-content: center; }
      .logo-frame img { width: 26mm; height: 26mm; object-fit: contain; }
      .header-text { padding-top: 4mm; color: #111; font-family: "Times New Roman", Georgia, serif; line-height: 1.05; }
      .header-text p { margin: 0; font-variant: small-caps; }
      .header-text p:nth-child(1) { font-size: 11pt; }
      .header-text p:nth-child(2) { font-size: 17pt; }
      .header-text p:nth-child(3) { font-size: 13pt; }
      .header-text p:nth-child(4) { margin-top: .5mm; font-size: 13pt; font-weight: 700; font-variant: normal; text-transform: uppercase; }
      .header-text span { font-variant: normal; }
      .code-stack { align-self: flex-start; margin-left: auto; padding-top: 5mm; text-align: right; }
      .page-number { margin: 0 0 1mm; color: #111; font-size: 7.5pt; text-align: right; }
      .code-box { border: 1px solid #555; border-right-width: 2px; border-bottom-width: 2px; padding: 2mm 3mm; color: #111; text-align: left; font-size: 7.5pt; font-weight: 550; line-height: 1.4; }
      .code-box p { margin: 0; }
      .code-box p:last-child { margin-top: 1mm; }
      .table-wrap { min-height: 0; width: 100%; overflow: hidden; }
      table { width: 100%; height: auto; border-collapse: collapse; border-spacing: 0; table-layout: fixed; margin: 0; font-family: Arial, Helvetica, sans-serif; }
      th, td { height: 6.5mm; min-width: 0; border: 1px solid #000; padding: .5mm .8mm; overflow: visible; overflow-wrap: anywhere; text-overflow: clip; white-space: normal; text-align: center; vertical-align: middle; line-height: 1.15; }
      th { background: #f0ad68; font-size: 7pt; font-weight: 700; }
      td { background: #fff; font-size: 7pt; }
      .title-row { height: 8mm; font-family: "Times New Roman", Georgia, serif; font-size: 12pt; line-height: 1; }
      .page-footer { display: grid; grid-template-rows: 24mm 27mm; width: 100%; height: 51mm; min-height: 51mm; max-height: 51mm; overflow: hidden; }
      .signatures { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 40mm; margin: 0 5mm 0 15mm; padding-top: 0; font-size: 9pt; }
      .signatures div { display: flex; flex-direction: column; }
      .signatures em { margin-top: 9mm; font-size: 8pt; font-style: italic; font-weight: 700; }
      .institution-footer { display: flex; align-items: flex-start; justify-content: space-between; gap: 5mm; position: relative; width: 100%; font-size: 7pt; line-height: 1.2; }
      .institution-footer > div { transform: translateX(24mm); }
      .institution-footer p { margin: 0; }
      .institution-footer .slogan { margin-top: 3mm; color: #111; font-family: "Times New Roman", Georgia, serif; font-size: 17pt; font-weight: 400; line-height: 1; }
      .institution-footer .slogan small { font-size: 1.08em; }
      .institution-footer .slogan sup { font-size: .78em; }
      .institution-footer img { width: 32mm; height: 32mm; max-width: 32mm; max-height: 32mm; transform: translateY(-7mm); object-fit: contain; }
    </style>
  </head>
  <body>${pages
    .map((page, index) =>
      renderDemandPage(page, index + 1, pages.length, filters, logoDataUri, certificationDataUri)
    )
    .join('')}</body>
</html>
`;

const buildDemandFilename = (filters: DemandAnalysisReportFilters) => {
  const datePart = [
    filters.from ? sanitizeFilenamePart(filters.from) : '',
    filters.to ? `to-${sanitizeFilenamePart(filters.to)}` : '',
  ]
    .filter(Boolean)
    .join('-');
  return `smartlab-request-demand-analysis-${sanitizeFilenamePart(filters.groupBy)}${
    datePart ? `-${datePart}` : ''
  }.pdf`;
};

export const generateBorrowRequestPdf = limitedReport(async (
  prisma: PrismaClient,
  filters: BorrowRequestReportFilters
) => {
  const requests = await getReportRows(prisma, filters);
  const pages: RequestSummary[][] = [];
  const totalPages = Math.max(1, Math.ceil(Math.max(requests.length, REPORT_PAGE_ROWS) / REPORT_PAGE_ROWS));

  for (let index = 0; index < totalPages; index += 1) {
    pages.push(requests.slice(index * REPORT_PAGE_ROWS, (index + 1) * REPORT_PAGE_ROWS));
  }

  const [logoDataUri, certificationDataUri] = await Promise.all([
    readAssetDataUri('PUPLogo.png'),
    readAssetDataUri('iso-certification.png'),
  ]);

    return {
      buffer: await renderHtmlPdf(renderDocument(pages, logoDataUri, certificationDataUri)),
      filename: buildFilename(filters),
      count: requests.length,
    };
});

export const generateLabSchedulePdf = limitedReport(async (
  prisma: PrismaClient,
  filters: ScheduleReportFilters
) => {
  const schedules = await getScheduleRows(prisma, filters);
  const isAnalysis = filters.view === 'analysis';
  const rows = isAnalysis ? buildScheduleAnalysisRows(schedules) : buildSchedulePdfRows(schedules);
  const rowsPerPage = isAnalysis ? SCHEDULE_ANALYSIS_PAGE_ROWS : SCHEDULE_REPORT_PAGE_ROWS;
  const totalPages = Math.max(1, Math.ceil(Math.max(rows.length, rowsPerPage) / rowsPerPage));
  const pages = Array.from({ length: totalPages }, (_, index) =>
    rows.slice(index * rowsPerPage, (index + 1) * rowsPerPage)
  );

  const [logoDataUri, certificationDataUri] = await Promise.all([
    readAssetDataUri('PUPLogo.png'),
    readAssetDataUri('iso-certification.png'),
  ]);

    const html = isAnalysis
      ? renderScheduleAnalysisDocument(
          pages as ScheduleAnalysisPdfRow[][],
          logoDataUri,
          certificationDataUri
        )
      : renderScheduleDocument(pages as SchedulePdfRow[][], logoDataUri, certificationDataUri);
    return {
      buffer: await renderHtmlPdf(html),
      filename: buildScheduleFilename(filters),
      count: rows.length,
    };
});

export const generateDemandAnalysisPdf = limitedReport(async (
  prisma: PrismaClient,
  filters: DemandAnalysisReportFilters
) => {
  const requests = await getReportRows(prisma, filters);
  const rows = buildDemandRows(requests, filters);
  const totalPages = Math.max(1, Math.ceil(Math.max(rows.length, DEMAND_REPORT_PAGE_ROWS) / DEMAND_REPORT_PAGE_ROWS));
  const pages = Array.from({ length: totalPages }, (_, index) =>
    rows.slice(index * DEMAND_REPORT_PAGE_ROWS, (index + 1) * DEMAND_REPORT_PAGE_ROWS)
  );

  const [logoDataUri, certificationDataUri] = await Promise.all([
    readAssetDataUri('PUPLogo.png'),
    readAssetDataUri('iso-certification.png'),
  ]);

    return {
      buffer: await renderHtmlPdf(renderDemandDocument(pages, filters, logoDataUri, certificationDataUri)),
      filename: buildDemandFilename(filters),
      count: rows.length,
    };
});

export type EquipmentReportScope = 'period' | 'filtered';
export type EquipmentReportView = 'inventory' | 'usage';
export type EquipmentReportKind = 'log' | 'analysis';

export type EquipmentReportFilters = {
  scope: EquipmentReportScope;
  view: EquipmentReportView;
  report: EquipmentReportKind;
  academicYearId?: string;
  termId?: string;
  from?: string;
  to?: string;
  search?: string;
  status?: EquipmentStatus;
  lowStock?: boolean;
};

type EquipmentStatusCount = {
  requests: number;
  units: number;
};

type EquipmentReportRow = {
  equipment: string;
  status: EquipmentStatus;
  totalQuantity: number;
  availableQuantity: number;
  borrowedQuantity: number;
  damagedQuantity: number;
  timesRequested: number;
  unitsRequested: number;
  unitsReturned: number;
  unreturned: number;
  statusCounts: Record<RequestStatus, EquipmentStatusCount>;
};

type EquipmentAnalysisPdfRow = {
  rank: number;
  equipment: string;
  primary: string;
  detail: string;
  secondary: string;
  statusBreakdown: string;
};

const emptyEquipmentStatusCounts = (): Record<RequestStatus, EquipmentStatusCount> => ({
  PENDING: { requests: 0, units: 0 },
  APPROVED: { requests: 0, units: 0 },
  BORROWED: { requests: 0, units: 0 },
  RETURNED: { requests: 0, units: 0 },
  REJECTED: { requests: 0, units: 0 },
  CANCELLED: { requests: 0, units: 0 },
});

const equipmentStatusLabels: Record<EquipmentStatus, string> = {
  AVAILABLE: 'Available',
  BORROWED: 'Borrowed',
  DAMAGED: 'Damaged',
  UNAVAILABLE: 'Unavailable',
};

const getEquipmentReportRows = async (
  prisma: PrismaClient,
  filters: EquipmentReportFilters
): Promise<EquipmentReportRow[]> => {
  const equipment = await prisma.equipment.findMany({ take: REPORT_MAX_ROWS + 1, orderBy: [{ name: 'asc' }, { id: 'asc' }], where: {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.lowStock ? { totalQuantity: { gt: 1 }, availableQuantity: { lte: 1 } } : {}),
  } });
  assertReportSize(equipment);
  const usage = new Map<string, Omit<EquipmentReportRow, 'equipment' | 'status' | 'totalQuantity' | 'availableQuantity' | 'borrowedQuantity' | 'damagedQuantity'>>();

  if (filters.view === 'usage') {
    const requests = await getReportRows(prisma, {
      scope: 'period',
      academicYearId: filters.academicYearId,
      termId: filters.termId,
      from: filters.from,
      to: filters.to,
    });

    requests.forEach((request) => {
      request.items.forEach((item) => {
        const current = usage.get(item.equipmentId) ?? {
          timesRequested: 0,
          unitsRequested: 0,
          unitsReturned: 0,
          unreturned: 0,
          statusCounts: emptyEquipmentStatusCounts(),
        };
        current.timesRequested += 1;
        current.unitsRequested += item.quantity;
        if (request.status === RequestStatus.RETURNED) current.unitsReturned += item.quantity;
        current.statusCounts[request.status].requests += 1;
        current.statusCounts[request.status].units += item.quantity;
        usage.set(item.equipmentId, current);
      });
    });
  }

  const search = filters.search?.trim().toLowerCase() ?? '';
  const rows = equipment
    .filter((item) => !filters.status || item.status === filters.status)
    .filter((item) => !filters.lowStock || (item.totalQuantity > 1 && item.availableQuantity <= 1))
    .filter(
      (item) =>
        !search ||
        `${item.name} ${item.description ?? ''} ${item.status}`.toLowerCase().includes(search)
    )
    .map((item) => {
      const itemUsage = usage.get(item.id) ?? {
        timesRequested: 0,
        unitsRequested: 0,
        unitsReturned: 0,
        unreturned: 0,
        statusCounts: emptyEquipmentStatusCounts(),
      };
      return {
        equipment: item.name,
        status: item.status,
        totalQuantity: item.totalQuantity,
        availableQuantity: item.availableQuantity,
        borrowedQuantity: item.borrowedQuantity,
        damagedQuantity: item.damagedQuantity,
        ...itemUsage,
        unreturned: Math.max(itemUsage.unitsRequested - itemUsage.unitsReturned, 0),
      };
    });

  return rows.sort((first, second) =>
    filters.view === 'usage'
      ? second.unitsRequested - first.unitsRequested || first.equipment.localeCompare(second.equipment)
      : second.totalQuantity - first.totalQuantity || first.equipment.localeCompare(second.equipment)
  );
};

const buildEquipmentAnalysisRows = (
  rows: EquipmentReportRow[],
  view: EquipmentReportView
): EquipmentAnalysisPdfRow[] =>
  rows
    .filter((row) => view !== 'usage' || row.unitsRequested > 0)
    .map((row, index) => ({
      rank: index + 1,
      equipment: row.equipment,
      primary:
        view === 'usage'
          ? `${row.unitsRequested} ${row.unitsRequested === 1 ? 'unit' : 'units'}`
          : `${row.totalQuantity} ${row.totalQuantity === 1 ? 'unit' : 'units'}`,
      detail:
        view === 'usage'
          ? `${row.timesRequested} ${row.timesRequested === 1 ? 'request' : 'requests'} · ${row.unitsRequested} ${row.unitsRequested === 1 ? 'unit' : 'units'}`
          : `${row.borrowedQuantity} borrowed · ${row.damagedQuantity} damaged`,
      secondary:
        view === 'usage'
          ? `${row.unreturned} unreturned`
          : `${row.availableQuantity} available`,
      statusBreakdown:
        view === 'usage'
          ? Object.entries(row.statusCounts)
              .filter(([, count]) => count.requests > 0)
              .map(([status, count]) => `${statusLabels[status as RequestStatus]}: ${count.requests} requests / ${count.units} units`)
              .join('; ') || '—'
          : '—',
    }));

const renderEquipmentLogRows = (rows: EquipmentReportRow[], view: EquipmentReportView) =>
  rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.equipment)}</td>
          <td>${escapeHtml(equipmentStatusLabels[row.status])}</td>
          <td>${row.totalQuantity}</td>
          ${
            view === 'usage'
              ? `<td>${row.timesRequested}</td><td>${row.unitsRequested}</td><td>${row.unitsReturned}</td><td>${row.unreturned}</td>`
              : `<td>${row.availableQuantity}</td><td>${row.borrowedQuantity}</td><td>${row.damagedQuantity}</td>`
          }
        </tr>
      `
    )
    .join('');

const renderEquipmentAnalysisRows = (rows: EquipmentAnalysisPdfRow[]) =>
  rows
    .map(
      (row) => `
        <tr>
          <td>${row.rank}</td>
          <td>${escapeHtml(row.equipment)}</td>
          <td>${escapeHtml(row.primary)}</td>
          <td>${escapeHtml(row.detail)}</td>
          <td>${escapeHtml(row.secondary)}</td>
          <td>${escapeHtml(row.statusBreakdown)}</td>
        </tr>
      `
    )
    .join('');

const renderEquipmentPage = (
  rows: EquipmentReportRow[] | EquipmentAnalysisPdfRow[],
  pageNumber: number,
  totalPages: number,
  filters: EquipmentReportFilters,
  logoDataUri: string,
  certificationDataUri: string
) => {
  const currentDate = new Intl.DateTimeFormat('en-US', {
    timeZone: REPORT_TIME_ZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());
  const title =
    filters.report === 'analysis'
      ? filters.view === 'usage'
        ? 'Equipment Usage Analysis'
        : 'Equipment Inventory Analysis'
      : filters.view === 'usage'
        ? 'Equipment Usage Log'
        : 'Equipment Inventory Log';
  const table = filters.report === 'analysis'
    ? `
      <colgroup>
        <col style="width: 6%" /><col style="width: 22%" /><col style="width: 14%" />
        <col style="width: 20%" /><col style="width: 12%" /><col style="width: 26%" />
      </colgroup>
      <thead>
        <tr><th colspan="6" class="title-row">${title}</th></tr>
        <tr>
          <th>Rank</th><th>Equipment</th>
          <th>${filters.view === 'usage' ? 'Units requested' : 'Total quantity'}</th>
          <th>${filters.view === 'usage' ? 'Activity' : 'Condition'}</th>
          <th>${filters.view === 'usage' ? 'Unreturned' : 'Available'}</th>
          <th>Request status mix</th>
        </tr>
      </thead>
      <tbody>${renderEquipmentAnalysisRows(rows as EquipmentAnalysisPdfRow[])}</tbody>
    `
    : filters.view === 'usage'
      ? `
        <colgroup>
          <col style="width: 25%" /><col style="width: 12%" /><col style="width: 10%" />
          <col style="width: 13%" /><col style="width: 13%" /><col style="width: 13%" /><col style="width: 14%" />
        </colgroup>
        <thead>
          <tr><th colspan="7" class="title-row">${title}</th></tr>
          <tr><th>Equipment</th><th>Status</th><th>Total qty</th><th>Times requested</th><th>Units requested</th><th>Units returned</th><th>Unreturned</th></tr>
        </thead>
        <tbody>${renderEquipmentLogRows(rows as EquipmentReportRow[], filters.view)}</tbody>
      `
      : `
        <colgroup>
          <col style="width: 30%" /><col style="width: 14%" /><col style="width: 14%" />
          <col style="width: 14%" /><col style="width: 14%" /><col style="width: 14%" />
        </colgroup>
        <thead>
          <tr><th colspan="6" class="title-row">${title}</th></tr>
          <tr><th>Equipment</th><th>Status</th><th>Total qty</th><th>Available</th><th>Borrowed</th><th>Damaged</th></tr>
        </thead>
        <tbody>${renderEquipmentLogRows(rows as EquipmentReportRow[], filters.view)}</tbody>
      `;

  return `
    <section class="report-page">
      <header class="report-header">
        <div class="logo-frame"><img src="${logoDataUri}" alt="" /></div>
        <div class="header-text">
          <p><span>R</span>epublic of the <span>P</span>hilippines</p>
          <p><span>P</span>olytechnic <span>U</span>niversity of the <span>P</span>hilippines</p>
          <p><span>O</span>ffice of the <span>V</span>ice <span>P</span>resident for <span>A</span>cademic <span>A</span>ffairs</p>
          <p>COLLEGE OF COMPUTER AND INFORMATION SCIENCES</p>
        </div>
        <div class="code-stack">
          <p class="page-number">Page: ${pageNumber} of ${totalPages}</p>
          <div class="code-box"><p>PUP-ITBL-3-ACAD-010</p><p>REV. 1</p><p>${escapeHtml(currentDate)}</p></div>
        </div>
      </header>
      <div class="table-wrap">
        <table>${table}</table>
      </div>
      <div class="page-footer">
        <div class="signatures">
          <div><strong>Prepared by:</strong><em>Laboratory Assistant</em></div>
          <div><strong>Noted by:</strong><em>Head, CCIS Laboratory</em></div>
        </div>
        <footer class="institution-footer">
          <div>
            <p>PUP A. Mabini Campus, Anonas Street, Sta. Mesa, Manila 1016</p>
            <p>Direct Line: 335-1730 | Trunk Line: 335-1787 or 335-1777 local 000</p>
            <p>Website: www.pup.edu.ph | Email: inquire@pup.edu.ph</p>
            <p class="slogan">T<small>he</small> C<small>ountry&apos;s</small> <sup>1st</sup> P<small>olytechnic</small>U</p>
          </div>
          <img src="${certificationDataUri}" alt="ISO 9001:2015 certified" />
        </footer>
      </div>
    </section>
  `;
};

const renderEquipmentDocument = (
  pages: Array<EquipmentReportRow[] | EquipmentAnalysisPdfRow[]>,
  filters: EquipmentReportFilters,
  logoDataUri: string,
  certificationDataUri: string
) => `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>SmartLab Equipment Report</title>
    <style>
      @page { size: 13in 8.5in; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; }
      body { color: #333; font-family: Arial, Helvetica, sans-serif; }
      .report-page { display: grid; grid-template-rows: 32mm minmax(0, 1fr) 51mm; width: 330.2mm; height: 214mm; min-height: 214mm; max-height: 214mm; padding: 0 2.5mm; overflow: hidden; break-after: page; page-break-after: always; }
      .report-page:last-child { break-after: auto; page-break-after: auto; }
      .report-header { display: flex; align-items: flex-start; gap: 4mm; width: 100%; height: 32mm; min-height: 32mm; padding: 4mm; }
      .logo-frame { display: flex; width: 28mm; height: 28mm; flex: 0 0 28mm; align-items: center; justify-content: center; }
      .logo-frame img { width: 26mm; height: 26mm; object-fit: contain; }
      .header-text { padding-top: 4mm; color: #111; font-family: "Times New Roman", Georgia, serif; line-height: 1.05; }
      .header-text p { margin: 0; font-variant: small-caps; }
      .header-text p:nth-child(1) { font-size: 11pt; }
      .header-text p:nth-child(2) { font-size: 17pt; }
      .header-text p:nth-child(3) { font-size: 13pt; }
      .header-text p:nth-child(4) { margin-top: .5mm; font-size: 13pt; font-weight: 700; font-variant: normal; text-transform: uppercase; }
      .header-text span { font-variant: normal; }
      .code-stack { align-self: flex-start; margin-left: auto; padding-top: 5mm; text-align: right; }
      .page-number { margin: 0 0 1mm; color: #111; font-size: 7.5pt; text-align: right; }
      .code-box { border: 1px solid #555; border-right-width: 2px; border-bottom-width: 2px; padding: 2mm 3mm; color: #111; text-align: left; font-size: 7.5pt; font-weight: 550; line-height: 1.4; }
      .code-box p { margin: 0; }
      .code-box p:last-child { margin-top: 1mm; }
      .table-wrap { min-height: 0; width: 100%; overflow: hidden; }
      table { width: 100%; height: auto; border-collapse: collapse; border-spacing: 0; table-layout: fixed; margin: 0; font-family: Arial, Helvetica, sans-serif; }
      th, td { height: 6.5mm; min-width: 0; border: 1px solid #000; padding: .5mm .8mm; overflow-wrap: anywhere; white-space: normal; text-align: center; vertical-align: middle; line-height: 1.15; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      th { background: #f0ad68; font-size: 7pt; font-weight: 700; }
      td { background: #fff; font-size: 7pt; }
      .title-row { height: 8mm; font-family: "Times New Roman", Georgia, serif; font-size: 12pt; line-height: 1; }
      .page-footer { display: grid; grid-template-rows: 24mm 27mm; width: 100%; height: 51mm; min-height: 51mm; max-height: 51mm; overflow: hidden; }
      .signatures { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 40mm; margin: 0 5mm 0 15mm; padding-top: 0; font-size: 9pt; }
      .signatures div { display: flex; flex-direction: column; }
      .signatures em { margin-top: 9mm; font-size: 8pt; font-style: italic; font-weight: 700; }
      .institution-footer { display: flex; align-items: flex-start; justify-content: space-between; gap: 5mm; position: relative; width: 100%; font-size: 7pt; line-height: 1.2; }
      .institution-footer > div { transform: translateX(24mm); }
      .institution-footer p { margin: 0; }
      .institution-footer .slogan { margin-top: 3mm; color: #111; font-family: "Times New Roman", Georgia, serif; font-size: 17pt; font-weight: 400; line-height: 1; }
      .institution-footer .slogan small { font-size: 1.08em; }
      .institution-footer .slogan sup { font-size: .78em; }
      .institution-footer img { width: 32mm; height: 32mm; max-width: 32mm; max-height: 32mm; transform: translateY(-7mm); object-fit: contain; }
    </style>
  </head>
  <body>${pages.map((page, index) => renderEquipmentPage(page, index + 1, pages.length, filters, logoDataUri, certificationDataUri)).join('')}</body>
</html>
`;

const buildEquipmentFilename = (filters: EquipmentReportFilters) => {
  const datePart = [
    filters.from ? sanitizeFilenamePart(filters.from) : '',
    filters.to ? `to-${sanitizeFilenamePart(filters.to)}` : '',
  ]
    .filter(Boolean)
    .join('-');
  const base = `smartlab-equipment-${filters.view}-${filters.report}`;
  return `${base}${datePart ? `-${datePart}` : ''}${filters.scope === 'filtered' ? '-filtered' : ''}.pdf`;
};

export const generateEquipmentPdf = limitedReport(async (
  prisma: PrismaClient,
  filters: EquipmentReportFilters
) => {
  const rows = await getEquipmentReportRows(prisma, filters);
  const outputRows =
    filters.report === 'analysis' ? buildEquipmentAnalysisRows(rows, filters.view) : rows;
  const rowsPerPage = filters.report === 'analysis' ? 10 : REPORT_PAGE_ROWS;
  const totalPages = Math.max(1, Math.ceil(Math.max(outputRows.length, rowsPerPage) / rowsPerPage));
  const pages = Array.from({ length: totalPages }, (_, index) =>
    outputRows.slice(index * rowsPerPage, (index + 1) * rowsPerPage)
  );

  const [logoDataUri, certificationDataUri] = await Promise.all([
    readAssetDataUri('PUPLogo.png'),
    readAssetDataUri('iso-certification.png'),
  ]);

    return {
      buffer: await renderHtmlPdf(renderEquipmentDocument(pages, filters, logoDataUri, certificationDataUri)),
      filename: buildEquipmentFilename(filters),
      count: outputRows.length,
    };
});