const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { validateTestDatabase } = require('./test-environment.cjs');
const backend = path.resolve(__dirname, '..');
const resolveTool = name => require.resolve(name, { paths: [backend] });
async function run(args, env) {
  const child = spawn(process.execPath, args, { cwd: backend, env, stdio: 'inherit', windowsHide: true });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  if (code !== 0) throw Error('Verification subprocess failed with exit code ' + code);
}
async function main() {
  if (process.env.NODE_ENV === 'production') throw Error('Production test execution forbidden');
  const url = validateTestDatabase(process.env.TEST_DATABASE_URL);
  const schema = 'smartlab_test_run_' + Date.now() + '_' + crypto.randomBytes(8).toString('hex');
  const { PrismaClient } = require('@prisma/client');
  const owner = new PrismaClient({datasources:{db:{url:url.href}}});
  url.searchParams.set('schema', schema);
  const socket = net.createServer();
  await new Promise((resolve,reject) => {socket.once('error',reject);socket.listen(0,'127.0.0.1',resolve)});
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  const evidence = process.env.SMARTLAB_EVIDENCE_DIR || path.join(backend,'../artifacts/regression');
  fs.mkdirSync(evidence,{recursive:true});
  const env = {...process.env, DATABASE_URL:url.href, SMARTLAB_TEST_SCHEMA:schema,
    TEST_API_URL:'http://127.0.0.1:'+port+'/api', NODE_ENV:'test', PORT:String(port), TZ:'UTC',
    JWT_SECRET:crypto.randomBytes(32).toString('hex'), SMTP_PASS:'', SMARTLAB_EVIDENCE_DIR:evidence,
    ALLOW_DEMO_SEED:'1', DEMO_DATABASE_NAME:'smartlab_test'};
  let server;
  try {
    await run([resolveTool('prisma/build/index.js'),'migrate','deploy'],env);
    await run([resolveTool('prisma/build/index.js'),'migrate','deploy'],env);
    await run([resolveTool('ts-node/dist/bin.js'),'prisma/seed.ts'],env);
    server=spawn(process.execPath,['dist/server.js'],{cwd:backend,env,stdio:'ignore',windowsHide:true});
    let ready=false;
    for(let i=0;i<300;i++) {
      if(server.exitCode!==null)throw Error('Isolated test server exited');
      try {if((await fetch('http://127.0.0.1:'+port+'/ready',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break}}catch{}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    if(!ready)throw Error('Isolated server readiness timed out');
    const suites=require('../tests/regression-suites.json').map(name=>'tests/'+name);
    await run([resolveTool('jest/bin/jest'),...suites,'--runInBand','--silent','--json','--outputFile='+path.join(evidence,'regression-results.json')],env);
  } finally {
    if(server && server.exitCode===null) {
      server.kill();
      await Promise.race([new Promise(resolve=>server.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,10000))]);
      if(server.exitCode===null)server.kill('SIGKILL');
    }
    try {await owner.$executeRawUnsafe('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');}
    finally {await owner.$disconnect();}
    console.log('Removed isolated test schema; existing schemas were not reset.');
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
