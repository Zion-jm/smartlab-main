// Offline route checks: no database writes and no email delivery.
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { prisma } = require('../dist/db/prisma');
const { accountStatusChanged } = require('../dist/services/accountReactivationService');
const router = require('../dist/routes/auth').default;
const handler = router.stack.find(x => x.route?.path === '/reactivation').route.stack[0].handle;
(async () => {
  let pending = false, active = false, notifications = 0, emails = 0;
  const user = { id: 'sample', email: 'sample@example.invalid', firstName: 'Test', lastName: 'Student', role: 'STUDENT', sessionVersion: 1, passwordHash: await bcrypt.hash('sample-password', 4), studentProfile: { program: { code: 'BSIT' }, yearLevel: 4 } };
  prisma.user.findUnique = async () => user;
  const tx = {
    $queryRaw: async () => [{ status: active ? 'ACTIVE' : 'DEACTIVATED', sessionVersion: 1 }],
    $executeRaw: async (parts) => { const sql = parts.join(''); if (sql.includes('INSERT INTO "ReactivationRequest"')) { if (pending) return 0; pending = true; return 1; } if (sql.includes('INSERT INTO "EmailOutbox"')) emails++; return 1; },
    user: { findMany: async () => [{ id: 'admin', email: 'admin@example.invalid' }] },
    notification: { create: async ({ data }) => { assert.match(data.message, /BSIT - 4/); notifications++; } },
    auditLog: { create: async () => ({}) },
  };
  prisma.$transaction = async fn => fn(tx);
  async function submit(password = 'sample-password') { let status = 200, data; await handler({ body: { email: user.email, password, reason: 'Need class access' } }, { status(n) { status = n; return this; }, json(v) { data = v; return this; } }); return { status, data }; }
  assert.equal((await submit('wrong')).status, 401);
  assert.equal((await submit()).status, 201);
  assert.equal((await submit()).status, 200);
  assert.equal(notifications, 1); assert.equal(emails, 1);
  active = true; assert.equal((await submit()).status, 409);
  await accountStatusChanged(tx, { ...user, status: 'ACTIVE', updatedAt: new Date() }, 'DEACTIVATED');
  assert.equal(emails, 2);
  await accountStatusChanged(tx, { ...user, status: 'ACTIVE', updatedAt: new Date() }, 'ACTIVE');
  assert.equal(emails, 2);
  console.log('Passed: credentials, appeal deduplication, admin alerts, active-account rejection, status emails, unchanged-status suppression.');
})().catch(err => { console.error(err); process.exitCode = 1; });
