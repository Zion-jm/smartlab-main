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
    const {saveDirectory,directoryText}=require('../dist/services/directoryValidation');
    const actor=await db.user.create({data:{email:'directory@test.invalid',firstName:'Test',lastName:'Admin',passwordHash:'test',role:'ADMIN'}});
    const save=(kind,data,id)=>saveDirectory(db,kind,data,actor.id,id);
    assert.equal(directoryText('  Niño   Hall ', 'Name',150),'Niño Hall');
    assert.throws(()=>directoryText(42,'Name',150),{statusCode:400});
    assert.throws(()=>directoryText('x'.repeat(151),'Name',150),{statusCode:400});
    for(const kind of ['buildings','departments','programs','subjects']) {
      const original=await save(kind,{name:kind+' name',code:'CODE'});
      await save(kind,{name:kind+' name',code:'CODE'},original.id);
      await assert.rejects(save(kind,{name:'  '+kind.toUpperCase()+'   NAME ',code:'OTHER'}),{statusCode:409});
      await assert.rejects(save(kind,{name:'  ',code:'OTHER'}),{statusCode:400});
      if(['programs','subjects'].includes(kind))await assert.rejects(save(kind,{name:'Different',code:' code '}),{statusCode:409});
      const race=await Promise.allSettled([0,1].map(i=>save(kind,{name:kind+' race',code:'RACE'+i})));
      assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
    }
    const b1=await save('buildings',{name:'Building one'}),b2=await save('buildings',{name:'Building two'});
    const roomData={roomNumber:'A-101',isComputerLab:false,buildingId:b1.id};
    const room=await save('rooms',roomData);await save('rooms',roomData,room.id);
    await assert.rejects(save('rooms',{...roomData,roomNumber:' a-101 '}),{statusCode:409});
    await save('rooms',{...roomData,buildingId:b2.id});
    await save('rooms',{roomName:'Science Lab',buildingId:b1.id,isComputerLab:false});
    await assert.rejects(save('rooms',{roomName:' science  LAB ',buildingId:b1.id,isComputerLab:false}),{statusCode:409});
    await save('rooms',{...roomData,buildingId:null});
    assert.equal((await save('rooms',{...roomData,buildingId:null})).warnings.length,1);
    await assert.rejects(save('rooms',{isComputerLab:false}),{statusCode:400});
    await assert.rejects(save('rooms',{...roomData,isComputerLab:'false'}),{statusCode:400});
    await assert.rejects(save('rooms',{...roomData,buildingId:'missing'}),{statusCode:400});
    const lab=await save('rooms',{roomName:'Lab',isComputerLab:true});
    const year=await db.academicYear.create({data:{year:'2035',isActive:true}}),term=await db.term.create({data:{name:'Term',isActive:true}});
    const faculty=await db.facultyProfile.create({data:{userId:actor.id}});
    await db.labSchedule.create({data:{roomId:lab.id,facultyId:faculty.id,academicYearId:year.id,termId:term.id,createdBy:actor.id,dayOfWeek:1,scheduleType:'WEEKLY',timeStart:new Date(),timeEnd:new Date()}});
    await assert.rejects(save('rooms',{roomName:'Lab',isComputerLab:false},lab.id),{statusCode:409});
    assert.equal((await db.room.findUnique({where:{id:lab.id}})).isComputerLab,true);
    const audit=await db.auditLog.findFirst({where:{entityId:room.id,action:'UPDATE'}});
    assert(audit.details.before && audit.details.after);
    console.log('PASS: all directory entities, duplicates, edits, lengths, data types, room combinations, optional buildings, warning-only duplicates, active lab protection, concurrent writes and audits.');
  } finally {
    await db.$executeRawUnsafe('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');
    await db.$disconnect();
  }
}
main().catch(error=>{ console.error('Directory tests failed:',error.code || error.name, error instanceof assert.AssertionError ? error.message : 'Check local smartlab_test availability.'); process.exitCode=1; });
