const {execFileSync}=require('node:child_process');
const path=require('node:path');
test.each(['UTC','Asia/Manila','America/Los_Angeles','Asia/Tokyo'])('actual frontend/backend utilities agree under %s',tz=>{
  const result=execFileSync(process.execPath,[path.join(__dirname,'support/manila-contract.cjs')],{env:{...process.env,TZ:tz},encoding:'utf8',timeout:60000});
  expect(result).toContain('Manila contract passed: '+tz);
},70000);
