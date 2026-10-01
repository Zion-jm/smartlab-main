const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const {validateTestDatabase}=require('../backend/scripts/test-environment.cjs');
async function run(file,env){const child=spawn(process.execPath,[file],{cwd:path.join(root,'backend'),env,stdio:'inherit',windowsHide:true});const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});if(code!==0)throw Error(path.basename(file)+' failed: '+code)}
async function main(){
 const database=validateTestDatabase(process.env.TEST_DATABASE_URL);
 const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const out=process.env.SMARTLAB_EVIDENCE_DIR||path.join(root,'artifacts/browser');fs.mkdirSync(out,{recursive:true});
 const env={...process.env,DATABASE_URL:database.href,SMARTLAB_EVIDENCE_DIR:out,CHROMIUM_PATH:process.env.CHROMIUM_PATH||playwright.chromium.executablePath()};
 if(!fs.existsSync(env.CHROMIUM_PATH))throw Error('Run npx playwright install chromium or set CHROMIUM_PATH');
 if(process.argv.includes('--deployment')) {await run(path.join(root,'backend/scripts/check-pdf-runtime.cjs'),env);await run(path.join(root,'backend/scripts/smoke-production.cjs'),env);await run(path.join(root,'backend/scripts/smoke-migration-upgrade.cjs'),env);return}
 await run(path.join(root,'backend/scripts/verify-ribbons.cjs'),env);
 await run(path.join(root,'backend/scripts/verify-consolidation.cjs'),env);
 const vite=path.join(path.dirname(require.resolve('vite/package.json',{paths:[path.join(root,'frontend')]})),'bin/vite.js');
 const server=spawn(process.execPath,[vite,'--host','127.0.0.1','--port','5174','--strictPort'],{cwd:path.join(root,'frontend'),env:{...env,NODE_ENV:'development'},stdio:'ignore',windowsHide:true});
 try {let ready=false;for(let i=0;i<300;i++){if(server.exitCode!==null)throw Error('Vite fixture server exited');try{if((await fetch('http://127.0.0.1:5174/tests/table-harness.html')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}if(!ready)throw Error('Vite readiness timed out');await run(path.join(root,'backend/scripts/verify-table-component.cjs'),env)}
 finally {server.kill();await Promise.race([new Promise(r=>server.once('exit',r)),new Promise(r=>setTimeout(r,5000))]);if(server.exitCode===null)server.kill('SIGKILL')}
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
