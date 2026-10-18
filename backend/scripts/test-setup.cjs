// Runs only in a new schema of local smartlab_test. Never sends mail.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { validateTestDatabase } = require('./test-environment.cjs');
let phase = 'configuration';
async function main() {
  const url = validateTestDatabase(process.env.TEST_DATABASE_URL);
  const schema = 'smartlab_test_run_' + Date.now() + '_' + crypto.randomBytes(8).toString('hex');
  url.searchParams.set('schema', schema);
  process.env.DATABASE_URL = url.href;
  process.env.NODE_ENV = 'test';
  process.env.INITIAL_SETUP_TOKEN = crypto.randomBytes(32).toString('hex');
  process.env.FRONTEND_URL = 'https://setup.example.test';
  process.env.EMAIL_PROVIDER = 'brevo';
  process.env.EMAIL_DELIVERY_ENABLED = 'true';
  process.env.BREVO_API_KEY = 'test-only-never-sent';
  process.env.EMAIL_FROM_ADDRESS = 'sender@example.test';
  process.env.SYSTEM_BASELINE_ACADEMIC_YEAR = '2026-2027';
  // Import only services: the mail worker is never started.
  const { prisma } = require('../dist/db/prisma');
  const service = require('../dist/services/installationSetupService');
  const key = process.env.INITIAL_SETUP_TOKEN;
  const candidate = { name:'Setup Tester', email:'setup@example.test', password:'Sample-test-password-123' };
  const input = { year:2026, term:'1st Semester' };
  async function link() {
    const rows = await prisma.$queryRaw`SELECT "text" FROM "EmailOutbox" ORDER BY "createdAt" DESC LIMIT 1`;
    return /#token=([a-f0-9]{64})/.exec(rows[0].text)[1];
  }
  const rejects = (promise, status) => assert.rejects(promise, e => e.statusCode === status);
  try {
    const result = spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy'],{cwd:require('node:path').resolve(__dirname,'..'),env:process.env,stdio:'inherit',windowsHide:true});
    assert.equal(result.status,0,'migration failed');
    phase = 'setup eligibility';
    await rejects(service.setupAccess('wrong'),403);
    await prisma.program.create({data:{code:'EXISTING',name:'Existing installation'}});
    await rejects(service.setupAccess(key),409);
    await prisma.program.deleteMany();
    assert.equal((await service.setupAccess(key)).available,true);
    await rejects(service.beginSetup(key,{...candidate,password:'short'}),400);
    process.env.EMAIL_DELIVERY_ENABLED = 'false';
    await rejects(service.beginSetup(key,candidate),503);
    process.env.EMAIL_DELIVERY_ENABLED = 'true';
    phase = 'begin and email queue';
    let {session} = await service.beginSetup(key,candidate);
    phase = 'verification and resend';
    const oldLink = await link();
    // Explicit UTC conversion keeps timestamp-without-time-zone writes portable.
    await rejects(service.finishSetup(key,session,input),403);
    await rejects(service.resendSetup(key,session),429);
    await prisma.$executeRaw`UPDATE "InstallationSetup" SET "lastSentAt"=(${new Date(Date.now() - 2*60000)}::timestamptz AT TIME ZONE 'UTC')`;
    const clock = await prisma.$queryRaw`SELECT "lastSentAt" FROM "InstallationSetup"`;
    assert.ok(Date.now() - clock[0].lastSentAt.getTime() >= 60000, 'Test cooldown must be elapsed');
    await service.resendSetup(key,session);
    await rejects(service.verifySetupEmail(oldLink),400);
    let token = await link();
    await prisma.$executeRaw`UPDATE "InstallationSetup" SET "verificationExpiresAt"=(${new Date(Date.now() - 60000)}::timestamptz AT TIME ZONE 'UTC')`;
    await rejects(service.verifySetupEmail(token),400);
    await prisma.$executeRaw`UPDATE "InstallationSetup" SET "lastSentAt"=(${new Date(Date.now() - 2*60000)}::timestamptz AT TIME ZONE 'UTC')`;
    ({session} = await service.beginSetup(key,{...candidate,email:'corrected@example.test'}));
    token = await link();
    await service.verifySetupEmail(token);
    await rejects(service.verifySetupEmail(token),400);
    assert.equal((await service.setupProgress(key,session)).verified,true);
    await rejects(service.finishSetup(key,'0'.repeat(64),input),403);
    await rejects(service.finishSetup(key,session,{year:2025,term:'1st Semester'}),400);
    phase = 'transaction rollback';
    // Force the last database write to fail and prove account/period rollback.
    await prisma.$executeRawUnsafe(`CREATE FUNCTION reject_setup_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rollback'; END $$`);
    await prisma.$executeRawUnsafe('CREATE TRIGGER reject_setup_audit BEFORE INSERT ON "audit_logs" FOR EACH ROW EXECUTE FUNCTION reject_setup_audit()');
    await assert.rejects(service.finishSetup(key,session,input));
    assert.equal(await prisma.user.count(),0);
    assert.equal(await prisma.academicYear.count(),1);
    assert.equal(await prisma.academicYear.count({where:{isActive:true}}),0);
    assert.equal(await prisma.term.count(),0);
    await prisma.$executeRawUnsafe('DROP TRIGGER reject_setup_audit ON "audit_logs"');
    phase = 'concurrent completion';
    const finished = await Promise.allSettled([service.finishSetup(key,session,input),service.finishSetup(key,session,input)]);
    assert.equal(finished.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(await prisma.user.count(),1);
    assert.equal(await prisma.academicYear.count({where:{isActive:true}}),1);
    assert.equal(await prisma.term.count({where:{isActive:true}}),1);
    const user = await prisma.user.findFirst();
    assert.equal(user.email,'corrected@example.test');
    assert.equal(await require('bcryptjs').compare(candidate.password,user.passwordHash),true);
    await rejects(service.setupAccess(key),409);
    const state = await prisma.$queryRaw`SELECT * FROM "InstallationSetup"`;
    assert.ok(state[0].completedAt);
    assert.equal(state[0].passwordHash,null);
    assert.equal(state[0].sessionHash,null);
    console.log('PASS setup: authorization, validation, email queue, expiry, resend limits, address correction, one-use link, atomic concurrent completion and permanent closure');
  } finally {
    await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');
    await prisma.$disconnect();
    console.log('Removed isolated setup schema.');
  }
}
main().catch(error=>{console.error('Setup checks failed during: '+phase);console.error('Error type:',error?.name,'Code:',error?.code || error?.statusCode || 'none');console.error('Location:',(error?.stack || '').split('\n').find(line=>line.includes('test-setup.cjs:'))?.trim() || 'unavailable');process.exitCode=1;});
