const { test } = require('node:test');
const assert = require('node:assert/strict');
const renderer = require('../dist/services/chromiumPdfService');
let html = '';
renderer.renderHtmlPdf = async value => { html = value; return Buffer.from('%PDF-test'); };
const { generateLabChartPdf, chartPdfWeeks } = require('../dist/services/labChartPdfService');
const { manilaDateKey } = require('../dist/utils/manilaTime');
const rooms = [1, 2, 3].map(n => ({ id: String(n), name: `Lab ${n}`, roomNumber: String(n) }));
const fixture = () => ({ room: { findMany: async () => rooms }, labSchedule: { findMany: async () => [] }, academicYear: { findUnique: async () => ({ year: '2026-2027' }) }, term: { findUnique: async () => ({ name: '1st Semester' }) } });
const filters = { period: 'week', lab: '1 – Lab 1', scheduleType: 'ALL', academicYearId: 'year', termId: 'term' };
test('week and month boundaries include year rollover', () => {
  assert.deepEqual(chartPdfWeeks('week', '2026-10-21'), ['2026-10-19']);
  assert.equal(chartPdfWeeks('month', '2026-10-21').length, 5);
  assert.equal(chartPdfWeeks('month', '2026-03-10').length, 6);
  assert.equal(chartPdfWeeks('month', '2026-01-01')[0], '2025-12-29');
});
test('single lab week is one page including empty weeks', async () => {
  const report = await generateLabChartPdf(fixture(), filters);
  assert.equal(report.buffer.toString(), '%PDF-test');
  assert.equal((html.match(/<section>/g) || []).length, 1);
  assert.match(html, /2026-2027/);
});
test('all labs month creates one page per lab and week, with boundary shading', async () => {
  await generateLabChartPdf(fixture(), { ...filters, period: 'month', lab: 'ALL' });
  assert.equal((html.match(/<section>/g) || []).length, chartPdfWeeks('month', manilaDateKey(new Date())).length * 3);
  assert.match(html, /Gray dates/);
});
test('query uses selected period, room, type and bounded date range; content is escaped', async () => {
  const db = fixture();
  db.labSchedule.findMany = async ({ where, take }) => {
    assert.equal(where.academicYearId, 'year'); assert.equal(where.termId, 'term'); assert.equal(where.scheduleType, 'WEEKLY'); assert.deepEqual(where.roomId.in, ['1']); assert.equal(take, 1001); assert.ok(where.OR[1].scheduleDate.gte instanceof Date);
    return [{ roomId: '1', scheduleType: 'WEEKLY', dayOfWeek: 1, timeStart: new Date('2026-10-19T00:00:00Z'), timeEnd: new Date('2026-10-19T02:00:00Z'), program: { code: '<script>alert(1)</script>' }, faculty: { user: { firstName: 'Example', lastName: 'Teacher' } }, subject: { name: 'Subject' } }];
  };
  await generateLabChartPdf(db, { ...filters, scheduleType: 'WEEKLY' });
  assert.match(html, /&lt;script&gt;/); assert.ok(!html.includes('<script>'));
});
test('unknown labs and oversized reports stop before rendering', async () => {
  await assert.rejects(generateLabChartPdf(fixture(), { ...filters, lab: 'missing' }), /available computer/);
  const db = fixture(); db.labSchedule.findMany = async () => Array(1001).fill({});
  await assert.rejects(generateLabChartPdf(db, filters), /1000 records/);
});
