// Browser-only fixture: no real account, database, or email delivery.
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
async function main() {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || chromium.executablePath(),headless:true});
  try {
    const context = await browser.newContext({viewport:{width:390,height:844}});
    await context.addInitScript(() => {
      localStorage.setItem('token','fixture');
      localStorage.setItem('auth-storage',JSON.stringify({state:{user:{id:'fixture',role:'ADMIN'},token:'fixture',isAuthenticated:true},version:0}));
    });
    let revision='initial', requests=0;
    await context.route('**/notifications/data-revision',route=>{requests++;return route.fulfill({json:{revision}})});
    const page = await context.newPage();
    const initialResponse=page.waitForResponse(r=>r.url().includes('/notifications/data-revision'));
    await page.goto('http://127.0.0.1:5174/tests/refresh-harness.html');
    await page.getByLabel('Unsaved draft').fill('Keep my draft');
    await initialResponse;
    async function poll() {
      const response=page.waitForResponse(r=>r.url().includes('/notifications/data-revision'));
      await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
      await response;
      await page.waitForTimeout(100);
    }
    assert.equal(await page.getByRole('alert').count(),0,'First revision stays quiet');
    revision='changed';await poll();
    await page.getByText('Updates available',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('Unsaved draft').inputValue(),'Keep my draft');
    revision='changed-again';await poll();
    assert.equal(await page.getByRole('alert').count(),1,'Changes coalesce');
    assert.ok(await page.getByRole('button',{name:'Refresh',exact:true}).isVisible());
    page.once('dialog',dialog=>dialog.dismiss());
    await page.getByRole('button',{name:'Refresh',exact:true}).click();
    assert.equal(await page.getByLabel('Unsaved draft').inputValue(),'Keep my draft');
    await page.getByRole('button',{name:'Dismiss notification'}).click();await poll();
    assert.equal(await page.getByRole('alert').count(),0,'Dismissed revision stays quiet');
    revision='third';await poll();await page.getByText('Updates available',{exact:true}).waitFor();
    page.once('dialog',dialog=>dialog.accept());
    await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'Refresh',exact:true}).click()]);
    assert.equal(await page.getByLabel('Unsaved draft').inputValue(),'','Confirmed refresh reloads');
    await poll();revision='fourth';await poll();await page.getByText('Updates available',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Sign out'}).click();
    assert.equal(await page.getByRole('alert').count(),0,'Logout clears notice');
    const before=requests;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(200);
    assert.equal(requests,before,'Logout stops polling');
    console.log('PASS affected-data toast: baseline, coalescing, draft preservation, dismiss, confirmed refresh, logout');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
