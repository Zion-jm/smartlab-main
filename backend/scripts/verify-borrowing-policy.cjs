const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
async function main(){
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || chromium.executablePath(),headless:true});
 try {
  const page=await browser.newPage();let policy={content:'Borrowing guidelines\nReturn equipment on time.',revision:1,updatedAt:'2026-10-17T00:00:00Z'},writes=0;
  await page.route('**/borrowing-policy',route=>{if(route.request().method()==='PUT'){writes++;policy={...policy,content:route.request().postDataJSON().content,revision:policy.revision+1};}return route.fulfill({json:policy});});
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:844});await page.goto('http://127.0.0.1:5174/tests/policy-harness.html?admin');
   await page.getByRole('button',{name:'Edit policy',exact:true}).click();
   await page.getByLabel('Policy text').fill('Updated rules '+width+'\n<script>alert(1)</script>');
   await page.getByRole('button',{name:'Save policy',exact:true}).click();
   const dialog=page.getByRole('dialog',{name:'Save borrowing policy?'});await dialog.waitFor();
   await dialog.getByRole('button',{name:'Keep editing'}).click();assert.equal(writes,width===1280?0:1);
   await page.getByRole('button',{name:'Save policy',exact:true}).click();await dialog.getByRole('button',{name:'Save policy',exact:true}).click();
   await page.getByRole('button',{name:'Edit policy',exact:true}).waitFor();
   assert.ok((await page.locator('body').innerText()).includes('<script>alert(1)</script>'));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.goto('http://127.0.0.1:5174/tests/policy-harness.html');
   await page.getByText('Last updated:',{exact:false}).waitFor();assert.equal(await page.getByRole('button',{name:'Edit policy',exact:true}).count(),0);
   await page.getByRole('button',{name:'View borrowing policy'}).click();await page.getByRole('dialog',{name:'Borrowing Policy',exact:true}).waitFor();
   await page.getByRole('button',{name:'Close borrowing policy',exact:true}).click();
  }
  assert.equal(writes,2);console.log('PASS policy desktop/mobile: edit, confirmation, persistence, read-only view, safe text, modal and width');
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
