const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
(async () => {
  const url = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
  assert.ok(['localhost','127.0.0.1'].includes(url.hostname) && url.pathname === '/smartlab_test');
  const schema = 'smartlab_legacy_guard_' + crypto.randomBytes(8).toString('hex');
  url.searchParams.set('schema', schema);
  const db = new PrismaClient({ datasources: { db: { url: url.href } } });
  try {
    await db.$executeRawUnsafe('CREATE SCHEMA "' + schema + '"');
    await db.$executeRawUnsafe("CREATE TYPE \"BorrowRequestType\" AS ENUM ('LEGACY','LABORATORY','EQUIPMENT')");
    await db.$executeRawUnsafe("CREATE TABLE borrow_requests (id text PRIMARY KEY, \"requestType\" \"BorrowRequestType\" NOT NULL DEFAULT 'LEGACY')");
    await db.$executeRawUnsafe("INSERT INTO borrow_requests VALUES ('old','LEGACY'),('lab','LABORATORY'),('item','EQUIPMENT')");
    const run = () => spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'execute', '--file', 'prisma/migrations/20261010010000_remove_legacy_requests/migration.sql', '--schema', 'prisma/schema.prisma'], { cwd: path.join(__dirname,'..'), env: {...process.env, DATABASE_URL:url.href}, encoding:'utf8', windowsHide:true });
    const blocked = run();
    assert.notEqual(blocked.status, 0);
    assert.match(blocked.stderr + blocked.stdout, /legacy requests still exist/);
    assert.equal(Number((await db.$queryRawUnsafe('SELECT count(*) FROM borrow_requests'))[0].count), 3);
    await db.$executeRawUnsafe("DELETE FROM borrow_requests WHERE id='old'");
    const applied = run(); assert.equal(applied.status, 0, applied.stderr);
    assert.deepEqual(await db.$queryRawUnsafe('SELECT id, "requestType"::text AS type FROM borrow_requests ORDER BY id'), [{id:'item',type:'EQUIPMENT'},{id:'lab',type:'LABORATORY'}]);
    await assert.rejects(db.$executeRawUnsafe("INSERT INTO borrow_requests(id) VALUES ('missing')"));
    await assert.rejects(db.$executeRawUnsafe("INSERT INTO borrow_requests VALUES ('invalid','LEGACY')"));
    console.log('PASS: legacy rows block migration without data loss; explicit requests preserved; LEGACY and missing types rejected.');
  } finally {
    await db.$executeRawUnsafe('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');
    await db.$disconnect();
  }
})().catch(error => { console.error(error); process.exitCode=1; });
