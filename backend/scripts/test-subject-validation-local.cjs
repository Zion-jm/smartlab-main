const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
async function main() {
  const url = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
  assert(['localhost','127.0.0.1'].includes(url.hostname), 'Local PostgreSQL only');
  assert.notEqual(process.env.NODE_ENV, 'production');
  url.pathname = '/smartlab_test';
  const schema = 'smartlab_test_run_' + Date.now() + '_' + crypto.randomBytes(8).toString('hex');
  url.searchParams.set('schema', schema);
  process.env.DATABASE_URL = url.href;
  process.env.NODE_ENV = 'test';
  process.env.EMAIL_DELIVERY_ENABLED = 'false';
  const db = new PrismaClient({datasources:{db:{url:url.href}}});
  const { resolveRequestIntent } = require('../dist/services/requestTypePolicy');
  const { approveRequest } = require('../dist/services/approvalService');
  const { changeLoanStatus } = require('../dist/services/inventoryMovementService');
  const { inventoryTransaction } = require('../dist/services/inventoryTransaction');
  const { cancelBorrowRequest } = require('../dist/services/cancelBorrowRequestService');
  const { summarizeRequest, borrowRequestInclude } = require('../dist/services/borrowRequestService');
  try {
    await db.$connect();
    const migrate = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { env: process.env, encoding:'utf8', windowsHide:true });
    assert.equal(migrate.status, 0, 'Isolated migrations must apply successfully');
    const {normalizeSubjectText,validateSubject}=require('../dist/services/subjectValidation');
    assert.equal(normalizeSubjectText('  Art   Appreciation  '),'Art Appreciation');
    assert.equal(normalizeSubjectText(42),'');
    const first=await db.subject.create({data:{code:'ART 101',name:'Art Appreciation'}});
    await validateSubject(db,'ART 101','Art Appreciation',first.id);
    await assert.rejects(validateSubject(db,'art 101','Another name'),{statusCode:409,message:'This subject code already exists.'});
    await assert.rejects(validateSubject(db,'NEW','art appreciation'),{statusCode:409,message:'This subject name already exists.'});
    await assert.rejects(validateSubject(db,'','Name'),{statusCode:400});
    await assert.rejects(db.subject.create({data:{code:' art   101 ',name:'Other'}}),{code:'P2002'});
    await assert.rejects(db.subject.create({data:{code:'OTHER',name:' art   appreciation '}}),{code:'P2002'});
    const second=await db.subject.create({data:{code:'NEW',name:'New subject'}});
    await assert.rejects(validateSubject(db,'NEW','Art Appreciation',second.id),{statusCode:409});
    await assert.rejects(db.subject.update({where:{id:second.id},data:{name:'ART APPRECIATION'}}),{code:'P2002'});
    const race=await Promise.allSettled(['Concurrent name',' concurrent  NAME '].map((name,i)=>db.subject.create({data:{code:'RACE'+i,name}})));
    assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
    console.log('PASS: subject normalization, required fields, independent code/name duplicates, unchanged edits, conflicting edits, SQL whitespace/case uniqueness and concurrent inserts.');
  } finally {
    await db.$executeRawUnsafe('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');
    await db.$disconnect();
  }
}
main().catch(error=>{ console.error('Subject tests failed:',error.code || error.name, error instanceof assert.AssertionError ? error.message : 'Check local smartlab_test availability.'); process.exitCode=1; });
