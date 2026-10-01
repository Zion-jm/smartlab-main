const path=require('path');
require('dotenv').config({path:path.join(__dirname,'../../.env')});
const {PrismaClient}=require('@prisma/client');
const {BASE_URL}=require('../helpers');
function assertLocalTestEnvironment(){
  let database,api;try{database=new URL(process.env.DATABASE_URL);api=new URL(BASE_URL)}catch{throw Error('Invalid test configuration')}
  if(!['localhost','127.0.0.1'].includes(database.hostname)||database.pathname!=='/smartlab_test'||!['localhost','127.0.0.1'].includes(api.hostname))throw Error('Local smartlab_test/API required');
}
// Call only with IDs returned when this test created its own disposable fixtures.
async function cleanupFixtures({userIds=[],equipmentIds=[]}){
  assertLocalTestEnvironment();const db=new PrismaClient();
  try{
    await db.$transaction(async tx=>{
      await tx.auditLog.deleteMany({where:{OR:[{entityType:'User',entityId:{in:userIds}},{entityType:'Equipment',entityId:{in:equipmentIds}}]}});
      await tx.user.deleteMany({where:{id:{in:userIds}}});
      await tx.equipment.deleteMany({where:{id:{in:equipmentIds}}});
    });
  }finally{await db.$disconnect()}
}
module.exports={assertLocalTestEnvironment,cleanupFixtures};
