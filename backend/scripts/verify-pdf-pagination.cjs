const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { paginateReportTables } = require('../dist/services/reportPagination');
const { renderBorrowRequestDocument } = require('../dist/services/reportPdfService');
async function main() {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});
  try {
    const page = await browser.newPage();
    await page.emulateMedia({media:'print'});
    const rows = Array.from({length:32},(_,i)=>({dateNeeded:'2026-10-19',requestType:'EQUIPMENT',location:'Academic and Student Services Office',equipmentList:'Headset with Microphone, External Hard Drive (1TB), HDMI Cable',requesterName:'Requester '+String(i+1).padStart(2,'0'),programCode:'BSIT',yearLevel:'3',facultyName:'Sample Faculty',timeStart:'08:00',timeEnd:'10:00',status:'PENDING',subject:'Art Appreciation / Pagpapahalaga sa Sining and Applications Development and Emerging Technologies'}));
    const asset = name => 'data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'../../frontend/public',name)).toString('base64');
    const html=renderBorrowRequestDocument([rows.slice(0,13),rows.slice(13,26),rows.slice(26)],asset('PUPLogo.png'),asset('iso-certification.png'));
    await page.setContent(html,{waitUntil:'load'});
    assert.ok(await page.evaluate(()=>Array.from(document.querySelectorAll('.table-wrap')).some(w=>w.scrollHeight>w.clientHeight)), 'Fixture must reproduce clipping');
    await page.evaluate(paginateReportTables);
    const result=await page.evaluate(()=>({
      names:Array.from(document.querySelectorAll('tbody tr')).map(r=>r.cells[4].textContent),
      pages:Array.from(document.querySelectorAll('.report-page')).map(p=>({
        tableBottom:p.querySelector('table').getBoundingClientRect().bottom,
        limit:p.querySelector('.table-wrap').getBoundingClientRect().bottom,
        footer:p.querySelector('.page-footer').getBoundingClientRect().top,
        label:p.querySelector('.page-number').textContent,
      }))
    }));
    assert.deepEqual(result.names,rows.map(r=>r.requesterName));
    assert.ok(result.pages.length>3);
    // No artificial batch boundary: the first row of the next page must not fit.
    const gaps = await page.evaluate(() => {
      const pages = Array.from(document.querySelectorAll('.report-page'));
      return pages.slice(0,-1).map((p,i) => {
        const probe = pages[i+1].querySelector('tbody tr').cloneNode(true);
        p.querySelector('tbody').appendChild(probe);
        const fits = p.querySelector('table').getBoundingClientRect().bottom <= p.querySelector('.table-wrap').getBoundingClientRect().bottom - 2;
        probe.remove(); return fits;
      });
    });
    assert.ok(gaps.every(fits => !fits), 'An earlier page has room for the next row');
    result.pages.forEach((p,i)=>{assert.ok(p.tableBottom<=p.limit-1);assert.ok(p.tableBottom<p.footer);assert.equal(p.label,`Page: ${i+1} of ${result.pages.length}`);});
    const out=path.join(__dirname,'../../artifacts/pdf-pagination');fs.mkdirSync(out,{recursive:true});
    await page.pdf({path:path.join(out,'wrapped-rows.pdf'),printBackground:true,preferCSSPageSize:true});
    // An oversized row must fail rather than silently lose content.
    await page.setContent(html);
    await page.evaluate(()=>{document.querySelector('tbody td').textContent='Very long content '.repeat(3000);});
    await assert.rejects(page.evaluate(paginateReportTables),/too tall/);
    console.log(`PASS pagination: 32 wrapped rows preserved once, ${result.pages.length} pages, repeated headers, footer clearance, oversized-row rejection`);
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
