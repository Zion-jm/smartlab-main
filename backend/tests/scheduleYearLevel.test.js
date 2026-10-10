const express = require('express');
jest.mock('../dist/middleware/auth', () => ({ authenticateToken: (req, res, next) => { req.user = { id: 'admin', role: 'ADMIN' }; next(); }, authorizeRoles: () => (req, res, next) => next() }));
jest.mock('../dist/db/prisma', () => ({ prisma: {} }));
const router = require('../dist/routes/labSchedules').default;
let server, base;
beforeAll(async () => { const app = express(); app.use(express.json()); app.use(router); server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); base = 'http://127.0.0.1:' + server.address().port; });
afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); });
test.each([undefined, null, '', 0, 5, 1.5])('creation rejects invalid year level %p before accessing the database', async yearLevel => {
 const response = await fetch(base + '/admin/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ yearLevel }) });
 expect(response.status).toBe(400); expect((await response.json()).error).toMatch(/Year level/);
});
test.each([null, '', 0, 5, 1.5])('update rejects explicitly invalid year level %p', async yearLevel => {
 const response = await fetch(base + '/schedule', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ yearLevel }) });
 expect(response.status).toBe(400); expect((await response.json()).error).toMatch(/Year level/);
});
