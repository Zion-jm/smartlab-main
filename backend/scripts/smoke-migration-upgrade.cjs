const path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),{spawnSync}=require('child_process');
require('dotenv').config({path:path.join(__dirname,'../.env')});const {PrismaClient}=require('@prisma/client');
async function main(){
 let url;try{url=new URL(process.env.DATABASE_URL)}catch{throw Error('Invalid database configuration')}
 if(!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/smartlab_test')throw Error('Local smartlab_test required');
 const schema='smartlab_upgrade_'+Date.now()+'_'+crypto.randomBytes(4).toString('hex');if(!/^smartlab_upgrade_[0-9]+_[a-f0-9]{8}$/.test(schema))throw Error('Invalid schema');
 const control=new PrismaClient();url.searchParams.set('schema',schema);const env={...process.env,DATABASE_URL:url.toString()};const backend=path.resolve(__dirname,'..');const db=new PrismaClient({datasources:{db:{url:url.toString()}}});
 const run=args=>{const result=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),...args],{cwd:backend,env,stdio:'ignore',windowsHide:true,timeout:60000});assert.equal(result.status,0,'Migration command failed')};
 try{
  await control.$executeRawUnsafe('CREATE SCHEMA "'+schema+'"');
  run(['db','execute','--file','prisma/migrations/0001_baseline/migration.sql','--schema','prisma/schema.prisma']);
  await db.$executeRaw`INSERT INTO equipment (id,name,"totalQuantity","availableQuantity","borrowedQuantity","damagedQuantity",status,"updatedAt") VALUES ('legacy','Legacy unavailable',3,3,0,0,'UNAVAILABLE',CURRENT_TIMESTAMP)`;
  // Adoption is explicit, never performed automatically by application startup.
  run(['migrate','resolve','--applied','0001_baseline']);run(['migrate','deploy']);
  const old=await db.equipment.findUniqueOrThrow({where:{id:'legacy'}});assert.equal(old.totalQuantity,3);assert.ok(old.retiredAt);console.log('PASS: existing baseline adopted; legacy stock and archive intent retained');
  await db.equipment.update({where:{id:'legacy'},data:{retiredAt:null,status:'AVAILABLE'}});run(['migrate','deploy']);assert.equal((await db.equipment.findUniqueOrThrow({where:{id:'legacy'}})).retiredAt,null);console.log('PASS: repeat deployment does not rearchive restored data');
  await assert.rejects(db.equipment.update({where:{id:'legacy'},data:{availableQuantity:-1}}));console.log('PASS: migrated inventory constraint rejects invalid counters');
  run(['migrate','diff','--from-schema-datasource','prisma/schema.prisma','--to-schema-datamodel','prisma/schema.prisma','--exit-code']);console.log('PASS: upgraded schema matches current model');
 }finally{await db.$disconnect();await control.$executeRawUnsafe('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');await control.$disconnect();console.log('Removed isolated upgrade schema.');}
}
main().catch(()=>{console.error('Local migration upgrade rehearsal failed.');process.exitCode=1});
