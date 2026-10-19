// Executed inside Chromium after print styles and fonts are ready.
// Measure actual wrapped rows rather than assuming a fixed number fits.
export const paginateReportTables = `(async () => {
  await document.fonts.ready;
  const originals = Array.from(document.querySelectorAll('.report-page'));
  for (const original of originals) {
    const originalBody = original.querySelector('.table-wrap tbody');
    if (!originalBody) continue;
    const rows = Array.from(originalBody.rows);
    originalBody.replaceChildren();
    let current = original;
    let body = originalBody;
    for (const row of rows) {
      body.appendChild(row);
      let wrap = current.querySelector('.table-wrap');
      let table = wrap.querySelector('table');
      if (table.getBoundingClientRect().bottom > wrap.getBoundingClientRect().bottom - 2) {
        row.remove();
        if (!body.rows.length) throw new Error('A report row is too tall to fit on a page. Shorten its content before exporting.');
        const continuation = original.cloneNode(true);
        continuation.querySelector('.table-wrap tbody').replaceChildren();
        current.after(continuation);
        current = continuation;
        body = current.querySelector('.table-wrap tbody');
        body.appendChild(row);
        wrap = current.querySelector('.table-wrap');
        table = wrap.querySelector('table');
        if (table.getBoundingClientRect().bottom > wrap.getBoundingClientRect().bottom - 2)
          throw new Error('A report row is too tall to fit on a page. Shorten its content before exporting.');
      }
    }
  }
  const pages = Array.from(document.querySelectorAll('.report-page'));
  pages.forEach((page, index) => {
    const label = page.querySelector('.page-number');
    if (label) label.textContent = 'Page: ' + (index + 1) + ' of ' + pages.length;
  });
})()`;
