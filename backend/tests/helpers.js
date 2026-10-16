require('../scripts/test-environment.cjs').assertManagedTest();
const BASE_URL = process.env.TEST_API_URL;

async function apiRequest(method, path, body, token) {
  // Normal UI writes include the version the client read. Dedicated stale/missing
  // version tests use raw fetch or explicitly supply expectedUpdatedAt.
  const match = path.match(/^\/borrow-requests\/([^/?]+)(?:\/(approve|borrow|reject))?$/) || path.match(/^\/lab-schedules\/approve-request\/([^/?]+)$/);
  if (match && ['PATCH','PUT'].includes(method.toUpperCase()) && !Object.prototype.hasOwnProperty.call(body || {}, 'expectedUpdatedAt')) {
    const {prisma} = require('../dist/db/prisma');
    const current = await prisma.borrowRequest.findUnique({where:{id:match[1]},select:{updatedAt:true}});
    body = {...body, expectedUpdatedAt:current?.updatedAt.toISOString() ?? new Date(0).toISOString()};
  }
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function loginAs(email, password = 'SmartLab123!') {
  const { data } = await apiRequest('POST', '/auth/login', { email, password });
  if (!data.token) throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  return data.token;
}

async function getAdminToken() {
  return loginAs('admin@smartlab.local');
}

async function getStudentToken() {
  return loginAs('paolo.santos@smartlab.local');
}

async function getFacultyToken() {
  return loginAs('jane.delacruz@smartlab.local');
}

module.exports = { apiRequest, loginAs, getAdminToken, getStudentToken, getFacultyToken, BASE_URL };
