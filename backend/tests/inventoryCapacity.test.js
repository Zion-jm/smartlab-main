const path = require('node:path');
require('dotenv').config({path: path.join(__dirname, '../.env')});
const {PrismaClient} = require('@prisma/client');
const bcrypt = require('bcryptjs');
const {apiRequest, loginAs, BASE_URL} = require('./helpers');
const {validateRequestItems, peakReserved} = require('../dist/services/inventoryCapacityService');

describe('quantity validation', () => {
  test.each([0,-1,1.5,'2',null,2147483648,Infinity,NaN])('rejects invalid quantity %p', quantity => {
    expect(() => validateRequestItems([{equipmentId:'x',quantity}])).toThrow();
  });
  test('rejects duplicates and malformed selections', () => {
    for(const input of [null,{},[null],[{equipmentId:'',quantity:1}],[{equipmentId:'x',quantity:1},{equipmentId:'x',quantity:2}]]) expect(() => validateRequestItems(input)).toThrow();
  });
});

describe('inventory capacity API on local smartlab_test', () => {
  let db,admin,token,faculty,facultyToken,profile,year,term;const ids=[];const tag='capacity-'+Date.now();
  const day='2036-06-12';
  const at=t=>new Date(day+'T'+t+':00+08:00');
  beforeAll(async()=>{
    let d,a;try{d=new URL(process.env.DATABASE_URL);a=new URL(BASE_URL)}catch{throw Error('Invalid test configuration')}
    if(!['localhost','127.0.0.1'].includes(d.hostname)||d.pathname!=='/smartlab_test'||!['localhost','127.0.0.1'].includes(a.hostname))throw Error('Local smartlab_test/API required');
    db=new PrismaClient();admin=await db.user.create({data:{email:tag+'@smartlab.local',passwordHash:await bcrypt.hash('CapacityTest123!',10),firstName:'Capacity',lastName:'Test',role:'ADMIN'}});
    token=await loginAs(admin.email,'CapacityTest123!');
    faculty=await db.user.create({data:{email:tag+'-faculty@smartlab.local',passwordHash:await bcrypt.hash('CapacityTest123!',10),firstName:'Capacity',lastName:'Faculty',role:'FACULTY'}});
    facultyToken=await loginAs(faculty.email,'CapacityTest123!');
    profile=await db.facultyProfile.create({data:{userId:faculty.id}});
    year=await db.academicYear.findFirstOrThrow({where:{isActive:true}});term=await db.term.findFirstOrThrow({where:{isActive:true}});
  });
  afterAll(async()=>{
    if(!db)return;try{
      const userIds=[admin?.id,faculty?.id].filter(Boolean);
      await db.notification.deleteMany({where:{OR:[{userId:{in:userIds}},{borrowRequest:{requestedBy:{in:userIds}}}]}});
      await db.auditLog.deleteMany({where:{actorUserId:{in:userIds}}});
      await db.borrowRequest.deleteMany({where:{requestedBy:{in:userIds}}});
      await db.equipment.deleteMany({where:{id:{in:ids}}});
      await db.user.deleteMany({where:{id:{in:userIds}}});
    }finally{await db.$disconnect()}
  });
  async function stock(total=10,borrowed=0,damaged=0,status='AVAILABLE'){
    const e=await db.equipment.create({data:{name:tag+'-'+require('node:crypto').randomUUID(),totalQuantity:total,availableQuantity:total-borrowed-damaged,borrowedQuantity:borrowed,damagedQuantity:damaged,status,retiredAt:status==='UNAVAILABLE'?new Date():null}});ids.push(e.id);return e;
  }
  async function booking(e,q=1,status='APPROVED',start='08:00',end='10:00',extra={}){
    return db.borrowRequest.create({data:{requestedBy:faculty.id,academicYearId:year.id,termId:term.id,dateNeeded:at('00:00'),timeStart:at(start),timeEnd:at(end),status,...extra,items:{create:{equipmentId:e.id,quantity:q}}}});
  }
  const requestBody=items=>({requestType:'EQUIPMENT',facultyId:profile.id,usageLocation:'Capacity test venue',academicYearId:year.id,termId:term.id,dateNeeded:day,timeStart:at('08:00').toISOString(),timeEnd:at('10:00').toISOString(),purpose:'Capacity test',items});
  const input=()=>({academicYearId:year.id,termId:term.id,date:day,timeStart:'08:00',timeEnd:'10:00'});
  async function preview(e){const r=await apiRequest('POST','/equipment-conflicts/conflicts',{...input(),equipment:[{equipmentId:e.id,requestedQuantity:1}]},token);expect(r.status).toBe(200);return r.data.data.availability[e.id].available;}
  const edit=(e,body)=>apiRequest('PUT','/equipment/'+e.id,{expectedUpdatedAt:e.updatedAt.toISOString(),adjustmentReason:'Test inventory correction',...body},token);
  const act=(r,action)=>apiRequest('PATCH','/borrow-requests/'+r.id+'/'+action,null,token);
  test.each([0,-1,1.5,'2',2147483648])('create and edit reject quantity %p without writing',async quantity=>{
    const e=await stock();const pending=await booking(e,1,'PENDING');
    const body=requestBody([{equipmentId:e.id,quantity}]);
    expect((await apiRequest('POST','/borrow-requests',body,facultyToken)).status).toBe(400);
    expect((await apiRequest('PUT','/borrow-requests/'+pending.id,body,facultyToken)).status).toBe(400);
    expect((await db.borrowRequestItem.findMany({where:{borrowRequestId:pending.id}})).map(i=>i.quantity)).toEqual([1]);
  });
  test('valid request creation persists positive integer selections',async()=>{
    const e=await stock();const result=await apiRequest('POST','/borrow-requests',requestBody([{equipmentId:e.id,quantity:2}]),facultyToken);
    expect(result.status).toBe(201);expect(result.data.request.items.map(i=>i.quantity)).toEqual([2]);
  });
  test('unknown equipment selection returns a relationship conflict',async()=>{
    const result=await apiRequest('POST','/borrow-requests',requestBody([{equipmentId:'missing-'+tag,quantity:1}]),facultyToken);expect(result.status).toBe(409);
  });
  test.each([1,2,3])('stock reduction racing approval preserves capacity round %s',async()=>{
    const e=await stock(1);const r=await booking(e,1,'PENDING');
    const results=await Promise.all([edit(e,{damagedQuantity:1}),act(r,'approve')]);
    expect(results.map(result=>result.status).sort()).toEqual([200,409]);
    const current=await db.equipment.findUnique({where:{id:e.id}});const request=await db.borrowRequest.findUnique({where:{id:r.id}});
    expect(request.status==='APPROVED'?current.availableQuantity===1:current.damagedQuantity===1).toBe(true);
  });
  test('create rejects duplicate lines',async()=>{
    const e=await stock();expect((await apiRequest('POST','/borrow-requests',requestBody([{equipmentId:e.id,quantity:1},{equipmentId:e.id,quantity:2}]),facultyToken)).status).toBe(400);
  });
  test('previews subtract damage and outstanding loans',async()=>{
    const e=await stock(10,2,3);await booking(e,2,'BORROWED','08:00','10:00',{dateNeeded:new Date('2020-01-01T00:00:00+08:00')});
    await booking(e,2);expect(await preview(e)).toBe(3);
    const r=await apiRequest('GET','/equipment-conflicts/availability?'+new URLSearchParams(input()),null,token);expect(r.status).toBe(200);expect(r.data.data.availability.find(a=>a.id===e.id).available).toBe(3);
  });
  test('adjacent reservations use peak rather than sum; approval matches preview',async()=>{
    const e=await stock(10);await booking(e,6,'APPROVED','08:00','09:00');await booking(e,6,'APPROVED','09:00','10:00');expect(await preview(e)).toBe(4);
    const r=await booking(e,4,'PENDING');expect((await act(r,'approve')).status).toBe(200);
  });
  test('minute-level adjacent intervals do not create a false conflict',async()=>{
    const e=await stock(1);await booking(e,1,'APPROVED','07:45','08:00');expect(await preview(e)).toBe(1);
  });
  test('legacy requests with no times reserve the whole day',async()=>{
    const e=await stock(10);await booking(e,3,'APPROVED','08:00','10:00',{timeStart:null,timeEnd:null});expect(await preview(e)).toBe(7);
  });
  test('stock is shared across academic periods',async()=>{
    const e=await stock(10);const other=await db.term.create({data:{name:tag+'-other'}});
    try{const r=await booking(e,4,'APPROVED','08:00','10:00',{termId:other.id});expect(await preview(e)).toBe(6);await db.borrowRequest.delete({where:{id:r.id}});}finally{await db.term.delete({where:{id:other.id}})}
  });
  test('zero-quantity read-only preview returns reservations',async()=>{
    const e=await stock(10);await booking(e,2);
    const r=await apiRequest('POST','/equipment-conflicts/conflicts',{...input(),equipment:[{equipmentId:e.id,requestedQuantity:0}]},token);
    expect(r.status).toBe(200);expect(r.data.data.conflicts[0].shortage).toBe(0);expect(r.data.data.conflicts[0].conflictingRequests).toHaveLength(1);
  });
  test('pending selections warn but do not consume capacity',async()=>{
    const e=await stock(10);await booking(e,8,'PENDING');expect(await preview(e)).toBe(10);
  });
  test('unavailable stock stays blocked in preview and checkout',async()=>{
    const e=await stock(10,0,0,'UNAVAILABLE');const r=await booking(e,1);expect(await preview(e)).toBe(0);expect((await act(r,'borrow')).status).toBe(409);
    expect((await db.equipment.findUnique({where:{id:e.id}})).borrowedQuantity).toBe(0);
  });
  test('ordinary edits preserve unavailable status',async()=>{
    const e=await stock(10,0,0,'UNAVAILABLE');const result=await edit(e,{name:tag+' updated '+e.id});expect(result.status).toBe(200);expect(result.data.status).toBe('UNAVAILABLE');
  });
  test('approved reservations are not borrowed stock during edits',async()=>{
    const e=await stock(10);await booking(e,6);const result=await edit(e,{name:tag+' updated '+e.id,totalQuantity:10,borrowedQuantity:0,damagedQuantity:1});expect(result.status).toBe(200);expect(result.data).toMatchObject({borrowedQuantity:0,availableQuantity:9});
  });
  test('stock reductions that invalidate approvals roll back',async()=>{
    const e=await stock(10);await booking(e,6);expect((await edit(e,{damagedQuantity:5})).status).toBe(409);expect((await db.equipment.findUnique({where:{id:e.id}})).damagedQuantity).toBe(0);
  });
  test('cannot invent borrowed units through equipment create or edit',async()=>{
    const e=await stock();expect((await edit(e,{borrowedQuantity:1})).status).toBe(409);
    expect((await apiRequest('POST','/equipment',{name:tag+'-'+require('node:crypto').randomUUID(),totalQuantity:10,borrowedQuantity:1},token)).status).toBe(400);
  });
  test('equipment counters reject fractions and strings',async()=>{
    const e=await stock();for(const totalQuantity of [1.5,'10',-1,2147483648])expect((await edit(e,{totalQuantity})).status).toBe(400);
  });
  test('adjustment matches preview and excludes damaged or borrowed stock',async()=>{
    const e=await stock(10,2,3);await booking(e,2,'BORROWED');const source=await booking(e,2);const target=await booking(e,6,'PENDING');expect(await preview(e)).toBe(3);
    const r=await apiRequest('POST','/equipment-adjustments/adjust-equipment',{requestId:target.id,approvedRequestId:source.id},token);expect(r.status).toBe(200);expect(r.data.data.adjustments[0].adjustedQuantity).toBe(3);
    expect((await db.borrowRequestItem.findMany({where:{borrowRequestId:target.id}})).map(i=>i.quantity)).toEqual([3]);
  });
  test('zero-capacity adjustment removes the selection',async()=>{
    const e=await stock(1);const source=await booking(e,1);const target=await booking(e,1,'PENDING');
    expect((await apiRequest('POST','/equipment-adjustments/adjust-equipment',{requestId:target.id,approvedRequestId:source.id},token)).status).toBe(200);
    expect(await db.borrowRequestItem.count({where:{borrowRequestId:target.id}})).toBe(0);
  });
  test('return restores stock but preserves unavailable state',async()=>{
    const e=await stock(2,1,0,'UNAVAILABLE');const r=await booking(e,1,'BORROWED');expect((await act(r,'return')).status).toBe(200);
    expect(await db.equipment.findUnique({where:{id:e.id}})).toMatchObject({availableQuantity:2,borrowedQuantity:0,status:'UNAVAILABLE'});
  });
});
