import { access } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const chromiumCandidates = [
  process.env.CHROMIUM_PATH,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].filter((value): value is string => Boolean(value));

const findChromium = async () => {
  for (const candidate of chromiumCandidates) {
    try { await access(candidate); return candidate; } catch { /* Try the next runtime location. */ }
  }
  throw new Error('Chromium is not available for server-side PDF generation.');
};

/** Render through Chromium's PDF protocol, without polling a CLI output file. */
export async function renderHtmlPdf(html: string): Promise<Buffer> {
  const browser = await chromium.launch({
    executablePath: await findChromium(), headless: true, timeout: 30000,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const render = async () => {
      const page = await browser.newPage();
      // Reports embed their assets; external requests are unnecessary.
      await page.route('**/*', route => route.abort());
      await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
      return page.pdf({ printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
    };
    return await Promise.race([
      render(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('PDF rendering timed out.')), 60000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    await browser.close();
  }
}
