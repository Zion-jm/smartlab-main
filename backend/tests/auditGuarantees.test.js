const express=require('express'),path=require('path');require('dotenv').config({path:path.join(__dirname,'../.env')});
const {PrismaClient}=require('@prisma/client'),bcrypt=require('bcryptjs');
const mockClients=[];let mockActor;
jest.mock('@prisma/client',()=>{const real=jest.requireActual('@prisma/client');return {...real,PrismaClient:jest.fn((...args)=>{const client=new real.PrismaClient(...args);mockClients.push(client);return client})}});
jest.mock('../dist/middleware/auth',()=>({authenticateToken:(req,_res,next)=>{req.user=mockActor;next()},authorizeRoles:()=> (_req,_res,next)=>next()}));
const audit=require('../dist/services/auditLogService');const {errorResponseContract,errorHandler}=require('../dist/middleware/errors');
let db,server,base,year,term,equipment,borrower,loan;const tag='audit-rollback-'+Date.now();const password='AuditTest123!';
beforeAll(async()=>{const u=new URL(process.env.DATABASE_URL);if(!['localhost','127.0.0.1'].includes(u.hostname)||u.pathname!=='/smartlab_test')throw Error('Local smartlab_test required');db=new PrismaClient();
 mockActor=await db.user.create({data:{email:tag+'@test.local',firstName:'Audit',lastName:'Admin',role:'ADMIN',passwordHash:await bcrypt.hash(password,10)}});
 borrower=await db.user.create({data:{email:tag+'-borrower@test.local',firstName:'Audit',lastName:'Student',role:'STUDENT',passwordHash:'unused'}});
 year=await db.academicYear.create({data:{year:tag}});term=await db.term.create({data:{name:tag}});
 equipment=await db.equipment.create({data:{name:tag,totalQuantity:3,availableQuantity:3}});
 loan=await db.borrowRequest.create({data:{requestType:'EQUIPMENT',usageLocation:'Test venue',requestedBy:borrower.id,academicYearId:year.id,termId:term.id,dateNeeded:new Date('2039-06-12T00:00:00+08:00'),timeStart:new Date('2039-06-12T08:00:00+08:00'),timeEnd:new Date('2039-06-12T09:00:00+08:00'),items:{create:{equipmentId:equipment.id,quantity:1}}}});
 const app=express();app.use(errorResponseContract);app.use(express.json());for(const n of ['equipment','users','borrowRequests','auth'])app.use('/'+n,require('../dist/routes/'+n).default);app.use(errorHandler);server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});base='http://127.0.0.1:'+server.address().port;
});
afterEach(()=>jest.restoreAllMocks());
afterAll(async()=>{if(server)await new Promise(resolve=>server.close(resolve));if(db&&mockActor){await db.notification.deleteMany({where:{userId:{in:[mockActor.id,borrower.id]}}});await db.auditLog.deleteMany({where:{actorUserId:mockActor.id}});await db.borrowRequest.deleteMany({where:{requestedBy:borrower.id}});await db.equipment.deleteMany({where:{name:{startsWith:tag}}});await db.user.deleteMany({where:{id:{in:[mockActor.id,borrower.id]}}});if(year)await db.academicYear.delete({where:{id:year.id}});if(term)await db.term.delete({where:{id:term.id}})}await Promise.all(mockClients.map(c=>c.$disconnect()))});
async function failAudit(method,url,body={}){jest.spyOn(audit,'recordRequiredAuditLog').mockRejectedValue(new Error('Injected audit failure'));const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});expect(r.status).toBe(500);expect(await r.json()).toEqual({error:'Internal server error.',code:'INTERNAL_ERROR'});expect(audit.recordRequiredAuditLog).toHaveBeenCalled()}
test('failed equipment create audit rolls back insertion',async()=>{await failAudit('POST','/equipment',{name:tag+'-new',totalQuantity:2});expect(await db.equipment.count({where:{name:tag+'-new'}})).toBe(0)});
test('failed stock update audit rolls back physical stock',async()=>{await failAudit('PUT','/equipment/'+equipment.id,{totalQuantity:5,expectedUpdatedAt:equipment.updatedAt.toISOString(),adjustmentReason:'Test audit rollback'});expect(await db.equipment.findUnique({where:{id:equipment.id}})).toMatchObject({totalQuantity:3,availableQuantity:3})});
test('failed approval audit leaves request pending',async()=>{await failAudit('PATCH','/borrowRequests/'+loan.id+'/approve');expect(await db.borrowRequest.findUnique({where:{id:loan.id}})).toMatchObject({status:'PENDING'})});
test('failed rejection audit leaves request pending',async()=>{await failAudit('PATCH','/borrowRequests/'+loan.id+'/reject',{reason:'Test'});expect(await db.borrowRequest.findUnique({where:{id:loan.id}})).toMatchObject({status:'PENDING'})});
test('failed borrow audit restores both status and counters',async()=>{await db.borrowRequest.update({where:{id:loan.id},data:{status:'APPROVED'}});await failAudit('PATCH','/borrowRequests/'+loan.id+'/borrow');expect(await db.borrowRequest.findUnique({where:{id:loan.id}})).toMatchObject({status:'APPROVED'});expect(await db.equipment.findUnique({where:{id:equipment.id}})).toMatchObject({availableQuantity:3,borrowedQuantity:0})});
test.each(['return','cancel'])('failed %s audit preserves borrowed stock',async action=>{await db.borrowRequest.update({where:{id:loan.id},data:{status:'BORROWED'}});await db.equipment.update({where:{id:equipment.id},data:{availableQuantity:2,borrowedQuantity:1}});await failAudit('PATCH','/borrowRequests/'+loan.id+'/'+action);expect(await db.borrowRequest.findUnique({where:{id:loan.id}})).toMatchObject({status:'BORROWED'});expect(await db.equipment.findUnique({where:{id:equipment.id}})).toMatchObject({availableQuantity:2,borrowedQuantity:1})});
test('failed status audit preserves account and sessions',async()=>{await failAudit('PATCH','/users/'+borrower.id+'/status',{status:'DEACTIVATED'});expect(await db.user.findUnique({where:{id:borrower.id}})).toMatchObject({status:'ACTIVE',sessionVersion:0})});
test('failed role edit audit preserves account',async()=>{await failAudit('PUT','/users/'+borrower.id,{role:'ADMIN'});expect(await db.user.findUnique({where:{id:borrower.id}})).toMatchObject({role:'STUDENT',sessionVersion:0});expect(await db.adminProfile.findUnique({where:{userId:borrower.id}})).toBeNull()});
test('failed session revocation audit preserves version',async()=>{await failAudit('POST','/users/'+borrower.id+'/revoke-sessions');expect(await db.user.findUnique({where:{id:borrower.id}})).toMatchObject({sessionVersion:0})});
test('failed password audit preserves hash and session',async()=>{const before=await db.user.findUnique({where:{id:mockActor.id}});await failAudit('PATCH','/auth/password',{currentPassword:password,newPassword:'ChangedAudit123!'});expect(await db.user.findUnique({where:{id:mockActor.id}})).toMatchObject({passwordHash:before.passwordHash,sessionVersion:0})});
test('required audit redacts credentials',async()=>{await db.$transaction(tx=>audit.recordRequiredAuditLog(tx,{actorUserId:mockActor.id,action:'TEST',entityType:'User',entityId:mockActor.id,details:{password:'PRIVATE',nested:{token:'PRIVATE'},safe:'retained'}}));const log=await db.auditLog.findFirst({where:{actorUserId:mockActor.id,action:'TEST'}});expect(log.details).toEqual({password:'[redacted]',nested:{token:'[redacted]'},safe:'retained'})});

test('successful approval writes exactly one audit and duplicate approval writes none',async()=>{
 await db.borrowRequest.update({where:{id:loan.id},data:{status:'PENDING'}});await db.equipment.update({where:{id:equipment.id},data:{availableQuantity:3,borrowedQuantity:0}});
 for(const expected of [200,409]){const r=await fetch(base+'/borrowRequests/'+loan.id+'/approve',{method:'PATCH',headers:{'Content-Type':'application/json'},body:'{}'});expect(r.status).toBe(expected);}
 expect(await db.auditLog.count({where:{entityId:loan.id,action:'APPROVE'}})).toBe(1);
});
test('optional directory audit failure does not reject the completed operation',async()=>{
 await expect(audit.recordOptionalAuditLog({auditLog:{create:async()=>{throw new Error('Injected optional failure')}}},{actorUserId:mockActor.id,action:'UPDATE',entityType:'Building',entityId:'example'})).resolves.toBeUndefined();
});

test('request audit keeps readable context after requester and location change', async()=>{
 const event = {actorUserId:mockActor.id,action:'SNAPSHOT_TEST',entityType:'BorrowRequest',entityId:loan.id};
 await db.$transaction(tx=>audit.recordRequiredAuditLog(tx,event));
 const before=await db.auditLog.findFirst({where:{entityId:loan.id,action:'SNAPSHOT_TEST'}});
 expect(before.details.referenceCode).toBe('REQ-'+loan.id.toUpperCase().slice(-6));
 expect(before.details.context).toContain('Test venue');
 expect(before.details.context).toContain('Jun 12, 2039');
 expect(before.details.context).toContain('Audit Student');
 await db.borrowRequest.update({where:{id:loan.id},data:{usageLocation:'New venue'}});
 await db.user.update({where:{id:borrower.id},data:{firstName:'Renamed'}});
 const after=await db.auditLog.findUnique({where:{id:before.id}});
 expect(after.details).toEqual(before.details);
});
