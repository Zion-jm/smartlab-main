const assert = require('node:assert/strict');
function validateTestDatabase(value) {
  let url; try { url = new URL(value); } catch { throw Error('Set TEST_DATABASE_URL to local PostgreSQL smartlab_test'); }
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol), 'PostgreSQL required');
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname), 'Only a loopback test database is allowed');
  assert.equal(url.pathname, '/smartlab_test', 'Database must be named smartlab_test');
  assert.ok(!url.searchParams.has('schema'), 'Runner owns schema selection; remove schema from TEST_DATABASE_URL');
  return url;
}
function assertManagedTest(env = process.env) {
  const db = new URL(env.DATABASE_URL || 'invalid');
  const schema = db.searchParams.get('schema');
  assert.match(schema || '', /^smartlab_test_run_[0-9]+_[a-f0-9]{16}$/, 'Use npm run test:regression');
  assert.equal(schema, env.SMARTLAB_TEST_SCHEMA, 'Test schema mismatch');
  db.searchParams.delete('schema'); validateTestDatabase(db.href);
  const api = new URL(env.TEST_API_URL || 'invalid');
  assert.ok(['localhost', '127.0.0.1'].includes(api.hostname) && api.pathname === '/api', 'Explicit local TEST_API_URL required');
  assert.notEqual(env.NODE_ENV, 'production', 'Production test execution forbidden');
}
module.exports = { validateTestDatabase, assertManagedTest };
