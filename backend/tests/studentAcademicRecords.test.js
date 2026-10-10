const express=require('express');
const {PrismaClient}=require('@prisma/client');
let mockActor;
jest.mock('../dist/middleware/auth',()=>({authenticateToken:(req,res,next)=>{req.user=mockActor;next();},authorizeRoles:(...roles)=>(req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({error:'Forbidden'})}));
const {studentStanding}=require('../dist/services/studentStanding');
const {errorResponseContract,errorHandler}=require('../dist/middleware/errors');
let db,server,base,admin,student,program,years,term,request,item,subject,faculty;
const tag='academic-record-'+Date.now();
beforeAll(async()=>{
 const url=new URL(process.env.DATABASE_URL);if(!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/smartlab_test')throw Error('Local test database required');
 db=new PrismaClient();
 admin=await db.user.create({data:{email:tag+'-admin@test.local',firstName:'Record',lastName:'Admin',role:'ADMIN',passwordHash:'unused'}});
 student=await db.user.create({data:{email:tag+'-student@test.local',firstName:'Record',lastName:'Student',role:'STUDENT',passwordHash:'unused'}});
 program=await db.program.create({data:{code:tag,name:'Original program'}});
 await db.studentProfile.create({data:{userId:student.id,programId:program.id,yearLevel:3}});
 years=await Promise.all(['2025-2026','2026-2027','2028-2029'].map(year=>db.academicYear.create({data:{year:tag+year}})));
 term=await db.term.create({data:{name:tag}});
 faculty=await db.facultyProfile.findFirstOrThrow();
 subject=await db.subject.create({data:{code:tag,name:'Test subject'}});
 item=await db.equipment.create({data:{name:tag,totalQuantity:2,availableQuantity:2}});
 request=await db.borrowRequest.create({data:{requestedBy:student.id,requestType:'EQUIPMENT',usageLocation:'Test venue',programId:program.id,subjectId:subject.id,yearLevel:3,academicYearId:years[0].id,termId:term.id,dateNeeded:new Date('2035-06-12T00:00:00+08:00'),items:{create:{equipmentId:item.id,quantity:1}}}});
 const app=express();app.use(errorResponseContract);app.use(express.json());app.use('/academic',require('../dist/routes/studentAcademicRecords').default);app.use('/requests',require('../dist/routes/borrowRequests').default);app.use(errorHandler);
 server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base='http://127.0.0.1:'+server.address().port;
});
afterAll(async()=>{
 if(server)await new Promise(resolve=>server.close(resolve));
 if(db){await db.studentAcademicRecord.deleteMany({where:{studentId:student.id}});await db.auditLog.deleteMany({where:{actorUserId:{in:[student.id,admin.id]}}});await db.borrowRequest.deleteMany({where:{requestedBy:student.id}});await db.user.deleteMany({where:{id:{in:[student.id,admin.id]}}});await db.equipment.delete({where:{id:item.id}});await db.subject.delete({where:{id:subject.id}});await db.program.delete({where:{id:program.id}});await db.academicYear.deleteMany({where:{id:{in:years.map(y=>y.id)}}});await db.term.delete({where:{id:term.id}});await db.$disconnect();await require('../dist/db/prisma').prisma.$disconnect();}
});
async function save(academicYearId,body={}){mockActor=admin;const response=await fetch(base+'/academic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId:student.id,academicYearId,programId:program.id,yearLevel:3,status:'ENROLLED',reason:'Verified enrollment',expectedUpdatedAt:null,...body})});return {status:response.status,data:await response.json()};}
test('unmigrated students retain profile access without invented historical rows',async()=>{expect(await studentStanding(db,student.id,years[0].id)).toEqual({programId:program.id,yearLevel:3});expect(await db.studentAcademicRecord.count({where:{studentId:student.id}})).toBe(0);});
test('confirmed years remain independent; duplicate/stale writes fail',async()=>{
 const first=await save(years[0].id);expect(first.status).toBe(200);
 expect((await save(years[0].id)).status).toBe(409);
 expect((await save(years[1].id,{yearLevel:4})).status).toBe(200);
 await db.studentProfile.update({where:{userId:student.id},data:{yearLevel:4}});
 expect((await studentStanding(db,student.id,years[0].id)).yearLevel).toBe(3);
 expect((await studentStanding(db,student.id,years[1].id)).yearLevel).toBe(4);
 await expect(studentStanding(db,student.id,years[2].id)).rejects.toThrow(/not been configured/);
 expect((await db.borrowRequest.findUnique({where:{id:request.id}})).yearLevel).toBe(3);
 expect(await db.auditLog.count({where:{actorUserId:admin.id,entityType:'StudentAcademicRecord'}})).toBe(2);
});
test('graduation preserves access and history while blocking new enrollment-based requests',async()=>{
 expect((await save(years[2].id,{status:'GRADUATED',yearLevel:null})).status).toBe(200);
 await expect(studentStanding(db,student.id,years[2].id)).rejects.toThrow(/not enrolled/);
 expect((await db.user.findUnique({where:{id:student.id}})).status).toBe('ACTIVE');
 await db.program.update({where:{id:program.id},data:{name:'Renamed program'}});
 expect((await db.studentAcademicRecord.findUnique({where:{studentId_academicYearId:{studentId:student.id,academicYearId:years[0].id}}})).programName).toBe('Original program');
});
test('editing an old request preserves its original period and year level',async()=>{
 mockActor=student;const response=await fetch(base+'/requests/'+request.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({facultyId:faculty.id,requestType:'EQUIPMENT',usageLocation:'Changed venue',location:'Changed venue',programId:program.id,subjectId:subject.id,yearLevel:4,academicYearId:years[2].id,termId:term.id,dateNeeded:'2035-06-12',timeStart:'2035-06-12T08:00:00+08:00',timeEnd:'2035-06-12T09:00:00+08:00',purpose:'Updated purpose',items:[{equipmentId:item.id,quantity:1}]})});
 expect(response.status).toBe(200);const saved=await db.borrowRequest.findUnique({where:{id:request.id}});expect(saved.yearLevel).toBe(3);expect(saved.academicYearId).toBe(years[0].id);
});
test('non-admin cannot list or modify academic records',async()=>{mockActor=student;expect((await fetch(base+'/academic?academicYearId='+years[0].id)).status).toBe(403);expect((await fetch(base+'/academic',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status).toBe(403);});
test('invalid levels and stale updates cannot overwrite history',async()=>{
 expect((await save(years[0].id,{yearLevel:0})).status).toBe(400);
 expect((await save(years[0].id,{yearLevel:null})).status).toBe(400);
 expect((await save(years[0].id,{expectedUpdatedAt:'2000-01-01T00:00:00Z',yearLevel:4})).status).toBe(409);
});
test('bulk setup and promotion preview, exceptions, protection and rollback',async()=>{
 const {previewAcademicBatch,commitAcademicBatch}=require('../dist/services/studentAcademicBatch');
 const batchYears=await Promise.all(['2090-2091','2091-2092','2092-2093'].map(year=>db.academicYear.create({data:{year}})));
 const second=await db.user.create({data:{email:tag+'-batch@test.local',firstName:'Batch',lastName:'Student',role:'STUDENT',passwordHash:'unused',studentProfile:{create:{programId:program.id,yearLevel:4}}}});
 try {
  const setup={mode:'SETUP',academicYearId:batchYears[0].id,studentIds:[student.id,second.id]};
  const preview=await previewAcademicBatch(db,setup);expect(preview.rows).toHaveLength(2);expect(await db.studentAcademicRecord.count({where:{academicYearId:batchYears[0].id}})).toBe(0);
  const rows=preview.rows.map(row=>({...row,status:'ENROLLED',yearLevel:row.studentId===student.id?3:4}));
  await db.$transaction(tx=>commitAcademicBatch(tx,{...setup,rows,reason:'Reviewed setup'},admin.id));
  await expect(db.$transaction(tx=>commitAcademicBatch(tx,{...setup,rows,reason:'Duplicate'},admin.id))).rejects.toThrow(/already exists/);
  const promotion={mode:'PROMOTE',academicYearId:batchYears[1].id,sourceYearId:batchYears[0].id,studentIds:[student.id,second.id]};
  const next=await previewAcademicBatch(db,promotion);
  expect(next.rows.find(row=>row.studentId===student.id).yearLevel).toBe(4);
  expect(next.rows.find(row=>row.studentId===second.id)).toMatchObject({status:'GRADUATED',yearLevel:null,requiresGraduationReview:true});
  const invalid=next.rows.map(row=>({...row,status:'CONTINUING',yearLevel:row.studentId===second.id?0:4}));
  await expect(db.$transaction(tx=>commitAcademicBatch(tx,{...promotion,rows:invalid,reason:'Invalid'},admin.id))).rejects.toThrow(/year level/);
  expect(await db.studentAcademicRecord.count({where:{academicYearId:batchYears[1].id}})).toBe(0);
  await db.studentAcademicRecord.update({where:{studentId_academicYearId:{studentId:student.id,academicYearId:batchYears[0].id}},data:{yearLevel:2}});
  await expect(db.$transaction(tx=>commitAcademicBatch(tx,{...promotion,rows:next.rows,reason:'Stale'},admin.id))).rejects.toThrow(/changed/);
  const refreshed=await previewAcademicBatch(db,promotion);
  await db.$transaction(tx=>commitAcademicBatch(tx,{...promotion,rows:refreshed.rows.map(row=>({...row,status:'CONTINUING',yearLevel:row.studentId===second.id?4:3})),reason:'Repeating student reviewed'},admin.id));
  expect((await db.studentAcademicRecord.findUnique({where:{studentId_academicYearId:{studentId:second.id,academicYearId:batchYears[1].id}}})).yearLevel).toBe(4);
  expect((await db.user.findUnique({where:{id:second.id}})).status).toBe('ACTIVE');
  await expect(previewAcademicBatch(db,{...promotion,academicYearId:batchYears[2].id})).rejects.toThrow(/consecutive/);
  const concurrentInput={mode:'PROMOTE',academicYearId:batchYears[2].id,sourceYearId:batchYears[1].id,studentIds:[student.id]};
  mockActor=admin;
  const apiPreview=await fetch(base+'/academic/batch/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(concurrentInput)});
  expect(apiPreview.status).toBe(200);const concurrentPreview=await apiPreview.json();
  const payload={...concurrentInput,rows:concurrentPreview.rows,reason:'Concurrent confirmation'};
  const commits=await Promise.all([1,2].map(()=>fetch(base+'/academic/batch/commit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})));
  expect(commits.map(response=>response.status).sort()).toEqual([200,409]);
  expect(await db.studentAcademicRecord.count({where:{academicYearId:batchYears[2].id}})).toBe(1);
  expect((await db.borrowRequest.findUnique({where:{id:request.id}})).yearLevel).toBe(3);
  const audit=await db.auditLog.findMany({where:{actorUserId:admin.id,entityType:'StudentAcademicRecord'}});
  expect(audit.some(log=>log.details?.reason==='Concurrent confirmation'&&log.details?.batchId)).toBe(true);
  mockActor=student;
  expect((await fetch(base+'/academic/batch/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(setup)})).status).toBe(403);
  expect((await fetch(base+'/academic/batch/commit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...setup,rows,reason:'Unauthorized'})})).status).toBe(403);
 } finally {
  await db.studentAcademicRecord.deleteMany({where:{academicYearId:{in:batchYears.map(year=>year.id)}}});await db.user.delete({where:{id:second.id}});await db.academicYear.deleteMany({where:{id:{in:batchYears.map(year=>year.id)}}});
 }
});
