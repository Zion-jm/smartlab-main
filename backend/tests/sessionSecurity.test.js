const path=require('path');require('dotenv').config({path:path.join(__dirname,'../.env')});
const {PrismaClient}=require('@prisma/client'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken');const {apiRequest,loginAs,BASE_URL}=require('./helpers');
describe('session invalidation on local smartlab_test',()=>{
  let db,admin,adminToken;const users=[];const tag='sessions-'+Date.now();const password='SessionTest123!';
  beforeAll(async()=>{let d,a;try{d=new URL(process.env.DATABASE_URL);a=new URL(BASE_URL)}catch{throw Error('Invalid test configuration')};if(!['localhost','127.0.0.1'].includes(d.hostname)||d.pathname!=='/smartlab_test'||!['localhost','127.0.0.1'].includes(a.hostname))throw Error('Local test database/API required');db=new PrismaClient();admin=await create();adminToken=await loginAs(admin.email,password)});
  async function create(role='ADMIN'){const u=await db.user.create({data:{email:tag+'-'+users.length+'@smartlab.local',passwordHash:await bcrypt.hash(password,10),firstName:'Session',lastName:'Test',role}});users.push(u.id);return u}
  afterAll(async()=>{if(!db)return;try{await db.auditLog.deleteMany({where:{actorUserId:{in:users}}});await db.notification.deleteMany({where:{userId:{in:users}}});await db.user.deleteMany({where:{id:{in:users}}})}finally{await db.$disconnect()}});
  const me=t=>apiRequest('GET','/auth/me',null,t);
  const status=(u,s)=>apiRequest('PATCH','/users/'+u.id+'/status',{status:s},adminToken);
  test('deactivation blocks an existing token, login and protected mutations',async()=>{
    const u=await create(),t=await loginAs(u.email,password);expect((await status(u,'DEACTIVATED')).status).toBe(200);
    expect((await me(t)).status).toBe(401);expect((await apiRequest('POST','/auth/login',{email:u.email,password})).status).toBe(403);
    expect((await apiRequest('POST','/equipment',{name:tag,totalQuantity:1},t)).status).toBe(401);
  });
  test('reactivation never resurrects an old token',async()=>{const u=await create(),t=await loginAs(u.email,password);await status(u,'DEACTIVATED');await status(u,'ACTIVE');expect((await me(t)).status).toBe(401);expect((await me(await loginAs(u.email,password))).status).toBe(200)});
  test('password change ends all previous sessions and allows new password',async()=>{
    const u=await create(),a=await loginAs(u.email,password),b=await loginAs(u.email,password);
    expect((await apiRequest('PATCH','/auth/password',{currentPassword:password,newPassword:'ChangedTest123!'},a)).status).toBe(200);
    for(const t of [a,b])expect((await me(t)).status).toBe(401);
    expect((await apiRequest('POST','/auth/login',{email:u.email,password})).status).toBe(401);expect((await me(await loginAs(u.email,'ChangedTest123!'))).status).toBe(200);
  });
  test('wrong current password preserves session and password',async()=>{const u=await create(),t=await loginAs(u.email,password);expect((await apiRequest('PATCH','/auth/password',{currentPassword:'wrong',newPassword:'ChangedTest123!'},t)).status).toBe(400);expect((await me(t)).status).toBe(200)});
  test('concurrent password changes have only one winner',async()=>{const u=await create(),t=await loginAs(u.email,password);const results=await Promise.all(['ChangedOne123!','ChangedTwo123!'].map(newPassword=>apiRequest('PATCH','/auth/password',{currentPassword:password,newPassword},t)));expect(results.filter(r=>r.status===200)).toHaveLength(1);expect(results.every(r=>[200,400,401,409].includes(r.status))).toBe(true);expect((await me(t)).status).toBe(401)});
  test('administrator revocation ends sessions without deactivation',async()=>{const u=await create(),t=await loginAs(u.email,password);expect((await apiRequest('POST','/users/'+u.id+'/revoke-sessions',{},adminToken)).status).toBe(200);expect((await me(t)).status).toBe(401);expect((await me(await loginAs(u.email,password))).status).toBe(200)});
  test('revocation is protected from anonymous and non-admin users',async()=>{const u=await create('STUDENT'),t=await loginAs(u.email,password);expect((await apiRequest('POST','/users/'+admin.id+'/revoke-sessions',{})).status).toBe(401);expect((await apiRequest('POST','/users/'+admin.id+'/revoke-sessions',{},t)).status).toBe(403);expect((await me(adminToken)).status).toBe(200)});
  test('unknown revocation target returns 404',async()=>{expect((await apiRequest('POST','/users/missing-'+tag+'/revoke-sessions',{},adminToken)).status).toBe(404)});
  test('profile-only edits preserve sessions',async()=>{const u=await create(),t=await loginAs(u.email,password);expect((await apiRequest('PUT','/users/'+u.id,{firstName:'Updated'},t)).status).toBe(200);expect((await me(t)).status).toBe(200)});
  test('general user update deactivates and revokes',async()=>{const u=await create(),t=await loginAs(u.email,password);expect((await apiRequest('PUT','/users/'+u.id,{status:'DEACTIVATED'},adminToken)).status).toBe(200);expect((await me(t)).status).toBe(401)});
  test('role change revokes old token and uses current database role',async()=>{
    const u=await create('STUDENT'),t=await loginAs(u.email,password);expect((await apiRequest('PUT','/users/'+u.id,{role:'ADMIN'},adminToken)).status).toBe(200);expect((await me(t)).status).toBe(401);
    const fresh=await loginAs(u.email,password);expect((await apiRequest('GET','/users',null,fresh)).status).toBe(200);
    await db.user.update({where:{id:u.id},data:{role:'STUDENT'}});expect((await apiRequest('GET','/users',null,fresh)).status).toBe(403);
  });
  test('email change revokes old sessions',async()=>{const u=await create(),t=await loginAs(u.email,password);expect((await apiRequest('PUT','/users/'+u.id,{email:'new-'+u.email},adminToken)).status).toBe(200);expect((await me(t)).status).toBe(401)});
  test('non-admin cannot change own status or role',async()=>{const u=await create('STUDENT'),t=await loginAs(u.email,password);await apiRequest('PUT','/users/'+u.id,{role:'ADMIN',status:'DEACTIVATED'},t);expect(await db.user.findUnique({where:{id:u.id}})).toMatchObject({role:'STUDENT',status:'ACTIVE'});expect((await apiRequest('GET','/users',null,t)).status).toBe(403)});
  test('legacy tokens without a session version are rejected',async()=>{const t=jwt.sign({userId:admin.id,role:'ADMIN'},process.env.JWT_SECRET,{expiresIn:'1h'});const r=await me(t);expect(r.status).toBe(401);expect(r.data.code).toBe('SESSION_INVALID')});
  test('deleted users cannot reuse tokens',async()=>{const u=await create(),t=await loginAs(u.email,password);await db.user.delete({where:{id:u.id}});expect((await me(t)).status).toBe(401)});
  test('database deactivation is checked even without a version change',async()=>{const u=await create(),t=await loginAs(u.email,password);await db.user.update({where:{id:u.id},data:{status:'DEACTIVATED'}});expect((await me(t)).status).toBe(401)});
});
