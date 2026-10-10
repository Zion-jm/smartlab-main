const path=require('node:path');
require('dotenv').config({path:path.join(__dirname,'../.env')});
const {PrismaClient}=require('@prisma/client');const bcrypt=require('bcryptjs');
const {apiRequest,loginAs,BASE_URL}=require('./helpers');
const {manilaDayBounds,manilaWeekday}=require('../dist/utils/manilaTime');
describe('Manila API date boundaries on local smartlab_test',()=>{
  let db,admin,token,year,term,profile,room,equipment;
  const tag='manila-api-'+Date.now();const requests=[];
  const day='2035-06-12';const start=new Date(day+'T00:00:00+08:00'),end=new Date('2035-06-13T00:00:00+08:00');
  const times={timeStart:new Date(day+'T07:30:00+08:00'),timeEnd:new Date(day+'T10:00:00+08:00')};
  beforeAll(async()=>{
    let d,a;try{d=new URL(process.env.DATABASE_URL);a=new URL(BASE_URL)}catch{throw Error('Invalid test configuration')}
    if(!['localhost','127.0.0.1'].includes(d.hostname)||d.pathname!=='/smartlab_test'||!['localhost','127.0.0.1'].includes(a.hostname))throw Error('Local smartlab_test/API required');
    db=new PrismaClient();admin=await db.user.create({data:{email:tag+'@smartlab.local',passwordHash:await bcrypt.hash('ManilaTest123!',10),firstName:'Manila',lastName:'Test',role:'ADMIN'}});
    token=await loginAs(admin.email,'ManilaTest123!');profile=await db.facultyProfile.create({data:{userId:admin.id}});
    year=await db.academicYear.create({data:{year:tag}});term=await db.term.create({data:{name:tag}});
    room=await db.room.create({data:{name:tag,isComputerLab:true}});equipment=await db.equipment.create({data:{name:tag,totalQuantity:20,availableQuantity:20}});
  });
  afterAll(async()=>{
    if(!db)return;
    try{
      if(admin){await db.notification.deleteMany({where:{userId:admin.id}});await db.auditLog.deleteMany({where:{actorUserId:admin.id}});await db.labSchedule.deleteMany({where:{createdBy:admin.id}});await db.borrowRequest.deleteMany({where:{requestedBy:admin.id}});}
      if(equipment)await db.equipment.delete({where:{id:equipment.id}});if(room)await db.room.delete({where:{id:room.id}});
      if(year)await db.academicYear.delete({where:{id:year.id}});if(term)await db.term.delete({where:{id:term.id}});if(admin)await db.user.delete({where:{id:admin.id}});
    }finally{await db.$disconnect()}
  });
  const period=()=> 'academicYearId='+year.id+'&termId='+term.id;
  async function request(dateNeeded,status='APPROVED'){
    const r=await db.borrowRequest.create({data:{requestType:'EQUIPMENT',usageLocation:'Test venue',requestedBy:admin.id,academicYearId:year.id,termId:term.id,dateNeeded,status,...times,items:{create:{equipmentId:equipment.id,quantity:1}}}});requests.push(r.id);return r;
  }
  test('audit date filter includes Manila midnight and excludes next midnight',async()=>{
    const dates=[new Date(start.getTime()-1),start,new Date(end.getTime()-1),end];const ids=[];
    for(const createdAt of dates){const row=await db.auditLog.create({data:{actorUserId:admin.id,action:'TIMEZONE_TEST',entityType:'Timezone',entityId:tag,createdAt}});ids.push(row.id);}
    const result=await apiRequest('GET','/audit-logs?actorUserId='+admin.id+'&from='+day+'&to='+day,null,token);
    expect(result.status).toBe(200);expect(result.data.logs.map(r=>r.id).sort()).toEqual([ids[1],ids[2]].sort());
  });
  test('schedule day and range filters support old UTC and Manila midnight records',async()=>{
    const rows=[];
    for(const scheduleDate of [start,new Date(day+'T00:00:00Z'),end])rows.push(await db.labSchedule.create({data:{roomId:room.id,facultyId:profile.id,academicYearId:year.id,termId:term.id,scheduleDate,dayOfWeek:manilaWeekday(scheduleDate),createdBy:admin.id,...times}}));
    const weekly=await db.labSchedule.create({data:{roomId:room.id,facultyId:profile.id,academicYearId:year.id,termId:term.id,scheduleType:'WEEKLY',dayOfWeek:manilaWeekday(start),createdBy:admin.id,...times}});
    for(const filter of ['date='+day,'dateFrom='+day+'&dateTo='+day]){
      const result=await apiRequest('GET','/lab-schedules?'+period()+'&'+filter,null,token);expect(result.status).toBe(200);
      expect(result.data.schedules.map(r=>r.id).sort()).toEqual([rows[0].id,rows[1].id,weekly.id].sort());
    }
  });
  test('request date filters include both encodings and exclude next day',async()=>{
    const a=await request(start),b=await request(new Date(day+'T00:00:00Z'));await request(end);
    const result=await apiRequest('GET','/borrow-requests?'+period()+'&fromDate='+day+'&toDate='+day,null,token);expect(result.status).toBe(200);
    expect(result.data.requests.map(r=>r.id).sort()).toEqual([a.id,b.id].sort());
  });
  test('duplicate detection sees a pending request at Manila midnight',async()=>{
    const faculty=await db.user.create({data:{email:tag+'-faculty@smartlab.local',passwordHash:await bcrypt.hash('ManilaTest123!',10),firstName:'Manila',lastName:'Faculty',role:'FACULTY'}});
    try {
      const facultyToken=await loginAs(faculty.email,'ManilaTest123!');
      const facultyProfile=await db.facultyProfile.create({data:{userId:faculty.id}});
      const activeYear=await db.academicYear.findFirstOrThrow({where:{isActive:true}});
      const activeTerm=await db.term.findFirstOrThrow({where:{isActive:true}});
      const existing=await db.borrowRequest.create({data:{requestedBy:faculty.id,requestType:'EQUIPMENT',facultyId:facultyProfile.id,purpose:'Manila date check',usageLocation:'Test venue',academicYearId:activeYear.id,termId:activeTerm.id,dateNeeded:start,status:'PENDING',...times,items:{create:{equipmentId:equipment.id,quantity:1}}}});
      const result=await apiRequest('POST','/borrow-requests',{requestType:'EQUIPMENT',facultyId:facultyProfile.id,purpose:'Manila date check',usageLocation:'Test venue',academicYearId:activeYear.id,termId:activeTerm.id,dateNeeded:day,timeStart:times.timeStart.toISOString(),timeEnd:times.timeEnd.toISOString(),items:[{equipmentId:equipment.id,quantity:1}]},facultyToken);
      expect(result.status).toBe(409);expect(result.data.existingRequestId).toBe(existing.id);
    } finally {
      await db.borrowRequest.deleteMany({where:{requestedBy:faculty.id}});
      await db.user.delete({where:{id:faculty.id}});
    }
  });
  test('equipment preview includes same-day bookings at Manila midnight',async()=>{
    const result=await apiRequest('POST','/equipment-conflicts/conflicts',{academicYearId:year.id,termId:term.id,date:day,timeStart:'08:00',timeEnd:'09:00',equipment:[{equipmentId:equipment.id,requestedQuantity:1}]},token);
    expect(result.status).toBe(200);const ids=result.data.data.conflicts.flatMap(c=>c.conflictingRequests.map(r=>r.requestId));
    const sameDay=await db.borrowRequest.findMany({where:{id:{in:requests},dateNeeded:{gte:start,lt:end}}});expect(ids.sort()).toEqual(sameDay.map(r=>r.id).sort());
  });
  test('today statistics use exclusive next Manila midnight',async()=>{
    const today=manilaDayBounds(new Date());await request(today.start);await request(new Date(today.end.getTime()-1));await request(today.end);
    const result=await apiRequest('GET','/equipment/stats/overview?'+period(),null,token);expect(result.status).toBe(200);
    expect(result.data.today.quantityReserved).toBe(2);expect(result.data.upcoming.quantity).toBe(1);
  });
  test('equipment summaries count requests, exclude room-only pending and archived availability',async()=>{
    const endpoint='/equipment/stats/overview?'+period();
    const before=(await apiRequest('GET',endpoint,null,token)).data;
    const extra=await db.equipment.create({data:{name:tag+'-summary',totalQuantity:6,availableQuantity:6}});
    const ids=[];
    try {
      const base={requestedBy:admin.id,academicYearId:year.id,termId:term.id,dateNeeded:manilaDayBounds(new Date()).end,...times};
      for(const data of [
        {...base,requestType:'LABORATORY',roomId:room.id,status:'PENDING'},
        {...base,requestType:'EQUIPMENT',usageLocation:'Summary test',status:'PENDING',items:{create:[{equipmentId:extra.id,quantity:1}]}},
        {...base,requestType:'EQUIPMENT',usageLocation:'Summary test',status:'APPROVED',items:{create:[{equipmentId:extra.id,quantity:2},{equipmentId:equipment.id,quantity:3}]}}
      ]) ids.push((await db.borrowRequest.create({data})).id);
      let result=await apiRequest('GET',endpoint,null,token);
      expect(result.status).toBe(200);
      expect(result.data.pendingRequests).toBe(before.pendingRequests+1);
      expect(result.data.upcoming.requests).toBe(before.upcoming.requests+1);
      expect(result.data.upcoming.quantity).toBe(before.upcoming.quantity+5);
      expect(result.data.inventory.availableQuantity).toBe(before.inventory.availableQuantity+6);
      await db.equipment.update({where:{id:extra.id},data:{retiredAt:new Date(),status:'UNAVAILABLE'}});
      result=await apiRequest('GET',endpoint,null,token);
      expect(result.data.inventory.availableQuantity).toBe(before.inventory.availableQuantity);
      expect(result.data.inventory.totalQuantity).toBe(before.inventory.totalQuantity+6);
      expect(result.data.inventory.archivedQuantity).toBe(before.inventory.archivedQuantity+6);
      const inventory=result.data.inventory;
      expect(inventory.availableQuantity+inventory.borrowedQuantity+inventory.damagedQuantity+inventory.archivedQuantity).toBe(inventory.totalQuantity);
    } finally {
      await db.borrowRequest.deleteMany({where:{id:{in:ids}}});
      await db.equipment.delete({where:{id:extra.id}});
    }
  });
  test('admin planner uses peak reservations and keeps pending demand advisory',async()=>{
    const item=await db.equipment.create({data:{name:tag+'-planner',totalQuantity:10,availableQuantity:8,borrowedQuantity:2}});
    const ids=[];
    try {
      for(const [status,from,to,quantity] of [['APPROVED','08:00','09:00',3],['APPROVED','09:00','10:00',4],['PENDING','08:00','10:00',5],['BORROWED','08:00','09:00',2]]) {
        ids.push((await db.borrowRequest.create({data:{requestType:'EQUIPMENT',usageLocation:'Planner venue',requestedBy:admin.id,academicYearId:year.id,termId:term.id,dateNeeded:start,status,timeStart:new Date(day+'T'+from+':00+08:00'),timeEnd:new Date(day+'T'+to+':00+08:00'),items:{create:{equipmentId:item.id,quantity}}}})).id);
      }
      let result=await apiRequest('GET','/equipment-conflicts/planning?date='+day,null,token);
      expect(result.status).toBe(200);
      let row=result.data.data.find(r=>r.id===item.id);
      expect(row).toMatchObject({reserved:4,pending:5,checkedOut:2,available:4,usable:10});
      expect(row.requests).toHaveLength(4);expect(row.requests[0].location).toBe('Planner venue');
      result=await apiRequest('GET','/equipment-conflicts/planning?date='+day+'&timeStart=08:00&timeEnd=09:00',null,token);
      row=result.data.data.find(r=>r.id===item.id);expect(row.reserved).toBe(3);expect(row.available).toBe(5);
      await db.equipment.update({where:{id:item.id},data:{retiredAt:new Date(),status:'UNAVAILABLE'}});
      result=await apiRequest('GET','/equipment-conflicts/planning?date='+day,null,token);
      expect(result.data.data.find(r=>r.id===item.id).available).toBe(0);
      expect((await apiRequest('GET','/equipment-conflicts/planning?date=2035-02-30',null,token)).status).toBe(400);
      expect((await apiRequest('GET','/equipment-conflicts/planning?date='+day+'&timeStart=09:00&timeEnd=08:00',null,token)).status).toBe(400);
      expect((await apiRequest('GET','/equipment-conflicts/planning?date='+day,null,null)).status).toBe(401);
    } finally {await db.borrowRequest.deleteMany({where:{id:{in:ids}}});await db.equipment.delete({where:{id:item.id}});}
  });
  test('invalid date-only inputs return validation errors',async()=>{
    expect((await apiRequest('GET','/audit-logs?from=2035-02-30',null,token)).status).toBe(400);
    expect((await apiRequest('GET','/lab-schedules?dateFrom=2035-02-30',null,token)).status).toBe(400);
  });
});
