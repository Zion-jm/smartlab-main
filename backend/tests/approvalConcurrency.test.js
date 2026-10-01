const path = require('node:path');
require('dotenv').config({path:path.join(__dirname,'../.env')});
const {PrismaClient}=require('@prisma/client');
const bcrypt=require('bcryptjs');
const {apiRequest,loginAs,BASE_URL}=require('./helpers');

describe('Shared approvals and schedule conflicts on local smartlab_test',()=>{
  let db,admin,faculty,token,facultyToken,profile,year,term;
  const rooms=[],equipment=[],requests=[];
  const tag='approval-race-'+Date.now();
  const date='2035-06-12T00:00:00Z';
  const day=new Date(date).getUTCDay();
  const clock=h=>'2035-06-12T'+String(h).padStart(2,'0')+':00:00+08:00';
  beforeAll(async()=>{
    let d,a;try{d=new URL(process.env.DATABASE_URL);a=new URL(BASE_URL)}catch{throw Error('Invalid test configuration')}
    if(!['localhost','127.0.0.1'].includes(d.hostname)||d.pathname!=='/smartlab_test'||!['localhost','127.0.0.1'].includes(a.hostname))throw Error('Local smartlab_test and API required');
    db=new PrismaClient();
    year=await db.academicYear.findFirst({where:{isActive:true}});term=await db.term.findFirst({where:{isActive:true}});
    if(!year||!term)throw Error('Existing test academic period required');
    const passwordHash=await bcrypt.hash('ApprovalTest123!',10);
    admin=await db.user.create({data:{email:tag+'-admin@smartlab.local',passwordHash,firstName:'Approval',lastName:'Admin',role:'ADMIN'}});
    faculty=await db.user.create({data:{email:tag+'-faculty@smartlab.local',passwordHash,firstName:'Approval',lastName:'Faculty',role:'FACULTY'}});
    profile=await db.facultyProfile.create({data:{userId:faculty.id}});
    token=await loginAs(admin.email,'ApprovalTest123!');facultyToken=await loginAs(faculty.email,'ApprovalTest123!');
  });
  afterAll(async()=>{
    if(!db)return;
    try{
      if(admin)await db.labSchedule.deleteMany({where:{createdBy:admin.id}});
      const ids=[admin?.id,faculty?.id].filter(Boolean);
      await db.notification.deleteMany({where:{userId:{in:ids}}});
      await db.auditLog.deleteMany({where:{actorUserId:{in:ids}}});
      await db.borrowRequest.deleteMany({where:{id:{in:requests}}});
      await db.equipment.deleteMany({where:{id:{in:equipment}}});
      await db.room.deleteMany({where:{id:{in:rooms}}});
      await db.user.deleteMany({where:{id:{in:ids}}});
    }finally{await db.$disconnect()}
  });
  async function room(){const r=await db.room.create({data:{name:tag,isComputerLab:true}});rooms.push(r.id);return r;}
  async function item(total=1,borrowed=0,damaged=0){const e=await db.equipment.create({data:{name:tag,totalQuantity:total,availableQuantity:total-borrowed-damaged,borrowedQuantity:borrowed,damagedQuantity:damaged}});equipment.push(e.id);return e;}
  async function request({r,start=8,end=10,items=[],status='PENDING'}={}){
    r=r||await room();
    const q=await db.borrowRequest.create({data:{requestedBy:admin.id,facultyId:profile.id,roomId:r.id,academicYearId:year.id,termId:term.id,dateNeeded:new Date(date),timeStart:new Date(clock(start)),timeEnd:new Date(clock(end)),status,items:{create:items.map(([e,quantity])=>({equipmentId:e.id,quantity}))}}});requests.push(q.id);return q;
  }
  const approve=(q,route='borrow',auth=token)=>apiRequest('PATCH',route==='borrow'?'/borrow-requests/'+q.id+'/approve':'/lab-schedules/approve-request/'+q.id,null,auth);
  const payload=(r,{start=8,end=10,type='ONE_TIME'}={})=>({roomId:r.id,facultyId:profile.id,academicYearId:year.id,termId:term.id,scheduleType:type,scheduleDate:type==='ONE_TIME'?date:null,dayOfWeek:day,timeStart:clock(start),timeEnd:clock(end)});
  const create=(r,options)=>apiRequest('POST','/lab-schedules/admin/create',payload(r,options),token);
  function oneWinner(results){expect(results.filter(r=>[200,201].includes(r.status))).toHaveLength(1);expect(results.every(r=>[200,201,409].includes(r.status))).toBe(true);}
  test.each(['borrow','schedule'])('%s approval requires admin authentication',async route=>{
    const q=await request();expect((await approve(q,route,null)).status).toBe(401);expect((await approve(q,route,facultyToken)).status).toBe(403);
    expect((await db.borrowRequest.findUnique({where:{id:q.id}})).status).toBe('PENDING');
  });
  test.each(['borrow','schedule'])('%s refuses non-pending requests',async route=>{
    for(const status of ['APPROVED','BORROWED','RETURNED','REJECTED','CANCELLED']){const q=await request({status});expect((await approve(q,route)).status).toBe(409);}
  });
  test('same request approved through both endpoints produces one schedule',async()=>{
    const q=await request();oneWinner(await Promise.all([approve(q),approve(q,'schedule')]));
    expect(await db.labSchedule.count({where:{borrowRequestId:q.id}})).toBe(1);
    expect((await approve(q)).status).toBe(409);
  });
  test.each([1,2,3])('competing approvals for same room round %s',async()=>{
    const r=await room(),a=await request({r}),b=await request({r});oneWinner(await Promise.all([approve(a),approve(b,'schedule')]));
    expect(await db.labSchedule.count({where:{roomId:r.id}})).toBe(1);
  });
  test('preview clearance is rechecked after another approval commits',async()=>{
    const r=await room(),a=await request({r}),b=await request({r});
    const preview=await apiRequest('POST','/conflicts/check',payload(r),token);expect(preview.status).toBe(200);
    expect(preview.data.conflicts.filter(c=>c.type==='lab_schedule')).toHaveLength(0);
    expect((await approve(a)).status).toBe(200);expect((await approve(b,'schedule')).status).toBe(409);
  });
  test.each(['borrow','schedule'])('weekly schedule with null date blocks %s approval and appears in preview',async route=>{
    const r=await room();expect((await create(r,{type:'WEEKLY'})).status).toBe(201);
    const q=await request({r,start:9,end:11});expect((await approve(q,route)).status).toBe(409);
    const preview=await apiRequest('POST','/conflicts/check',payload(r,{start:9,end:11}),token);
    expect(preview.status).toBe(200);expect(preview.data.conflicts.some(c=>c.type==='lab_schedule')).toBe(true);
  });
  test('one-time approval blocks overlapping weekly creation and weekly preview',async()=>{
    const r=await room(),q=await request({r});expect((await approve(q)).status).toBe(200);
    expect((await create(r,{type:'WEEKLY',start:9,end:11})).status).toBe(409);
    const preview=await apiRequest('POST','/conflicts/check',payload(r,{type:'WEEKLY',start:9,end:11}),token);expect(preview.data.hasConflicts).toBe(true);
  });
  test('adjacent room bookings are allowed',async()=>{
    const r=await room(),a=await request({r}),b=await request({r,start:10,end:11});
    expect((await approve(a)).status).toBe(200);expect((await approve(b,'schedule')).status).toBe(200);
  });
  test('manual schedule creation racing approval permits one winner',async()=>{
    const r=await room(),q=await request({r});oneWinner(await Promise.all([create(r),approve(q)]));
    expect(await db.labSchedule.count({where:{roomId:r.id}})).toBe(1);
  });
  test('two manual schedule creates cannot double book',async()=>{
    const r=await room();oneWinner(await Promise.all([create(r),create(r,{type:'WEEKLY'})]));
  });
  test('schedule edit rechecks conflicts and preserves original on failure',async()=>{
    const r=await room();const first=await create(r,{start:8,end:9}),second=await create(r,{start:10,end:11});
    expect(first.status).toBe(201);expect(second.status).toBe(201);
    const changed=await apiRequest('PUT','/lab-schedules/'+second.data.schedule.id,{timeStart:clock(8),timeEnd:clock(9)},token);
    expect(changed.status).toBe(409);
    expect((await db.labSchedule.findUnique({where:{id:second.data.schedule.id}})).timeStart.toISOString()).toBe(new Date(clock(10)).toISOString());
  });
  test('competing equipment approvals in different rooms reserve last unit once',async()=>{
    const e=await item(),a=await request({items:[[e,1]]}),b=await request({items:[[e,1]]});oneWinner(await Promise.all([approve(a),approve(b,'schedule')]));
    expect(await db.equipment.findUnique({where:{id:e.id}})).toMatchObject({availableQuantity:1,borrowedQuantity:0});
    expect(await db.labSchedule.count({where:{borrowRequestId:{in:[a.id,b.id]}}})).toBe(1);
  });
  test('equipment reservations use peak demand, allowing adjacent bookings',async()=>{
    const e=await item(2),a=await request({start:8,end:9,items:[[e,1]]}),b=await request({start:9,end:10,items:[[e,1]]}),c=await request({items:[[e,1]]});
    expect((await approve(a)).status).toBe(200);expect((await approve(b)).status).toBe(200);expect((await approve(c)).status).toBe(200);
  });
  test('borrowed and damaged equipment reduce approval capacity',async()=>{
    const e=await item(3,1,1),q=await request({items:[[e,2]]});expect((await approve(q)).status).toBe(409);
    expect((await db.borrowRequest.findUnique({where:{id:q.id}})).status).toBe('PENDING');expect(await db.labSchedule.count({where:{borrowRequestId:q.id}})).toBe(0);
  });
  test('invalid equipment quantity cannot be approved',async()=>{
    const e=await item(),q=await request({items:[[e,0]]});expect((await approve(q)).status).toBe(400);
  });
  test('linked schedule edit rechecks equipment capacity and rolls back',async()=>{
    const e=await item(),a=await request({start:8,end:9,items:[[e,1]]}),b=await request({start:10,end:11,items:[[e,1]]});
    expect((await approve(a)).status).toBe(200);expect((await approve(b)).status).toBe(200);
    const schedule=await db.labSchedule.findFirst({where:{borrowRequestId:b.id}});
    const edited=await apiRequest('PUT','/lab-schedules/'+schedule.id,{timeStart:clock(8),timeEnd:clock(9)},token);expect(edited.status).toBe(409);
    expect((await db.borrowRequest.findUnique({where:{id:b.id}})).timeStart.toISOString()).toBe(new Date(clock(10)).toISOString());
    expect((await db.labSchedule.findUnique({where:{id:schedule.id}})).timeStart.toISOString()).toBe(new Date(clock(10)).toISOString());
  });
  test('schedule edit racing approval cannot double book the target time',async()=>{
    const r=await room(),created=await create(r,{start:10,end:11}),q=await request({r});
    expect(created.status).toBe(201);
    oneWinner(await Promise.all([apiRequest('PUT','/lab-schedules/'+created.data.schedule.id,{timeStart:clock(8),timeEnd:clock(10)},token),approve(q)]));
  });
  test('Manila morning across UTC midnight conflicts correctly',async()=>{
    const r=await room();expect((await create(r,{start:7,end:10,type:'WEEKLY'})).status).toBe(201);
    const q=await request({r,start:8,end:9});expect((await approve(q)).status).toBe(409);
  });
  test('manual schedules reject overnight ranges rather than missing overlaps',async()=>{
    const r=await room();const body=payload(r);body.timeStart='2035-06-12T23:00:00+08:00';body.timeEnd='2035-06-13T01:00:00+08:00';
    expect((await apiRequest('POST','/lab-schedules/admin/create',body,token)).status).toBe(400);
  });

  test('approved general-room reservation is visible without a derived schedule',async()=>{
    const r=await room();await db.room.update({where:{id:r.id},data:{isComputerLab:false}});
    const q=await request({r});expect((await approve(q)).status).toBe(200);
    expect(await db.labSchedule.count({where:{borrowRequestId:q.id}})).toBe(0);
    const preview=await apiRequest('POST','/conflicts/check',payload(r),token);
    expect(preview.data.conflicts.some(c=>c.type==='borrow_request'&&c.severity==='high')).toBe(true);
    expect((await create(r)).status).toBe(409);
  });

});
