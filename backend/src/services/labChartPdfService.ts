import { PrismaClient, ScheduleType } from '@prisma/client';
import { renderHtmlPdf } from './chromiumPdfService';
import { academicPeriodWhere } from './academicPeriodService';
import { assertReportSize, limitedReport, REPORT_MAX_ROWS } from './reportLimits';
import { DomainError } from './domainError';
import { manilaDateKey, manilaMinutes, formatManilaTime } from '../utils/manilaTime';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
export type ChartPdfFilters = { period: 'week' | 'month'; lab: string; scheduleType: 'ALL' | ScheduleType; academicYearId?: string; termId?: string };
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const addDays = (key: string, days: number) => { const date = new Date(`${key}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
export function chartPdfWeeks(period: 'week' | 'month', today: string) {
  const first = period === 'month' ? `${today.slice(0, 7)}-01` : today;
  const day = new Date(`${first}T00:00:00Z`).getUTCDay();
  const weeks = [addDays(first, day === 0 ? -6 : 1 - day)];
  if (period === 'month') for (let next = addDays(weeks[0], 7); next.slice(0, 7) <= today.slice(0, 7); next = addDays(next, 7)) weeks.push(next);
  return weeks;
}
const roomLabel = (room: { roomNumber: string | null; name: string | null }) => [room.roomNumber?.trim(), room.name?.trim()].filter(Boolean).join(' – ');
export const generateLabChartPdf = limitedReport(async (prisma: PrismaClient, filters: ChartPdfFilters) => {
  const today = manilaDateKey(new Date());
  const weeks = chartPdfWeeks(filters.period, today);
  const rooms = (await prisma.room.findMany({ where: { isComputerLab: true }, orderBy: { roomNumber: 'asc' }, take: 101 })).filter(room => filters.lab === 'ALL' || roomLabel(room) === filters.lab);
  if (!rooms.length) throw new DomainError(400, 'Choose an available computer laboratory.', 'INVALID_LAB');
  if (rooms.length * weeks.length > 60) throw new DomainError(413, 'Choose fewer laboratories for this PDF.', 'REPORT_TOO_LARGE');
  const from = filters.period === 'month' ? `${today.slice(0, 7)}-01` : weeks[0];
  const end = filters.period === 'month' ? new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1)).toISOString().slice(0, 10) : addDays(weeks[0], 7);
  const schedules = await prisma.labSchedule.findMany({
    where: { ...academicPeriodWhere(filters), roomId: { in: rooms.map(room => room.id) }, ...(filters.scheduleType !== 'ALL' ? { scheduleType: filters.scheduleType } : {}), OR: [{ scheduleType: 'WEEKLY' }, { scheduleType: 'ONE_TIME', scheduleDate: { gte: new Date(`${from}T00:00:00+08:00`), lt: new Date(`${end}T00:00:00+08:00`) } }] },
    include: { faculty: { include: { user: true } }, program: true, subject: true }, orderBy: [{ timeStart: 'asc' }, { id: 'asc' }], take: REPORT_MAX_ROWS + 1,
  });
  assertReportSize(schedules);
  const [year, term] = await Promise.all([filters.academicYearId ? prisma.academicYear.findUnique({ where: { id: filters.academicYearId } }) : null, filters.termId ? prisma.term.findUnique({ where: { id: filters.termId } }) : null]);
  let logo = '';
  for (const file of [path.resolve(process.cwd(), '../frontend/public/PUPLogo.png'), path.resolve(process.cwd(), 'frontend/public/PUPLogo.png')]) {
    try { logo = `data:image/png;base64,${(await readFile(file)).toString('base64')}`; break; } catch { /* Try repository-root layout. */ }
  }
  let page = 0;
  const htmlPages = rooms.flatMap(room => weeks.map(week => {
    const columns = Array.from({ length: 6 }, (_, day) => {
      const date = addDays(week, day);
      const outside = filters.period === 'month' && !date.startsWith(today.slice(0, 7));
      const entries = outside ? [] : schedules.filter(schedule => schedule.roomId === room.id && (schedule.scheduleType === 'WEEKLY' ? schedule.dayOfWeek === day + 1 : schedule.scheduleDate && manilaDateKey(schedule.scheduleDate) === date));
      return `<div class="column ${outside ? 'outside' : ''}"><div class="day">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]} ${date.slice(8)}</div>${entries.map(entry => {
        const start = Math.max(420, manilaMinutes(entry.timeStart)); const stop = Math.min(1260, manilaMinutes(entry.timeEnd));
        if (stop <= start) return '';
        return `<div class="entry ${entry.scheduleType === 'WEEKLY' ? 'weekly' : 'once'}" style="top:${(start - 420) / 840 * 100}%;height:${(stop - start) / 840 * 100}%"><b>${escape(entry.program?.code || entry.program?.name || 'Lab session')}${entry.yearLevel ? ` - ${entry.yearLevel}` : ''}</b><span>${escape(formatManilaTime(entry.timeStart))} - ${escape(formatManilaTime(entry.timeEnd))}</span>${stop - start >= 60 ? `<span>${escape(entry.faculty.user.firstName)} ${escape(entry.faculty.user.lastName)}</span>` : ''}${stop - start >= 90 ? `<span>${escape(entry.subject?.name)}</span>` : ''}</div>`;
      }).join('')}</div>`;
    }).join('');
    const times = Array.from({ length: 15 }, (_, hour) => `<span style="top:${hour / 14 * 100}%">${(hour + 7) % 12 || 12}:00 ${hour + 7 < 12 ? 'AM' : 'PM'}</span>`).join('');
    return `<section><header>${logo ? `<img src="${logo}"/>` : ''}<div>Republic of the Philippines<h2>Polytechnic University of the Philippines</h2>Office of the Vice President for Academic Affairs<br/><b>College of Computer and Information Sciences</b></div></header><h1>Laboratory Schedule</h1><p>${escape(roomLabel(room))} | ${week} to ${addDays(week, 5)}</p><p>${escape(year?.year || 'All academic years')} | ${escape(term?.name || 'All terms')} | ${filters.scheduleType === 'ALL' ? 'All types' : filters.scheduleType === 'WEEKLY' ? 'Weekly' : 'One-time'}</p><div class="chart"><div class="times">${times}</div>${columns}</div><footer>Weekly: blue | One-time: red${filters.period === 'month' ? ' | Gray dates: outside the month' : ''} <span>Page ${++page} of ${rooms.length * weeks.length}</span></footer></section>`;
  })).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
  @page{size:8.5in 13in;margin:10mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#321d1d;font-size:10pt}section{height:308mm;break-after:page;break-inside:avoid}section:last-child{break-after:auto}header{height:30mm;display:flex;align-items:center;gap:4mm;border-bottom:1px solid #c8aaa2}header img{width:24mm;height:24mm}h2{font:14pt Georgia;margin:2mm 0}h1{text-align:center;font-size:15pt;margin:4mm 0 2mm}p{text-align:center;margin:2mm 0;font-size:9pt}.chart{display:grid;grid-template-columns:18mm repeat(6,1fr);height:223mm;margin-top:12mm}.column{position:relative;border:1px solid #ddd;background:repeating-linear-gradient(to bottom,transparent 0,transparent calc(100% / 28 - 1px),#eee calc(100% / 28 - 1px),#eee calc(100% / 28))}.outside{background:#e5e7eb}.day{position:absolute;top:-7mm;width:100%;text-align:center;font-weight:bold;font-size:9pt}.times{position:relative}.times span{position:absolute;transform:translateY(-50%);font-size:8pt}.entry{position:absolute;left:1mm;right:1mm;border-left:2px solid;padding:1mm;font-size:7pt;overflow:hidden}.entry span,.entry b{display:block;line-height:1.15}.weekly{background:#e4efff;border-color:#245a95;color:#193e69}.once{background:#fee2e2;border-color:#b91c1c;color:#7f1d1d}footer{margin-top:4mm;font-size:8pt}footer span{float:right}
  </style></head><body>${htmlPages}</body></html>`;
  return { buffer: await renderHtmlPdf(html), filename: `smartlab-lab-charts-${filters.period}-${today}.pdf` };
});
