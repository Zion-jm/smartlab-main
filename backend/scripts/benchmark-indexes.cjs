// Local-only query-plan experiment. Never touches the application's schema.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
require('dotenv').config({path:path.join(__dirname,'../.env')});const {PrismaClient}=require('@prisma/client');
const candidates=[
 ['equipmentItems','borrow_request_items_equipmentId_idx','borrow_request_items','"equipmentId"',`SELECT * FROM borrow_request_items WHERE "equipmentId"='e42'`],
 ['periodRequests','borrow_requests_academicYearId_termId_status_dateNeeded_idx','borrow_requests','"academicYearId", "termId", "status", "dateNeeded"',`SELECT * FROM borrow_requests WHERE "academicYearId"='y3' AND "termId"='t1' AND status='APPROVED' AND "dateNeeded">='2026-03-01' AND "dateNeeded"<'2026-04-01' ORDER BY "dateNeeded",id LIMIT 25`],
 ['personalHistory','borrow_requests_requestedBy_createdAt_idx','borrow_requests','"requestedBy", "createdAt"',`SELECT * FROM borrow_requests WHERE "requestedBy"='u42' AND "academicYearId"='y3' AND "termId"='t1' ORDER BY "createdAt" DESC,id LIMIT 25`],
 ['roomConflicts','lab_schedules_academicYearId_termId_roomId_dayOfWeek_idx','lab_schedules','"academicYearId", "termId", "roomId", "dayOfWeek"',`SELECT * FROM lab_schedules WHERE "academicYearId"='y3' AND "termId"='t1' AND "roomId"='room12'`],
 ['requestSchedules','lab_schedules_borrowRequestId_idx','lab_schedules','"borrowRequestId"',`SELECT * FROM lab_schedules WHERE "borrowRequestId"='r12345'`],
 ['recentNotifications','notifications_userId_createdAt_idx','notifications','"userId", "createdAt"',`SELECT * FROM notifications WHERE "userId"='u42' ORDER BY "createdAt" DESC LIMIT 30`],
 ['actorHistory','audit_logs_actorUserId_createdAt_idx','audit_logs','"actorUserId", "createdAt"',`SELECT * FROM audit_logs WHERE "actorUserId"='u42' ORDER BY "createdAt" DESC LIMIT 25`],
];
const inserts=[
 ['requests',`INSERT INTO borrow_requests (id,"requestedBy","academicYearId","termId","dateNeeded",status,"createdAt","updatedAt") SELECT 'w'||i,'u'||(i%100),'y'||(i%5),'t'||(i%2),timestamp '2026-01-01'+i*interval '1 hour','PENDING',now(),now() FROM generate_series(1,1000) i`],
 ['items',`INSERT INTO borrow_request_items(id,"borrowRequestId","equipmentId",quantity) SELECT 'w'||i,'r'||i,'e'||((i+1)%1000),1 FROM generate_series(1,1000) i`],
 ['schedules',`INSERT INTO lab_schedules(id,"roomId","facultyId","academicYearId","termId","createdBy","dayOfWeek","timeStart","timeEnd","borrowRequestId","updatedAt") SELECT 'w'||i,'room'||(i%100),'f1','y'||(i%5),'t'||(i%2),'u1',i%7,now(),now()+interval '1 hour','r'||i,now() FROM generate_series(1,1000) i`],
 ['notifications',`INSERT INTO notifications(id,"userId",type,title,message) SELECT 'w'||i,'u'||(i%100),'SYSTEM_ANNOUNCEMENT','write','fixture' FROM generate_series(1,1000) i`],
 ['audit',`INSERT INTO audit_logs(id,"actorUserId",action,"entityType","entityId") SELECT 'w'||i,'u'||(i%100),'UPDATE','Equipment','e'||(i%1000) FROM generate_series(1,1000) i`],
 ['requestStatusUpdates',`UPDATE borrow_requests SET status='RETURNED',"updatedAt"=now() WHERE id IN (SELECT 'r'||i FROM generate_series(1,1000) i)`],
 ['notificationReadUpdates',`UPDATE notifications SET "isRead"=true WHERE id IN (SELECT 'n'||i FROM generate_series(1,1000) i)`],
];
async function main(){
 const url=new URL(process.env.DATABASE_URL);if(!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!='/smartlab_test')throw Error('Local smartlab_test required');
 if(!process.env.SMARTLAB_EVIDENCE_DIR)throw Error('Set SMARTLAB_EVIDENCE_DIR');
 const schema='smartlab_plans_'+Date.now()+'_'+crypto.randomBytes(4).toString('hex');if(!/^smartlab_plans_\d+_[a-f0-9]{8}$/.test(schema))throw Error('Invalid schema');
 const owner=new PrismaClient();url.searchParams.set('schema',schema);const db=new PrismaClient({datasources:{db:{url:url.toString()}}});
 const result={generatedAt:new Date().toISOString(),fixture:{requests:100000,items:100000,schedules:50000,notifications:100000,audits:100000,users:100,rooms:100,years:5,terms:2},notes:['Synthetic local workload, not production p95. Warm-cache five-plan medians.','Room conflict query intentionally omits dayOfWeek: actual service filters recurrence in memory.','Write EXPLAIN ANALYZE includes FK checks, each 1000-row operation rolls back, three samples; WAL/cache/bloat make this directional.'],queries:[],writes:{},sizes:{}};
 const sql=q=>db.$executeRawUnsafe(q);
 const plan=async(client,q)=>(await client.$queryRawUnsafe('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+q))[0]['QUERY PLAN'][0];
 const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
 async function plans(){const out=[];for(const c of [...candidates,['substring',null,null,null,`SELECT * FROM equipment WHERE name ILIKE '%scope%' ORDER BY name,id LIMIT 25`]]){const samples=[];for(let i=0;i<5;i++)samples.push(await plan(db,c[4]));out.push({name:c[0],sql:c[4],medianExecutionMs:median(samples.map(x=>x['Execution Time'])),plan:samples[4]})}return out}
 async function writes(){const out={};for(const [name,q]of inserts){const samples=[];for(let i=0;i<3;i++){const marker=Error('rollback measurement');try{await db.$transaction(async tx=>{samples.push(await plan(tx,q));throw marker},{timeout:30000})}catch(e){if(e!==marker)throw e}}out[name]={medianExecutionMs:median(samples.map(p=>p['Execution Time'])),samplesMs:samples.map(p=>p['Execution Time'])}}return out}
 try{
 const run=spawnSync(process.execPath,[path.join(__dirname,'../node_modules/prisma/build/index.js'),'migrate','deploy'],{cwd:path.join(__dirname,'..'),env:{...process.env,DATABASE_URL:url.toString()},encoding:'utf8',windowsHide:true,timeout:60000});if(run.status!==0)throw Error('Isolated migration failed');
 // Re-running after the migration was added still compares the original indexes.
 for(const c of candidates)await sql('DROP INDEX IF EXISTS "'+c[1]+'"');
 await sql('DROP INDEX IF EXISTS "lab_schedules_academicYearId_termId_roomId_idx"');
 await sql(`INSERT INTO academic_years(id,year,"updatedAt") SELECT 'y'||i,'fixture'||i,now() FROM generate_series(0,4)i`);
 await sql(`INSERT INTO terms(id,name,"updatedAt") SELECT 't'||i,'fixture'||i,now() FROM generate_series(0,1)i`);
 await sql(`INSERT INTO users(id,email,"passwordHash","firstName","lastName",role,"updatedAt") SELECT 'u'||i,'fixture'||i||'@invalid','unused','Fixture','User','FACULTY',now() FROM generate_series(0,99)i`);
 await sql(`INSERT INTO faculty_profiles(id,"userId","updatedAt") VALUES ('f1','u1',now())`);
 await sql(`INSERT INTO rooms(id,name,"updatedAt") SELECT 'room'||i,'Room'||i,now() FROM generate_series(0,99)i`);
 await sql(`INSERT INTO equipment(id,name,"totalQuantity","availableQuantity","updatedAt") SELECT 'e'||i,CASE WHEN i%33=0 THEN 'Microscope ' ELSE 'Equipment ' END||i,100,100,now() FROM generate_series(0,999)i`);
 await sql(`INSERT INTO borrow_requests(id,"requestedBy","academicYearId","termId","dateNeeded",status,"purpose","createdAt","updatedAt") SELECT 'r'||i,'u'||(i%100),'y'||((i/100)%5),'t'||((i/500)%2),timestamp '2026-01-01'+((i*37)%365)*interval '1 day',(ARRAY['PENDING','APPROVED','BORROWED','RETURNED','CANCELLED','REJECTED']::"RequestStatus"[])[1+((i/1000)%6)],'Fixture use',timestamp '2025-01-01'+i*interval '5 minutes',now() FROM generate_series(1,100000)i`);
 await sql(`INSERT INTO borrow_request_items(id,"borrowRequestId","equipmentId",quantity) SELECT 'i'||i,'r'||i,'e'||(i%1000),1 FROM generate_series(1,100000)i`);
 await sql(`INSERT INTO lab_schedules(id,"roomId","facultyId","academicYearId","termId","createdBy","dayOfWeek","timeStart","timeEnd","borrowRequestId","updatedAt") SELECT 's'||i,'room'||(i%100),'f1','y'||((i/100)%5),'t'||((i/500)%2),'u1',i%7,timestamp '2026-01-01 01:00',timestamp '2026-01-01 02:00','r'||i,now() FROM generate_series(1,50000)i`);
 await sql(`INSERT INTO notifications(id,"userId",type,title,message,"createdAt") SELECT 'n'||i,'u'||(i%100),'SYSTEM_ANNOUNCEMENT','Fixture','Message',timestamp '2025-01-01'+i*interval '5 minutes' FROM generate_series(1,100000)i`);
 await sql(`INSERT INTO audit_logs(id,"actorUserId",action,"entityType","entityId","createdAt") SELECT 'a'||i,'u'||(i%100),'UPDATE','Equipment','e'||(i%1000),timestamp '2025-01-01'+i*interval '5 minutes' FROM generate_series(1,100000)i`);
 for(const t of ['borrow_requests','borrow_request_items','lab_schedules','notifications','audit_logs','equipment'])await sql('ANALYZE '+t);
 console.log('Fixture loaded; measuring baseline');result.before=await plans();result.writes.before=await writes();
 for(const c of candidates){await sql(`CREATE INDEX "${c[1]}" ON ${c[2]} (${c[3]})`);await sql('ANALYZE '+c[2]);}
 console.log('Candidates installed in isolated schema; measuring');result.after=await plans();result.writes.after=await writes();
 await sql('DROP INDEX "borrow_requests_requestedBy_createdAt_idx"');
 await sql('DROP INDEX "lab_schedules_academicYearId_termId_roomId_dayOfWeek_idx"');
 await sql('CREATE INDEX "lab_schedules_academicYearId_termId_roomId_idx" ON lab_schedules ("academicYearId", "termId", "roomId")');
 await sql('ANALYZE lab_schedules');
 console.log('Measuring selected six-index set');result.selected=await plans();result.writes.selected=await writes();
 result.sizes=await db.$queryRawUnsafe(`SELECT indexname,pg_relation_size(quote_ident(schemaname)||'.'||quote_ident(indexname))::int AS bytes FROM pg_indexes WHERE schemaname=current_schema() AND indexname IN (${[...candidates.map(c=>c[1]),'lab_schedules_academicYearId_termId_roomId_idx'].map(n=>"'"+n+"'").join(',')})`);
 fs.mkdirSync(process.env.SMARTLAB_EVIDENCE_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.SMARTLAB_EVIDENCE_DIR,'SmartLab-Fix-15-Query-Plans.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({queries:result.before.map((p,i)=>({name:p.name,before:p.medianExecutionMs,after:result.after[i].medianExecutionMs,selected:result.selected[i].medianExecutionMs})),writes:result.writes,sizes:result.sizes},null,2));
 }finally{await db.$disconnect();await owner.$executeRawUnsafe('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');await owner.$disconnect();console.log('Removed isolated query-plan schema')}
}
main().catch(e=>{console.error(e.code, e.meta?.code, e.meta?.message || e.message);process.exitCode=1});


