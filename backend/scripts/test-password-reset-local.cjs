const assert=require('node:assert/strict');
const {prisma}=require('../dist/db/prisma');
const {requestPasswordReset,resetPassword}=require('../dist/services/passwordResetService');
(async()=>{
 let known=true, recent=0, cooldown=false, valid=true, claimed=true, version=1, updates=0, mails=0, tokenHash='';
 const tx={
 $queryRaw:async(parts,...values)=>{const sql=parts.join('');if(sql.includes('FROM "users"'))return known?[{id:'user',email:'test@example.invalid',sessionVersion:version}]:[];if(sql.includes('COUNT'))return [{count:BigInt(recent)}];if(sql.includes('INTERVAL'))return cooldown?[{tokenHash:'x'}]:[];return valid?[{userId:'user',sessionVersion:1}]:[];},
 $executeRaw:async(parts,...values)=>{const sql=parts.join('');if(sql.includes('INSERT INTO "PasswordReset"')){tokenHash=values[0];assert.match(tokenHash,/^[a-f0-9]{64}$/);}if(sql.includes('INSERT INTO "EmailOutbox"'))mails++;if(sql.includes('AND "expiresAt">NOW()'))return claimed?1:0;return 1;},
 user:{update:async({data})=>{assert(!('status' in data));assert.equal(data.sessionVersion.increment,1);updates++;version++;}},
 auditLog:{create:async()=>({})}
 };
 prisma.$transaction=async fn=>fn(tx);
 known=false;await requestPasswordReset('unknown@example.invalid');assert.equal(mails,0);
 known=true;await requestPasswordReset('test@example.invalid');assert.equal(mails,1);
 cooldown=true;await requestPasswordReset('test@example.invalid');assert.equal(mails,1);
 cooldown=false;recent=3;await requestPasswordReset('test@example.invalid');assert.equal(mails,1);
 valid=false;await assert.rejects(resetPassword('a'.repeat(64),'new-password'));assert.equal(updates,0);
 valid=true;claimed=false;await assert.rejects(resetPassword('a'.repeat(64),'new-password'));assert.equal(updates,0);
 claimed=true;await resetPassword('a'.repeat(64),'new-password');assert.equal(updates,1);assert.equal(mails,2);
 await assert.rejects(resetPassword('a'.repeat(64),'another-password'));assert.equal(updates,1);
 console.log('Passed: unknown email, cooldown, account rate limit, invalid/expired/consumed links, session invalidation, no status change, confirmation email. No real emails or database writes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
