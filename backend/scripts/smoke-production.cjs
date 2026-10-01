// Local-only production rehearsal. Creates and removes a uniquely named schema.
const path=require('path'),fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');
const {spawn,spawnSync}=require('child_process');
require('dotenv').config({path:path.join(__dirname,'../.env')});
const {PrismaClient}=require('@prisma/client');const bcrypt=require('bcryptjs');
const backend=path.resolve(__dirname,'..');
async function main(){
  let url;try{url=new URL(process.env.DATABASE_URL)}catch{throw Error('Invalid database configuration')}
  if(!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/smartlab_test')throw Error('Local smartlab_test required');
  const schema='smartlab_deploy_'+Date.now()+'_'+crypto.randomBytes(4).toString('hex');
  if(!/^smartlab_deploy_[0-9]+_[a-f0-9]{8}$/.test(schema))throw Error('Invalid test schema');
  const original=new PrismaClient();url.searchParams.set('schema',schema);
  const env={...process.env,DATABASE_URL:url.toString(),JWT_SECRET:crypto.randomBytes(32).toString('hex'),NODE_ENV:'production',PORT:'3121',FRONTEND_URL:'http://localhost:3121',SMTP_PASS:''};
  const chrome=process.env.CHROMIUM_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].find(p=>fs.existsSync(p));
  if(!chrome)throw Error('Configure CHROMIUM_PATH for the PDF smoke test');env.CHROMIUM_PATH=chrome;
  let db,server;let stage='initialization';
  const run=args=>{const r=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),...args],{cwd:backend,env,encoding:'utf8',windowsHide:true,timeout:60000});if(r.status!==0)throw Error('Prisma command failed at '+stage);return r.stdout};
  try{
    stage='fresh migration deploy';run(['migrate','deploy']);console.log('PASS: migrations deploy to a fresh isolated schema');
    stage='repeat migration deploy';run(['migrate','deploy']);run(['migrate','status']);console.log('PASS: repeated deploy and migration status');
    db=new PrismaClient({datasources:{db:{url:url.toString()}}});
    assert.equal(await db.user.count(),0);assert.equal(await db.equipment.count(),0);console.log('PASS: no automatic seed data');
    const password=crypto.randomBytes(18).toString('base64url');const bootstrapEnv={...env,CONFIRM_INITIAL_ADMIN:'CREATE',INITIAL_ADMIN_EMAIL:'smoke@example.invalid',INITIAL_ADMIN_PASSWORD:password};
    const bootstrap=extra=>spawnSync(process.execPath,['scripts/create-initial-admin.cjs'],{cwd:backend,env:{...bootstrapEnv,...extra},stdio:'ignore',windowsHide:true,timeout:20000}).status;
    assert.notEqual(bootstrap({CONFIRM_INITIAL_ADMIN:''}),0);assert.equal(bootstrap({}),0);assert.notEqual(bootstrap({}),0);
    const user=await db.user.findUniqueOrThrow({where:{email:'smoke@example.invalid'}});console.log('PASS: explicit admin bootstrap, confirmation guard and duplicate refusal');
    await db.equipment.create({data:{name:'Smoke equipment',totalQuantity:1,availableQuantity:1}});
    stage='production server startup';server=spawn(process.execPath,['scripts/start-production.cjs'],{cwd:backend,env,stdio:'ignore',windowsHide:true});
    const base='http://localhost:3121';let ready=false;
    for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error('Production process exited');try{const r=await fetch(base+'/ready');if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}
    assert.ok(ready,'Readiness timeout');console.log('PASS: production startup and database readiness');
    for(const route of ['/','/admin/dashboard','/admin/requests']){const r=await fetch(base+route);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),new RegExp('text/html'));const html=await r.text();assert.ok(html.includes('id="root"'));if(route==='/'){const asset=html.match(/src="([^" ]+.js)"/);assert.ok(asset);const js=await fetch(base+asset[1]);assert.equal(js.status,200);assert.match(js.headers.get('cache-control'),/immutable/);assert.ok(!(await js.text()).includes('/@vite/client'))}}
    console.log('PASS: built React app, deep links and immutable JavaScript assets');
    for(const route of ['/api/not-a-route','/api/test-db']){const r=await fetch(base+route);assert.equal(r.status,404);assert.match(r.headers.get('content-type'),/json/)}
    assert.equal((await fetch(base+'/assets/missing.js')).status,404);console.log('PASS: unknown API and asset paths do not serve SPA HTML');
    const denied=await fetch(base+'/api/equipment',{headers:{Origin:'https://untrusted.example'}});assert.equal(denied.headers.get('access-control-allow-origin'),null);
    const allowed=await fetch(base+'/api/equipment',{headers:{Origin:env.FRONTEND_URL}});assert.equal(allowed.headers.get('access-control-allow-origin'),env.FRONTEND_URL);console.log('PASS: production CORS allows configured origin only');
    stage='login';const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password})});assert.equal(login.status,200);const token=(await login.json()).token;const headers={Authorization:'Bearer '+token};
    assert.equal((await fetch(base+'/api/auth/me',{headers})).status,200);assert.equal((await fetch(base+'/api/equipment',{headers})).status,200);console.log('PASS: production login and authenticated API calls');
    stage='PDF generation';const pdf=await fetch(base+'/api/reports/equipment.pdf',{headers});assert.equal(pdf.status,200);assert.match(pdf.headers.get('content-type'),new RegExp('application/pdf'));const bytes=Buffer.from(await pdf.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.ok(bytes.length>1000);console.log('PASS: authenticated equipment PDF generated ('+bytes.length+' bytes)');
    stage='schema comparison';run(['migrate','diff','--from-schema-datasource','prisma/schema.prisma','--to-schema-datamodel','prisma/schema.prisma','--exit-code']);console.log('PASS: migrated schema matches current Prisma model');
  }catch(error){throw Error('Production rehearsal failed during '+stage+': '+(error instanceof assert.AssertionError?error.message:'see local configuration/dependencies'))}
  finally{
    if(server && server.exitCode===null){server.kill('SIGTERM');await Promise.race([new Promise(r=>server.once('exit',r)),new Promise(r=>setTimeout(r,12000))]);if(server.exitCode===null)server.kill('SIGKILL')}
    if(db)await db.$disconnect();
    // Identifier generated above; never supplied by the user or derived from a URL.
    await original.$executeRawUnsafe('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');await original.$disconnect();console.log('Removed isolated rehearsal schema; existing application data unchanged.');
  }
}
main().catch(e=>{console.error(e.message);process.exitCode=1});

