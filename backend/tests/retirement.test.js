const path=require('path');require('dotenv').config({path:path.join(__dirname,'../.env')});
const {PrismaClient}=require('@prisma/client'),bcrypt=require('bcryptjs');const {apiRequest,loginAs,BASE_URL}=require('./helpers');
describe('retirement preserves history and inventory on local smartlab_test',()=>{
  let db,admin,token,year,term;const users=[],equipment=[];const tag='retirement-'+Date.now();const password='RetirementTest123!';
  beforeAll(async()=>{let d,a;try{d=new URL(process.env.DATABASE_URL);a=new URL(BASE_URL)}catch{throw Error('Invalid test configuration')};if(!['localhost','127.0.0.1'].includes(d.hostname)||d.pathname!=='/smartlab_test'||!['localhost','127.0.0.1'].includes(a.hostname))throw Error('Local test database/API required');db=new PrismaClient();admin=await user('ADMIN');token=await loginAs(admin.email,password);year=await db.academicYear.create({data:{year:tag}});term=await db.term.create({data:{name:tag}})});
  afterAll(async()=>{if(!db)return;try{await db.notification.deleteMany({where:{OR:[{userId:{in:users}},{borrowRequest:{requestedBy:{in:users}}}]}});await db.auditLog.deleteMany({where:{actorUserId:{in:users}}});await db.borrowRequest.deleteMany({where:{requestedBy:{in:users}}});await db.equipment.deleteMany({where:{id:{in:equipment}}});await db.user.deleteMany({where:{id:{in:users}}});if(year)await db.academicYear.delete({where:{id:year.id}});if(term)await db.term.delete({where:{id:term.id}})}finally{await db.$disconnect()}});
  async function user(role='STUDENT'){const u=await db.user.create({data:{email:tag+'-'+users.length+'@smartlab.local',passwordHash:await bcrypt.hash(password,10),firstName:'Retirement',lastName:'Test',role}});users.push(u.id);return u}
  async function stock(borrowed=0){const e=await db.equipment.create({data:{name:tag+'-'+require('node:crypto').randomUUID(),description:'Keep this description',totalQuantity:3,availableQuantity:3-borrowed,borrowedQuantity:borrowed}});equipment.push(e.id);return e}
  async function request(u,e,status='BORROWED'){return db.borrowRequest.create({data:{requestType:'EQUIPMENT',usageLocation:'Test venue',requestedBy:u.id,academicYearId:year.id,termId:term.id,dateNeeded:new Date('2037-06-12T00:00:00+08:00'),timeStart:new Date('2037-06-12T08:00:00+08:00'),timeEnd:new Date('2037-06-12T10:00:00+08:00'),status,items:{create:{equipmentId:e.id,quantity:1}}}})}
  const retire=(type,id,method='POST',auth=token)=>apiRequest(method,'/'+type+'/'+id+(method==='POST'?'/retire':''),{},auth);
  const act=(r,a)=>apiRequest('PATCH','/borrow-requests/'+r.id+'/'+a,null,token);
  const current=e=>db.equipment.findUnique({where:{id:e.id}});
  test.each(['POST','DELETE'])('account %s preserves all loan records, profiles and counters',async method=>{
    const u=await user('FACULTY');await db.facultyProfile.create({data:{userId:u.id}});const login=await loginAs(u.email,password),e=await stock(1),r=await request(u,e);
    await db.notification.create({data:{userId:u.id,type:'EQUIPMENT_DUE',title:'Keep notice',message:'Loan due',borrowRequestId:r.id}});
    const result=await retire('users',u.id,method);expect(result.status).toBe(200);
    expect(await db.user.findUnique({where:{id:u.id}})).toMatchObject({status:'DEACTIVATED'});expect(await db.facultyProfile.findUnique({where:{userId:u.id}})).not.toBeNull();
    expect((await db.borrowRequest.findUnique({where:{id:r.id}})).status).toBe('BORROWED');expect(await db.borrowRequestItem.count({where:{borrowRequestId:r.id}})).toBe(1);expect(await db.notification.count({where:{userId:u.id}})).toBe(1);
    expect(await current(e)).toMatchObject({availableQuantity:2,borrowedQuantity:1});expect((await apiRequest('GET','/auth/me',null,login)).status).toBe(401);
    expect((await act(r,'return')).status).toBe(200);expect(await current(e)).toMatchObject({availableQuantity:3,borrowedQuantity:0});
  });
  test.each(['POST','DELETE'])('equipment %s preserves historical and borrowed line items and supports return',async method=>{
    const u=await user(),e=await stock(1),r=await request(u,e);const history=await request(u,e,'RETURNED');
    expect((await retire('equipment',e.id,method)).status).toBe(200);expect(await current(e)).toMatchObject({name:e.name,description:e.description,totalQuantity:3,availableQuantity:2,borrowedQuantity:1,status:'UNAVAILABLE'});
    expect(await db.borrowRequestItem.count({where:{borrowRequestId:{in:[r.id,history.id]}}})).toBe(2);
    expect((await act(r,'return')).status).toBe(200);expect(await current(e)).toMatchObject({availableQuantity:3,borrowedQuantity:0,status:'UNAVAILABLE'});
    expect(await db.borrowRequestItem.count({where:{borrowRequestId:{in:[r.id,history.id]}}})).toBe(2);
  });
  test('borrowed cancellation restores a retired equipment counter exactly once',async()=>{const u=await user(),e=await stock(1),r=await request(u,e);await retire('equipment',e.id);expect((await act(r,'cancel')).status).toBe(200);expect((await act(r,'cancel')).status).toBe(409);expect(await current(e)).toMatchObject({availableQuantity:3,borrowedQuantity:0,status:'UNAVAILABLE'})});
  test.each(['POST','DELETE'])('equipment %s blocks outstanding approved reservations without changes',async method=>{const u=await user(),e=await stock(),r=await request(u,e,'APPROVED');expect((await retire('equipment',e.id,method)).status).toBe(409);expect(await current(e)).toMatchObject({status:'AVAILABLE',availableQuantity:3});expect(await db.borrowRequestItem.count({where:{borrowRequestId:r.id}})).toBe(1)});
  test('pending selections survive retirement but cannot be approved',async()=>{const u=await user(),e=await stock(),r=await request(u,e,'PENDING');expect((await retire('equipment',e.id)).status).toBe(200);expect((await act(r,'approve')).status).toBe(409);expect(await db.borrowRequestItem.count({where:{borrowRequestId:r.id}})).toBe(1)});
  test('repeat retirement is idempotent and records one audit event',async()=>{const u=await user(),e=await stock();for(const type of ['users','equipment']){const id=type==='users'?u.id:e.id;const results=await Promise.all([retire(type,id),retire(type,id)]);expect(results.map(r=>r.status)).toEqual([200,200]);expect(await db.auditLog.count({where:{entityId:id,action:'RETIRE'}})).toBe(1)}});
  test('retirement and return race preserves unavailable status and correct counters',async()=>{const u=await user(),e=await stock(1),r=await request(u,e);const results=await Promise.all([retire('equipment',e.id),act(r,'return')]);expect(results.map(r=>r.status)).toEqual([200,200]);expect(await current(e)).toMatchObject({availableQuantity:3,borrowedQuantity:0,status:'UNAVAILABLE'})});
  test('retirement and approval race permits only one conflicting change',async()=>{const u=await user(),e=await stock(),r=await request(u,e,'PENDING');const results=await Promise.all([retire('equipment',e.id),act(r,'approve')]);expect(results.map(r=>r.status).sort()).toEqual([200,409]);const eq=await current(e),req=await db.borrowRequest.findUnique({where:{id:r.id}});expect(eq.status==='UNAVAILABLE'?req.status==='PENDING':req.status==='APPROVED').toBe(true)});
  test.each(['users','equipment'])('%s retirement rejects missing targets',async type=>{for(const method of ['POST','DELETE'])expect((await retire(type,'missing-'+tag,method)).status).toBe(404)});
  test.each(['users','equipment'])('%s retirement requires administrator authentication',async type=>{const u=await user(),t=await loginAs(u.email,password),e=await stock(),id=type==='users'?u.id:e.id;for(const method of ['POST','DELETE']){expect((await retire(type,id,method,null)).status).toBe(401);expect((await retire(type,id,method,t)).status).toBe(403)}});
  test('administrator cannot retire its own active account',async()=>{expect((await retire('users',admin.id)).status).toBe(409);expect((await apiRequest('GET','/auth/me',null,token)).status).toBe(200)});
  test('account history also survives retirement with no outstanding loan',async()=>{const u=await user(),e=await stock(),r=await request(u,e,'RETURNED');expect((await retire('users',u.id,'DELETE')).status).toBe(200);expect(await db.borrowRequest.findUnique({where:{id:r.id}})).not.toBeNull();expect(await db.borrowRequestItem.count({where:{borrowRequestId:r.id}})).toBe(1)});
  test('active zero-stock equipment becomes available when replenished',async()=>{
    const result=await apiRequest('POST','/equipment',{name:tag+'-'+require('node:crypto').randomUUID(),totalQuantity:0},token);expect(result.status).toBe(201);const e=result.data;equipment.push(e.id);expect(e.retiredAt).toBeNull();
    const updated=await apiRequest('PUT','/equipment/'+e.id,{totalQuantity:4,expectedUpdatedAt:(await current(e)).updatedAt.toISOString(),adjustmentReason:'Test stock replenishment'},token);expect(updated.status).toBe(200);expect(updated.data).toMatchObject({status:'AVAILABLE',retiredAt:null,stockStatus:'AVAILABLE'});
  });
  test('stock edits cannot reactivate archived equipment, explicit restore can',async()=>{
    const e=await stock();await retire('equipment',e.id);
    const edited=await apiRequest('PUT','/equipment/'+e.id,{totalQuantity:5,expectedUpdatedAt:(await current(e)).updatedAt.toISOString(),adjustmentReason:'Test stock replenishment'},token);expect(edited.status).toBe(200);expect(edited.data).toMatchObject({status:'UNAVAILABLE',stockStatus:'AVAILABLE'});expect(edited.data.retiredAt).toBeTruthy();
    expect((await apiRequest('PUT','/equipment/'+e.id,{status:'AVAILABLE',expectedUpdatedAt:(await current(e)).updatedAt.toISOString()},token)).status).toBe(409);
    expect((await apiRequest('PUT','/equipment/'+e.id,{retiredAt:null,expectedUpdatedAt:(await current(e)).updatedAt.toISOString()},token)).status).toBe(409);
    const restored=await apiRequest('POST','/equipment/'+e.id+'/restore',{},token);expect(restored.status).toBe(200);expect(restored.data.equipment).toMatchObject({retiredAt:null,status:'AVAILABLE',totalQuantity:5});
  });
  test('archive marks empty equipment and restore does not invent stock',async()=>{
    const result=await apiRequest('POST','/equipment',{name:tag+'-'+require('node:crypto').randomUUID(),totalQuantity:0},token);const e=result.data;equipment.push(e.id);await retire('equipment',e.id);expect((await current(e)).retiredAt).not.toBeNull();
    const restored=await apiRequest('POST','/equipment/'+e.id+'/restore',{},token);expect(restored.status).toBe(200);expect(restored.data.equipment).toMatchObject({retiredAt:null,status:'UNAVAILABLE',availableQuantity:0});
  });
  test('restore derives damaged status from current stock',async()=>{
    const e=await stock();await retire('equipment',e.id);expect((await apiRequest('PUT','/equipment/'+e.id,{damagedQuantity:3,expectedUpdatedAt:(await current(e)).updatedAt.toISOString(),adjustmentReason:'Test damage correction'},token)).status).toBe(200);
    const restored=await apiRequest('POST','/equipment/'+e.id+'/restore',{},token);expect(restored.data.equipment).toMatchObject({retiredAt:null,status:'DAMAGED',availableQuantity:0});
  });
  test('restore is admin-only and missing equipment returns 404',async()=>{
    const e=await stock(),u=await user(),t=await loginAs(u.email,password);await retire('equipment',e.id);
    expect((await apiRequest('POST','/equipment/'+e.id+'/restore',{})).status).toBe(401);
    expect((await apiRequest('POST','/equipment/'+e.id+'/restore',{},t)).status).toBe(403);
    expect((await apiRequest('POST','/equipment/missing-'+tag+'/restore',{},token)).status).toBe(404);
  });
  test('duplicate restoration records one audit event',async()=>{
    const e=await stock();await retire('equipment',e.id);const results=await Promise.all([1,2].map(()=>apiRequest('POST','/equipment/'+e.id+'/restore',{},token)));expect(results.map(r=>r.status)).toEqual([200,200]);expect(await db.auditLog.count({where:{entityId:e.id,action:'RESTORE'}})).toBe(1);
  });
  test('borrowing all stock updates status and returning restores it',async()=>{
    const u=await user(),e=await stock(),r=await request(u,e,'APPROVED');await db.borrowRequestItem.updateMany({where:{borrowRequestId:r.id},data:{quantity:3}});
    expect((await act(r,'borrow')).status).toBe(200);expect(await current(e)).toMatchObject({status:'BORROWED',retiredAt:null,availableQuantity:0});
    expect((await act(r,'return')).status).toBe(200);expect(await current(e)).toMatchObject({status:'AVAILABLE',retiredAt:null,availableQuantity:3});
  });

});
