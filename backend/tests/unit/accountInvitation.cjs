// Database-free tests: replace the only Prisma read before invoking the service.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../../dist/db/prisma');
const transport = require('../../dist/services/email/transporter');
const service = require('../../dist/services/accountInvitationService');
const original = prisma.accountInvitation.findUnique;
const configured = transport.emailDeliveryConfigured;
const env = { ...process.env };
const token = 'a'.repeat(64);
let row;
prisma.accountInvitation.findUnique = async () => row;
function valid() { return { invitedEmail: 'person@example.com', expiresAt: new Date(Date.now() + 60000), usedAt: null, revokedAt: null, user: { activationState: 'PENDING', status: 'DEACTIVATED', email: 'person@example.com' } }; }
after(async () => { prisma.accountInvitation.findUnique = original; transport.emailDeliveryConfigured = configured; process.env = env; await prisma.$disconnect(); });
test('normalizes email and rejects invalid addresses', () => {
  assert.equal(service.normalizeInvitationEmail(' User@Example.COM '), 'user@example.com');
  for (const email of [null, '', 'bad', 'x<script>@example.com']) assert.throws(() => service.normalizeInvitationEmail(email));
});
test('requires configured email and HTTPS production origin', () => {
  process.env.EMAIL_DELIVERY_ENABLED = 'false'; assert.throws(() => service.invitationOrigin());
  process.env.EMAIL_DELIVERY_ENABLED = 'true'; transport.emailDeliveryConfigured = () => true; process.env.NODE_ENV = 'production';
  for (const origin of ['', 'invalid', 'http://example.com', 'file:///tmp']) { process.env.FRONTEND_URL = origin; assert.throws(() => service.invitationOrigin()); }
  process.env.FRONTEND_URL = 'https://smartlab.example.com/'; assert.equal(service.invitationOrigin(), 'https://smartlab.example.com');
});
test('valid inspection exposes only masked email', async () => { row = valid(); assert.deepEqual(await service.inspectInvitation(token), { email: 'p***@example.com' }); });
test('rejects malformed tokens', async () => { for (const value of [null, '', 'a'.repeat(63), 'z'.repeat(64)]) await assert.rejects(service.inspectInvitation(value)); });
for (const state of ['used', 'revoked', 'expired', 'cancelled', 'complete', 'emailChanged', 'statusChanged', 'missing']) test('rejects ' + state + ' invitation', async () => {
  row = valid();
  if (state === 'used') row.usedAt = new Date();
  if (state === 'revoked') row.revokedAt = new Date();
  if (state === 'expired') row.expiresAt = new Date(0);
  if (state === 'cancelled') row.user.activationState = 'CANCELLED';
  if (state === 'complete') row.user.activationState = 'COMPLETE';
  if (state === 'emailChanged') row.user.email = 'other@example.com';
  if (state === 'statusChanged') row.user.status = 'ACTIVE';
  if (state === 'missing') row = null;
  await assert.rejects(service.inspectInvitation(token), { statusCode: 400 });
});
test('rejects weak, oversized, and mismatched passwords before touching the database', async () => {
  prisma.accountInvitation.findUnique = async () => { throw Error('Unexpected database access'); };
  for (const [password, confirm] of [['short','short'], ['x'.repeat(73),'x'.repeat(73)], ['Valid123!', 'different']]) await assert.rejects(service.acceptInvitation(token, password, confirm), { statusCode: 400 });
});
