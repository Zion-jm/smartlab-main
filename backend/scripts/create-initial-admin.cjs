// Explicit one-time initialization. Never called during install, build or startup.
require('dotenv').config({path:require('path').join(__dirname,'../.env')});
const {PrismaClient}=require('@prisma/client');const bcrypt=require('bcryptjs');
async function main(){
  if(process.env.CONFIRM_INITIAL_ADMIN!=='CREATE')throw Error('Set CONFIRM_INITIAL_ADMIN=CREATE explicitly.');
  const email=process.env.INITIAL_ADMIN_EMAIL,password=process.env.INITIAL_ADMIN_PASSWORD;
  if(!email||!email.includes('@')||!password||password.length<12)throw Error('Supply INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (at least 12 characters) as temporary secrets.');
  const db=new PrismaClient();
  try{const passwordHash=await bcrypt.hash(password,12);
    await db.$transaction(async tx=>{
      // Serialize bootstrap attempts, including on an empty users table.
      await tx.$executeRawUnsafe('LOCK TABLE "users" IN EXCLUSIVE MODE');
      if(await tx.user.count({where:{role:'ADMIN'}}))throw Error('An administrator already exists. Use account management.');
      await tx.user.create({data:{email,passwordHash,firstName:'System',lastName:'Administrator',role:'ADMIN',adminProfile:{create:{}}}});
    });
    console.log('Initial administrator created. Remove temporary bootstrap secrets.');
  }finally{await db.$disconnect()}
}
main().catch(()=>{console.error('Administrator initialization refused or failed. Check confirmation, credentials and existing administrators; no password is printed.');process.exitCode=1});
