const express = require('express');
const { createRequestLimiter } = require('../dist/middleware/requestLimiter');
const { validNewPassword } = require('../dist/utils/passwordPolicy');
jest.mock('../dist/db/prisma', () => ({ prisma: { user: { findUnique: jest.fn(), update: jest.fn() } } }));
jest.mock('../dist/middleware/auth', () => ({
  authenticateToken: (req, res, next) => { req.user = { id: 'student', role: 'STUDENT' }; next(); },
  authorizeRoles: () => (_req, res) => res.sendStatus(403),
}));
const { prisma } = require('../dist/db/prisma');
let server, base, time = 100000;
beforeAll(async () => {
  const app = express(); app.use(express.json());
  app.use('/users', require('../dist/routes/users').default);
  // Controlled fixture identities: production uses authenticateToken, not this header.
  app.use('/limited', (req, res, next) => { req.user = { id: req.headers['test-user'] || 'a' }; next(); }, createRequestLimiter(2, 60000, () => time));
  app.get('/limited', (req, res) => res.json({ ok: true }));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = 'http://127.0.0.1:' + server.address().port;
});
afterAll(() => new Promise(resolve => server.close(resolve)));
test('limits reserve concurrent requests and ignore spoofed forwarding headers', async () => {
  const replies = await Promise.all([1,2,3,4].map(n => fetch(base + '/limited', { headers: { 'X-Forwarded-For': '192.0.2.' + n } })));
  expect(replies.filter(r => r.status === 200)).toHaveLength(2);
  expect(replies.filter(r => r.status === 429)).toHaveLength(2);
  expect(replies.find(r => r.status === 429).headers.get('retry-after')).toBe('60');
  expect((await fetch(base + '/limited', { headers: { 'test-user': 'b' } })).status).toBe(200);
  time += 60000;
  expect((await fetch(base + '/limited')).status).toBe(200);
});
test('non-admin cannot change email through either API alias', async () => {
  prisma.user.findUnique.mockResolvedValue({ id: 'student', email: 'old@example.com', firstName: 'A', lastName: 'B', role: 'STUDENT' });
  for (const field of ['email', 'gmail']) {
    const result = await fetch(base + '/users/student', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: 'attacker@example.com' }) });
    expect(result.status).toBe(403);
  }
  expect(prisma.user.update).not.toHaveBeenCalled();
});
test('password limit counts UTF-8 bytes and rejects non-strings', () => {
  expect(validNewPassword('a'.repeat(72))).toBe(true);
  expect(validNewPassword('a'.repeat(73))).toBe(false);
  expect(validNewPassword('é'.repeat(36))).toBe(true);
  expect(validNewPassword('é'.repeat(37))).toBe(false);
  for (const value of ['short', null, 123, {}]) expect(validNewPassword(value)).toBe(false);
});
