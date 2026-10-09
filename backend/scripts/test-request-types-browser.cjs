// Real Chromium + isolated local database, never the existing application schema.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),{spawn,spawnSync}=require('child_process');
require('dotenv').config({path:path.join(__dirname,'../.env')});const {PrismaClient}=require('@prisma/client'),bcrypt=require('bcryptjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
async function main(){
 const url=new URL(process.env.DATABASE_URL);assert.ok(['localhost','127.0.0.1'].includes(url.hostname),'Local database required');url.pathname='/smartlab_test';const out=path.resolve(__dirname,'../../artifacts/request-types');fs.mkdirSync(out,{recursive:true});
 const schema='smartlab_ribbon_'+Date.now()+'_'+crypto.randomBytes(4).toString('hex');assert.match(schema,/^smartlab_ribbon_\d+_[a-f0-9]{8}$/);const owner=new PrismaClient({datasources:{db:{url:url.toString()}}});url.searchParams.set('schema',schema);const env={...process.env,DATABASE_URL:url.toString(),PORT:'3137',NODE_ENV:'production',FRONTEND_URL:'http://localhost:3137',JWT_SECRET:crypto.randomBytes(32).toString('hex'),SMTP_PASS:'',EMAIL_DELIVERY_ENABLED:'false'};const backend=path.resolve(__dirname,'..');let db,server,browser;const errors=[];
 try{
 const m=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy'],{cwd:backend,env,stdio:'ignore',windowsHide:true,timeout:60000});assert.equal(m.status,0,'Migrations');db=new PrismaClient({datasources:{db:{url:url.toString()}}});
 const year=await db.academicYear.create({data:{year:'2026-2027',isActive:true}}),term=await db.term.create({data:{name:'First semester',isActive:true}});const password=crypto.randomBytes(16).toString('hex'),passwordHash=await bcrypt.hash(password,10),users={};for(const role of ['ADMIN','FACULTY','STUDENT'])users[role]=await db.user.create({data:{email:role.toLowerCase()+'@ribbon.invalid',firstName:role,lastName:'Review',passwordHash,role}});
 const faculty=await db.facultyProfile.create({data:{userId:users.FACULTY.id}});const program=await db.program.create({data:{code:'TEST',name:'Test program'}});await db.studentProfile.create({data:{userId:users.STUDENT.id,programId:program.id,yearLevel:1}});const room=await db.room.create({data:{name:'Computer laboratory',roomNumber:'101',isComputerLab:true}});await db.equipment.createMany({data:Array.from({length:35},(_,i)=>({name:'Ribbon equipment '+i,totalQuantity:5,availableQuantity:5}))});
 server=spawn(process.execPath,['dist/server.js'],{cwd:backend,env,stdio:'ignore',windowsHide:true});for(let i=0;i<600;i++){try{if((await fetch('http://localhost:3137/ready')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}assert.equal((await fetch('http://localhost:3137/ready')).status,200);
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});

 const auths={};
 for(const role of ['ADMIN','FACULTY','STUDENT']){
 const login=await fetch('http://localhost:3137/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:users[role].email,password})});assert.equal(login.status,200);auths[role]=await login.json();
 const context=await browser.newContext({viewport:{width:390,height:844}});await context.addInitScript(auth=>{localStorage.setItem('token',auth.token);localStorage.setItem('auth-storage',JSON.stringify({state:{...auth,isAuthenticated:true},version:0}))},auths[role]);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:3137/'+(role==='ADMIN'?'admin/requests':role.toLowerCase()+'/panel'));await page.waitForLoadState('networkidle');
 if(role==='STUDENT'){assert.equal(await page.getByRole('button',{name:'Computer Lab',exact:true}).count(),0);await page.getByText('Equipment borrowing',{exact:true}).waitFor();}
 if(role==='FACULTY'){await page.getByRole('button',{name:'Computer Lab',exact:true}).click();await page.getByRole('button',{name:'Equipment',exact:true}).click();}
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,role+' mobile overflow');await page.screenshot({path:path.join(out,role.toLowerCase()+'.png'),fullPage:true});await context.close();console.log('PASS browser:',role);
 }
 const api=async(role,method,route,body,status)=>{const r=await fetch('http://localhost:3137/api/borrow-requests'+route,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+auths[role].token},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,status,method+' '+route+' '+JSON.stringify(data));return data;};
 const equipment=await db.equipment.findFirst();const base={facultyId:faculty.id,dateNeeded:'2035-06-12',timeStart:'2035-06-12T09:00:00+08:00',timeEnd:'2035-06-12T10:00:00+08:00',purpose:'Local API test',academicYearId:year.id,termId:term.id};
 await api('ADMIN','POST','',{...base,requestType:'EQUIPMENT',usageRoomId:room.id,items:[{equipmentId:equipment.id,quantity:1}]},403);
 await api('STUDENT','POST','',{...base,requestType:'LABORATORY',roomId:room.id,items:[]},403);
 await api('STUDENT','POST','',{...base,requestType:'EQUIPMENT',usageRoomId:room.id,items:[]},400);
 const lab=await api('FACULTY','POST','',{...base,requestType:'LABORATORY',roomId:room.id,items:[]},201);
 await api('ADMIN','PATCH','/'+lab.request.id+'/approve',{},200);
 const countBeforeConflict=await db.borrowRequest.count();
 await api('FACULTY','POST','',{...base,requestType:'LABORATORY',roomId:room.id,items:[]},409);
 assert.equal(await db.borrowRequest.count(),countBeforeConflict,'Conflicting submission must roll back');
 const subject=await db.subject.create({data:{code:'CONFLICT',name:'Conflict test subject'}});
 const later={...base,programId:program.id,subjectId:subject.id,timeStart:'2035-06-12T10:00:00+08:00',timeEnd:'2035-06-12T11:00:00+08:00',requestType:'LABORATORY',roomId:room.id,items:[]};
 const editable=await api('FACULTY','POST','',later,201);
 await api('FACULTY','PUT','/'+editable.request.id,{...later,timeStart:base.timeStart,timeEnd:base.timeEnd},409);
 assert.equal((await db.borrowRequest.findUnique({where:{id:editable.request.id}})).timeStart.toISOString(),new Date(later.timeStart).toISOString(),'Conflicting edit must preserve original time');

 const loan=await api('STUDENT','POST','',{...base,requestType:'EQUIPMENT',usageRoomId:room.id,items:[{equipmentId:equipment.id,quantity:1}]},201);
 await api('ADMIN','PUT','/'+loan.request.id,{...base,requestType:'EQUIPMENT',usageRoomId:room.id,items:[{equipmentId:equipment.id,quantity:1}]},403);
 assert.equal(loan.request.roomId,null);assert.equal(loan.request.usageRoomId,room.id);
 await api('STUDENT','PUT','/'+loan.request.id,{...base,requestType:'LABORATORY',roomId:room.id,items:[]},403);
 await api('ADMIN','PATCH','/'+loan.request.id+'/approve',{},200);
 assert.equal(await db.labSchedule.count({where:{borrowRequestId:loan.request.id}}),0);
 assert.equal(await db.labSchedule.count({where:{borrowRequestId:lab.request.id}}),1);
 assert.equal(errors.length,0,errors.join('; '));console.log('PASS HTTP: student permissions, required items, faculty lab approval, equipment usage in occupied lab, edit protection.');
 }finally{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));}if(db)await db.$disconnect();await owner.$executeRawUnsafe('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');await owner.$disconnect();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
