const mockActors = {};
jest.mock('../dist/middleware/auth', () => ({
  authenticateToken: (req, res, next) => { req.user = mockActors[req.headers['x-test-role'] || 'FACULTY']; next(); },
  authorizeRoles: (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.sendStatus(403),
}));
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const express = require('express');
const notifications = require('../dist/services/notificationService');
const outbox = require('../dist/services/email/outbox');
let db, server, base, faculty, admin, profile, year, term;
const equipmentIds = [];
const tag = 'reliability-' + randomUUID();
beforeAll(async () => {
  db = new PrismaClient();
  faculty = await db.user.create({ data: { email: tag + '@test.local', firstName: 'Test', lastName: 'Faculty', role: 'FACULTY', passwordHash: 'unused' } });
  admin = await db.user.create({ data: { email: tag + '-admin@test.local', firstName: 'Test', lastName: 'Admin', role: 'ADMIN', passwordHash: 'unused' } });
  mockActors.FACULTY = faculty; mockActors.ADMIN = admin;
  profile = await db.facultyProfile.create({ data: { userId: faculty.id } });
  year = await db.academicYear.findFirstOrThrow({ where: { isActive: true } });
  term = await db.term.findFirstOrThrow({ where: { isActive: true } });
  const app = express(); app.use(express.json()); app.use('/requests', require('../dist/routes/borrowRequests').default);
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = 'http://127.0.0.1:' + server.address().port + '/requests';
});
afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
  const requests = await db.borrowRequest.findMany({ where: { requestedBy: faculty.id }, select: { id: true } });
  for (const { id } of requests) await db.emailOutbox.deleteMany({ where: { eventKey: { startsWith: id + ':' } } });
  await db.auditLog.deleteMany({ where: { actorUserId: { in: [faculty.id, admin.id] } } });
  await db.borrowRequest.deleteMany({ where: { requestedBy: faculty.id } });
  await db.equipment.deleteMany({ where: { id: { in: equipmentIds } } });
  await db.user.deleteMany({ where: { id: { in: [faculty.id, admin.id] } } });
  await db.$disconnect();
});
async function payload() {
  const e = await db.equipment.create({ data: { name: tag + randomUUID(), totalQuantity: 4, availableQuantity: 4 } });
  equipmentIds.push(e.id);
  return { submissionKey: randomUUID(), requestType: 'EQUIPMENT', usageLocation: 'Test room', facultyId: profile.id, purpose: 'Test', academicYearId: year.id, termId: term.id, dateNeeded: '2035-06-12', timeStart: '2035-06-12T09:00:00+08:00', timeEnd: '2035-06-12T10:00:00+08:00', items: [{ equipmentId: e.id, quantity: 2 }] };
}
async function call(body, path = '', role = 'FACULTY') {
  const r = await fetch(base + path, { method: path ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json', 'x-test-role': role }, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json() };
}
test('simultaneous retries return one request with one audit and one set of notifications', async () => {
  const p = await payload(); const results = await Promise.all([call(p), call(p)]);
  for (const r of results) expect([200, 201]).toContain(r.status);
  const id = results[0].data.request.id; expect(results[1].data.request.id).toBe(id);
  expect(await db.borrowRequest.count({ where: { requestedBy: faculty.id, submissionKey: p.submissionKey } })).toBe(1);
  expect(await db.auditLog.count({ where: { entityId: id, action: 'CREATE' } })).toBe(1);
  expect(await db.notification.count({ where: { borrowRequestId: id, userId: admin.id } })).toBe(1);
  expect(await db.emailOutbox.count({ where: { eventKey: id + ':submitted:' + faculty.email } })).toBe(1);
  expect((await call({ ...p, purpose: 'Changed details' })).status).toBe(409);
  expect((await call(p)).data.request.id).toBe(id);
});
test.each([true, false])('simultaneous business duplicates have one winner (keys=%s)', async keys => {
  const p = await payload(); const q = { ...p, submissionKey: randomUUID() };
  if (!keys) { delete p.submissionKey; delete q.submissionKey; }
  const results = await Promise.all([call(p), call(q)]);
  expect(results.map(r => r.status).sort()).toEqual([201, 409]);
});
test.each(['notification', 'outbox'])('failed %s write rolls back creation and permits a clean retry', async target => {
  const p = await payload();
  const spy = target === 'notification' ? jest.spyOn(notifications, 'notifyAdminsInTransaction').mockRejectedValueOnce(Error('notification unavailable')) : jest.spyOn(outbox, 'enqueueEmail').mockRejectedValueOnce(Error('queue unavailable'));
  try { expect((await call(p)).status).toBe(500); } finally { spy.mockRestore(); }
  expect(await db.borrowRequest.count({ where: { submissionKey: p.submissionKey } })).toBe(0);
  expect((await call(p)).status).toBe(201);
});
test('approval notification failure rolls back approval, audit and email; retry commits all', async () => {
  const created = await call(await payload()); expect(created.status).toBe(201); const id = created.data.request.id;
  const spy = jest.spyOn(notifications, 'notifyUserInTransaction').mockRejectedValueOnce(Error('notification unavailable'));
  try { expect((await call({}, '/' + id + '/approve', 'ADMIN')).status).toBe(500); } finally { spy.mockRestore(); }
  expect((await db.borrowRequest.findUnique({ where: { id } })).status).toBe('PENDING');
  expect(await db.emailOutbox.count({ where: { eventKey: id + ':approved:' + faculty.email } })).toBe(0);
  expect(await db.auditLog.count({ where: { entityId: id, action: 'APPROVE' } })).toBe(0);
  expect((await call({}, '/' + id + '/approve', 'ADMIN')).status).toBe(200);
  expect(await db.emailOutbox.count({ where: { eventKey: id + ':approved:' + faculty.email } })).toBe(1);
  expect(await db.notification.count({ where: { borrowRequestId: id, userId: faculty.id, type: 'REQUEST_APPROVED' } })).toBe(1);
});
test('return notification failure rolls back stock, counters, history and email together', async () => {
  const p = await payload(); const created = await call(p); const id = created.data.request.id;
  await db.borrowRequest.update({ where: { id }, data: { status: 'BORROWED' } });
  await db.equipment.update({ where: { id: p.items[0].equipmentId }, data: { availableQuantity: 2, borrowedQuantity: 2 } });
  const spy = jest.spyOn(notifications, 'notifyUserInTransaction').mockRejectedValueOnce(Error('notification unavailable'));
  try { expect((await call({}, '/' + id + '/return', 'ADMIN')).status).toBe(500); } finally { spy.mockRestore(); }
  expect((await db.borrowRequest.findUnique({ where: { id } })).status).toBe('BORROWED');
  expect(await db.equipment.findUnique({ where: { id: p.items[0].equipmentId } })).toMatchObject({ availableQuantity: 2, borrowedQuantity: 2 });
  expect(await db.equipmentReturn.count({ where: { borrowRequestId: id } })).toBe(0);
  expect(await db.emailOutbox.count({ where: { eventKey: id + ':returned:' + faculty.email } })).toBe(0);
  expect((await call({}, '/' + id + '/return', 'ADMIN')).status).toBe(200);
  expect(await db.emailOutbox.count({ where: { eventKey: id + ':returned:' + faculty.email } })).toBe(1);
});
test.each(['reject', 'cancel'])('%s commits its notice and queued email with the state change', async action => {
  const created = await call(await payload()); const id = created.data.request.id;
  expect((await call({ reason: 'Test decline' }, '/' + id + '/' + action, 'ADMIN')).status).toBe(200);
  expect(await db.notification.count({ where: { borrowRequestId: id, userId: faculty.id } })).toBe(1);
  expect(await db.emailOutbox.count({ where: { eventKey: id + ':' + (action === 'reject' ? 'declined' : 'cancelled') + ':' + faculty.email } })).toBe(1);
});
test('room-only retries remain idempotent without equipment duplicate checks', async () => {
  const room = await db.room.create({ data: { name: tag + '-room', isComputerLab: true } });
  try {
    const p = { ...await payload(), requestType: 'LABORATORY', roomId: room.id, items: [] };
    const results = await Promise.all([call(p), call(p)]);
    for (const r of results) expect([200, 201]).toContain(r.status);
    expect(results[0].data.request.id).toBe(results[1].data.request.id);
  } finally { await db.room.delete({ where: { id: room.id } }); }
});
