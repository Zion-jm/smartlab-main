const {PrismaClient}=require('@prisma/client');
const {assertLocalTestEnvironment,cleanupFixtures}=require('./support/localFixtureCleanup');
const {inventoryTransaction}=require('../dist/services/inventoryTransaction');
const {assertAccountDeactivationAllowed}=require('../dist/services/adminAccessProtection');
let db;const ids=[];
beforeAll(()=>{assertLocalTestEnvironment();db=new PrismaClient();});
afterAll(async()=>{await cleanupFixtures({userIds:ids});await db?.$disconnect();});
test('simultaneous administrators cannot deactivate each other',async()=>{
 const tag='admin-race-'+Date.now();
 for(const suffix of ['a','b']){const user=await db.user.create({data:{activationState: 'LEGACY', email:tag+suffix+'@example.test',firstName:'Test',lastName:'Admin',role:'ADMIN',status:'ACTIVE',passwordHash:'unused'}});ids.push(user.id);}
 let arrivals=0,release;const gate=new Promise(resolve=>{release=resolve;});
 const deactivate=(actorId,targetId)=>{let first=true;return inventoryTransaction(db,async tx=>{
  await assertAccountDeactivationAllowed(tx,targetId,actorId,'DEACTIVATED');
  if(first){first=false;if(++arrivals===2)release();await gate;}
  return tx.user.update({where:{id:targetId},data:{status:'DEACTIVATED',sessionVersion:{increment:1}}});
 });};
 const results=await Promise.allSettled([deactivate(ids[0],ids[1]),deactivate(ids[1],ids[0])]);
 expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
 expect(await db.user.count({where:{id:{in:ids},status:'ACTIVE'}})).toBe(1);
});
