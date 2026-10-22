const { assertLocalTestEnvironment, cleanupFixtures } = require('./support/localFixtureCleanup');
const { apiRequest, getAdminToken, getFacultyToken } = require('./helpers');
const { prisma } = require('../dist/db/prisma');
const jwt = require('jsonwebtoken');
const ids = [];
let admin, faculty;
const password = 'Invitation123!';
async function create() {
  const email = `invite_${Date.now()}_${Math.random().toString(16).slice(2)}@smartlab.local`;
  const result = await apiRequest('POST', '/users', { first_name: 'Invitation', last_name: 'Regression', gmail: email, role_id: 1 }, admin);
  if (result.data.user?.user_id) ids.push(result.data.user.user_id);
  expect(result.status).toBe(201);
  return { id: result.data.user.user_id, email };
}
async function latest(id) {
  const row = await prisma.accountInvitation.findFirst({ where: { userId: id }, orderBy: { createdAt: 'desc' } });
  const mail = await prisma.emailOutbox.findUnique({ where: { eventKey: 'invitation:' + row.id } });
  return { row, token: mail.text.match(/token=([a-f0-9]{64})/)[1] };
}
const accept = (token, supplied = password, confirm = supplied) => apiRequest('POST', '/auth/invitations/accept', { token, password: supplied, confirmPassword: confirm });
async function age(id) { await prisma.accountInvitation.updateMany({ where: { userId: id }, data: { createdAt: new Date(Date.now() - 61000) } }); }
beforeAll(async () => { assertLocalTestEnvironment(); admin = await getAdminToken(); faculty = await getFacultyToken(); });
afterAll(async () => { await cleanupFixtures({ userIds: ids }); await prisma.$disconnect(); });
test('pending accounts cannot log in, use a signed session, change status, or use retirement to bypass invitations', async () => {
  const user = await create();
  expect((await apiRequest('POST', '/auth/login', { email: user.email, password })).status).toBe(401);
  const forged = jwt.sign({ userId: user.id, role: 'ADMIN', sessionVersion: 0 }, process.env.JWT_SECRET);
  expect((await apiRequest('GET', '/auth/me', null, forged)).status).toBe(401);
  expect((await apiRequest('PATCH', `/users/${user.id}/status`, { status: 'ACTIVE', status_id: 1 }, admin)).status).toBeGreaterThanOrEqual(400);
  expect((await apiRequest('POST', `/users/${user.id}/retire`, {}, admin)).status).toBe(409);
  await apiRequest('POST', '/auth/forgot-password', { email: user.email });
  expect(await prisma.passwordReset.count({ where: { userId: user.id } })).toBe(0);
  expect((await apiRequest('POST', `/users/${user.id}/invitation/cancel`, {}, faculty)).status).toBe(403);
});
test('validation preserves the link, concurrent completion succeeds once, and replay is rejected', async () => {
  const user = await create(), { token } = await latest(user.id);
  expect((await accept(token, 'short')).status).toBe(400);
  expect((await accept(token, password, 'different')).status).toBe(400);
  const results = await Promise.all([accept(token), accept(token)]);
  expect(results.map(r => r.status).sort()).toEqual([200, 400]);
  expect(results.find(r => r.status === 200).data.token).toBeUndefined();
  expect((await accept(token)).status).toBe(400);
  const saved = await prisma.user.findUnique({ where: { id: user.id } });
  expect(saved.activationState).toBe('COMPLETE'); expect(saved.status).toBe('ACTIVE');
  expect(saved.emailVerifiedAt).not.toBeNull(); expect(saved.activatedAt).not.toBeNull();
  expect((await apiRequest('POST', '/auth/login', { email: user.email, password })).status).toBe(200);
  const mail = await prisma.emailOutbox.findMany({ where: { recipient: user.email } });
  expect(mail.every(item => !item.text.includes(token) && !item.html.includes(token))).toBe(true);
});
test('resend throttles, rotates links, and correction requires the new email link', async () => {
  const user = await create(), first = await latest(user.id);
  expect((await apiRequest('POST', `/users/${user.id}/invitation/resend`, {}, admin)).status).toBe(429);
  await age(user.id);
  expect((await apiRequest('POST', `/users/${user.id}/invitation/resend`, {}, admin)).status).toBe(200);
  expect((await accept(first.token)).status).toBe(400);
  const second = await latest(user.id); await age(user.id);
  const email = 'corrected_' + user.email;
  expect((await apiRequest('POST', `/users/${user.id}/invitation/email`, { email }, admin)).status).toBe(200);
  expect((await accept(second.token)).status).toBe(400);
  expect((await accept((await latest(user.id)).token)).status).toBe(200);
  expect((await apiRequest('POST', '/auth/login', { email, password })).status).toBe(200);
});
test('expired and cancelled links cannot activate an account', async () => {
  const expired = await create(), first = await latest(expired.id);
  await prisma.accountInvitation.update({ where: { id: first.row.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  expect((await accept(first.token)).status).toBe(400);
  const cancelled = await create(), second = await latest(cancelled.id);
  expect((await apiRequest('POST', `/users/${cancelled.id}/invitation/cancel`, {}, admin)).status).toBe(200);
  expect((await accept(second.token)).status).toBe(400);
  expect((await prisma.user.findUnique({ where: { id: cancelled.id } })).activationState).toBe('CANCELLED');
  await age(cancelled.id);
  expect((await apiRequest('POST', `/users/${cancelled.id}/invitation/reinvite`, {}, admin)).status).toBe(200);
  expect((await accept(second.token)).status).toBe(400);
  expect((await accept((await latest(cancelled.id)).token)).status).toBe(200);
});
