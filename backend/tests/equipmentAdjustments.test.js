const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { apiRequest, loginAs, BASE_URL } = require('./helpers');

describe('Equipment adjustment authorization and cancellation', () => {
  let prisma, owner, other, admin, ownerToken, otherToken, adminToken, year, term;
  const requests = [], equipment = [], users = [];
  const tag = `adjustment-regression-${Date.now()}`;

  beforeAll(async () => {
    let db, api;
    try { db = new URL(process.env.DATABASE_URL); api = new URL(BASE_URL); }
    catch { throw new Error('Configure a local test database and API.'); }
    if (!['localhost', '127.0.0.1'].includes(db.hostname) || db.pathname !== '/smartlab_test' ||
        !['localhost', '127.0.0.1'].includes(api.hostname)) {
      throw new Error('These fixtures require local smartlab_test and a local API.');
    }
    prisma = new PrismaClient();
    [year, term] = await Promise.all([
      prisma.academicYear.findFirst({ where: { isActive: true } }),
      prisma.term.findFirst({ where: { isActive: true } }),
    ]);
    if (!year || !term) throw new Error('Seed the local test database first.');
    const passwordHash = await bcrypt.hash('RegressionOnly123!', 10);
    for (const [label, role] of [['owner', 'STUDENT'], ['other', 'FACULTY'], ['admin', 'ADMIN']]) {
      users.push(await prisma.user.create({ data: {
        email: `${tag}-${label}@smartlab.local`, passwordHash,
        firstName: 'Adjustment', lastName: label, role, status: 'ACTIVE',
      } }));
    }
    [owner, other, admin] = users;
    [ownerToken, otherToken, adminToken] = await Promise.all(users.map(u => loginAs(u.email, 'RegressionOnly123!')));
  });

  afterAll(async () => {
    if (!prisma) return;
    try {
      await prisma.notification.deleteMany({ where: { userId: { in: users.map(u => u.id) } } });
      await prisma.auditLog.deleteMany({ where: { actorUserId: { in: users.map(u => u.id) } } });
      await prisma.borrowRequest.deleteMany({ where: { id: { in: requests } } });
      await prisma.equipment.deleteMany({ where: { id: { in: equipment } } });
      await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
    } finally { await prisma.$disconnect(); }
  });

  async function fixture({ requestOwner = owner, recipient = requestOwner, status = 'PENDING', notice = {} } = {}) {
    const item = await prisma.equipment.create({ data: {
      name: tag, totalQuantity: 10, availableQuantity: 8, borrowedQuantity: 2,
    } });
    equipment.push(item.id);
    const request = await prisma.borrowRequest.create({ data: {
      requestedBy: requestOwner.id, academicYearId: year.id, termId: term.id,
      dateNeeded: new Date('2035-06-12T00:00:00Z'),
      timeStart: new Date('2035-06-12T02:00:00Z'), timeEnd: new Date('2035-06-12T03:00:00Z'),
      status, items: { create: { equipmentId: item.id, quantity: 2 } },
    } });
    requests.push(request.id);
    const notification = await prisma.notification.create({ data: {
      userId: recipient.id, type: 'SYSTEM_ANNOUNCEMENT', title: 'Equipment Request Adjusted',
      message: 'Test adjustment', referenceType: 'borrow_request', referenceId: request.id,
      borrowRequestId: request.id, ...notice,
    } });
    return { request, notification, item };
  }
  const respond = (f, action, token = ownerToken, extra = {}) =>
    apiRequest('POST', `/equipment-adjustments/${f.notification.id}/respond`, { action, ...extra }, token);
  async function unchanged(f) {
    expect((await prisma.borrowRequest.findUnique({ where: { id: f.request.id } })).status).toBe(f.request.status);
    expect((await prisma.notification.findUnique({ where: { id: f.notification.id } })).isRead).toBe(f.notification.isRead);
    expect(await prisma.equipment.findUnique({ where: { id: f.item.id } })).toMatchObject({ availableQuantity: 8, borrowedQuantity: 2 });
  }

  test('requires authentication', async () => {
    const f = await fixture();
    expect((await respond(f, 'cancel', null)).status).toBe(401);
    await unchanged(f);
  });
  test('rejects another users notification', async () => {
    const f = await fixture();
    expect((await respond(f, 'cancel', otherToken)).status).toBe(403);
    await unchanged(f);
  });
  test.each(['accept', 'modify', 'cancel'])('rejects an unrelated request ID for %s', async action => {
    const f = await fixture();
    const victim = await fixture({ requestOwner: other });
    expect((await respond(f, action, ownerToken, { requestId: victim.request.id })).status).toBe(400);
    await unchanged(f); await unchanged(victim);
  });
  test('checks request ownership even if notification recipient matches', async () => {
    const f = await fixture({ requestOwner: other, recipient: owner });
    expect((await respond(f, 'cancel')).status).toBe(403);
    await unchanged(f);
  });
  test.each([
    { title: 'Request Cancelled' }, { type: 'REQUEST_APPROVED' },
    { referenceType: 'unrelated' }, { referenceId: 'unrelated' },
    { borrowRequestId: null },
  ])('rejects non-adjustment or broken notification links: %j', async notice => {
    const f = await fixture({ notice });
    expect((await respond(f, 'cancel')).status).toBe(400);
    await unchanged(f);
  });
  test('rejects an already-read notification without cancelling', async () => {
    const f = await fixture({ notice: { isRead: true } });
    expect((await respond(f, 'cancel')).status).toBe(409);
    await unchanged(f);
  });
  test.each(['APPROVED', 'BORROWED', 'RETURNED', 'REJECTED', 'CANCELLED'])('rejects all responses for %s requests', async status => {
    const f = await fixture({ status });
    for (const action of ['accept', 'modify', 'cancel']) {
      expect((await respond(f, action)).status).toBe(409);
      await unchanged(f);
    }
  });
  test.each(['accept', 'modify', 'cancel'])('owner can %s a pending adjustment without supplying requestId', async action => {
    const f = await fixture();
    const result = await respond(f, action);
    expect(result.status).toBe(200);
    expect(result.data.data.requestId).toBe(f.request.id);
    expect((await prisma.borrowRequest.findUnique({ where: { id: f.request.id } })).status).toBe(action === 'cancel' ? 'CANCELLED' : 'PENDING');
    expect((await prisma.notification.findUnique({ where: { id: f.notification.id } })).isRead).toBe(true);
    expect(await prisma.equipment.findUnique({ where: { id: f.item.id } })).toMatchObject({ availableQuantity: 8, borrowedQuantity: 2 });
    expect((await respond(f, action)).status).toBe(409);
  });
  test('supports existing clients supplying the correct requestId', async () => {
    const f = await fixture();
    expect((await respond(f, 'accept', ownerToken, { requestId: f.request.id })).status).toBe(200);
  });
  test.each([null, 'invalid', 1])('rejects invalid action %s', async action => {
    const f = await fixture();
    expect((await respond(f, action)).status).toBe(400);
    await unchanged(f);
  });
  test('missing notification returns 404', async () => {
    const result = await apiRequest('POST', '/equipment-adjustments/missing-notice/respond', { action: 'cancel' }, ownerToken);
    expect(result.status).toBe(404);
  });
  test('concurrent accept and cancel consume the notification once', async () => {
    const f = await fixture();
    const results = await Promise.all([respond(f, 'accept'), respond(f, 'cancel')]);
    expect(results.filter(r => r.status === 200)).toHaveLength(1);
    expect(results.every(r => [200, 409].includes(r.status))).toBe(true);
    const winner = results.find(r => r.status === 200).data.data.action;
    expect((await prisma.borrowRequest.findUnique({ where: { id: f.request.id } })).status).toBe(winner === 'cancel' ? 'CANCELLED' : 'PENDING');
    expect(await prisma.equipment.findUnique({ where: { id: f.item.id } })).toMatchObject({ availableQuantity: 8, borrowedQuantity: 2 });
  });
  test('normal cancellation still permits pending owners but rejects other users', async () => {
    const f = await fixture();
    expect((await apiRequest('PATCH', `/borrow-requests/${f.request.id}/cancel`, null, otherToken)).status).toBe(403);
    await unchanged(f);
    expect((await apiRequest('PATCH', `/borrow-requests/${f.request.id}/cancel`, null, ownerToken)).status).toBe(200);
  });
  test('normal cancellation rejects borrowed owners; concurrent admin cancellation restores stock once', async () => {
    const f = await fixture({ status: 'BORROWED' });
    expect((await apiRequest('PATCH', `/borrow-requests/${f.request.id}/cancel`, null, ownerToken)).status).toBe(409);
    await unchanged(f);
    const results = await Promise.all([1, 2].map(() => apiRequest('PATCH', `/borrow-requests/${f.request.id}/cancel`, null, adminToken)));
    expect(results.filter(r => r.status === 200)).toHaveLength(1);
    expect(results.every(r => [200, 400, 409].includes(r.status))).toBe(true);
    expect(await prisma.equipment.findUnique({ where: { id: f.item.id } })).toMatchObject({ availableQuantity: 10, borrowedQuantity: 0 });
  });
  test('inventory inconsistency rolls cancellation back', async () => {
    const f = await fixture({ status: 'BORROWED' });
    await prisma.equipment.update({ where: { id: f.item.id }, data: { borrowedQuantity: 0, availableQuantity: 10 } });
    expect((await apiRequest('PATCH', `/borrow-requests/${f.request.id}/cancel`, null, adminToken)).status).toBe(409);
    expect((await prisma.borrowRequest.findUnique({ where: { id: f.request.id } })).status).toBe('BORROWED');
  });
  test('an actual admin-generated adjustment notice remains actionable', async () => {
    const f = await fixture();
    const source = await prisma.borrowRequest.create({ data: {
      requestedBy: other.id, academicYearId: year.id, termId: term.id,
      dateNeeded: f.request.dateNeeded, timeStart: f.request.timeStart, timeEnd: f.request.timeEnd,
      status: 'APPROVED', items: { create: { equipmentId: f.item.id, quantity: 10 } },
    } });
    requests.push(source.id);
    const adjusted = await apiRequest('POST', '/equipment-adjustments/adjust-equipment', {
      requestId: f.request.id, approvedRequestId: source.id,
    }, adminToken);
    expect(adjusted.status).toBe(200);
    expect(adjusted.data.data.adjusted).toBe(true);
    const accepted = await apiRequest('POST', `/equipment-adjustments/${adjusted.data.data.notification.id}/respond`, {
      action: 'accept', requestId: f.request.id,
    }, ownerToken);
    expect(accepted.status).toBe(200);
  });
});
