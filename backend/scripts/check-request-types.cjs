// Read-only deployment preflight. Does not print credentials or request contents.
require('dotenv').config();
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
(async()=>{
 const rows=await db.$queryRawUnsafe('SELECT "requestType"::text AS type, count(*)::int AS count FROM borrow_requests GROUP BY "requestType" ORDER BY "requestType"');
 console.log('Request counts by type:',JSON.stringify(rows));
 if(rows.some(row=>row.type==='LEGACY'&&row.count>0)){console.error('BLOCKED: LEGACY records remain. Review them before deployment.');process.exitCode=1;}
 else console.log('PASS: no LEGACY records; removal precondition satisfied.');
})().catch(()=>{console.error('Could not verify request types; do not assume the database is ready.');process.exitCode=1;}).finally(()=>db.$disconnect());
