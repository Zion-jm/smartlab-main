const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
(async () => {
 const root = path.resolve(__dirname, '../../frontend/dist');
 const server = http.createServer((req,res) => {
  let file = path.join(root, req.url.split('?')[0]); if (!path.extname(file)) file = path.join(root,'index.html');
  if (!file.startsWith(root) || !fs.existsSync(file)) {res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type', file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');fs.createReadStream(file).pipe(res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try {
  browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true});
  for (const width of [1280,390]) {
   const page = await browser.newPage({viewport:{width,height:850}});
   await page.route('**/api/**', route => route.fulfill({json:route.request().url().endsWith('/inspect')?{email:'p***@example.com'}:{message:'Ready'}}));
   await page.goto(`http://127.0.0.1:${server.address().port}/activate-account#token=${'a'.repeat(64)}`);
   await page.getByLabel('Password',{exact:true}).fill('Invitation123!');
   await page.getByLabel('Confirm password',{exact:true}).fill('Invitation123!');
   await page.getByLabel('Show passwords').check();
   assert.equal(await page.getByLabel('Password',{exact:true}).getAttribute('type'),'text');
   assert.equal(new URL(page.url()).hash,'');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.getByRole('button',{name:'Set password and activate'}).click();
   await page.getByText('Your email is verified and your account is ready.',{exact:false}).waitFor();
   await page.close(); console.log(`PASS invitation page ${width}: form, show password, fragment removal, success, no horizontal overflow`);
  }
 } finally {if(browser) await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
