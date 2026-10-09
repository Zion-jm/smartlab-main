// Read-only: uses DATABASE_URL, never changes equipment.
require('dotenv').config();
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
(async()=>{
 const duplicates=await db.$queryRaw`SELECT lower(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g'))) AS name,
 count(*)::int AS count, array_agg(id ORDER BY id) AS ids FROM equipment GROUP BY 1 HAVING count(*) > 1`;
 const invalid=await db.$queryRaw`SELECT id, name FROM equipment WHERE length(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g'))) = 0
 OR length(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g'))) > 150 OR length(description) > 1000`;
 console.log('Duplicate names (including archived):', JSON.stringify(duplicates,null,2));
 console.log('Names/descriptions needing review:', JSON.stringify(invalid,null,2));
 if(duplicates.length || invalid.length) process.exitCode=1;
 else console.log('PASS: equipment data meets the new text and uniqueness rules.');
})().catch(()=>{console.error('Could not check equipment data. Check the database connection.');process.exitCode=1;}).finally(()=>db.$disconnect());
