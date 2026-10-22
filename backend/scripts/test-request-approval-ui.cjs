const { test } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node').register({transpileOnly:true,moduleTypes:{'**/frontend/src/utils/*.ts':'cjs'},compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
const {requestApprovalNotice}=require('../../frontend/src/utils/requestApproval.ts');
const {assertFutureManilaRequestWindow}=require('../dist/utils/manilaTime');
const now=new Date('2026-10-22T10:00:00+08:00');
for(const [name,date,start,blocked] of [
 ['past date','2026-10-21','2026-10-21T15:00:00+08:00',true],
 ['earlier today','2026-10-22','2026-10-22T09:00:00+08:00',true],
 ['exact start','2026-10-22','2026-10-22T10:00:00+08:00',true],
 ['later today','2026-10-22','2026-10-22T11:00:00+08:00',false],
 ['future day','2026-10-23','2026-10-23T08:00:00+08:00',false],
 ['Sunday','2026-10-25','2026-10-25T08:00:00+08:00',true],
 ['UTC date encoding','2026-10-21T16:00:00Z','2026-10-22T03:00:00Z',false],
]) test(name+': UI matches server approval timing',()=>{
 assert.equal(Boolean(requestApprovalNotice({status:'PENDING',dateNeeded:date,timeStart:start},now)),blocked);
 if(blocked) assert.throws(()=>assertFutureManilaRequestWindow(date,start,now));
 else assert.doesNotThrow(()=>assertFutureManilaRequestWindow(date,start,now));
});
test('missing time blocks approval and completed requests do not show pending warnings',()=>{
 assert.ok(requestApprovalNotice({status:'PENDING',dateNeeded:'2026-10-23'},now));
 assert.equal(requestApprovalNotice({status:'APPROVED',dateNeeded:'2026-10-21'},now),null);
});
