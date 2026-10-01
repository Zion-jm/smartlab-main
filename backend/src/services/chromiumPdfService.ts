import { execFile } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);
const chromiumCandidates = [
  process.env.CHROMIUM_PATH,
  '/repl/tools/bin/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].filter((value): value is string => Boolean(value));

const findChromium = async () => {
  for (const candidate of chromiumCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue through the known runtime locations.
    }
  }
  throw new Error('Chromium is not available for server-side PDF generation.');
};

/** One bounded Chromium invocation with a private temporary directory per export. */
export async function renderHtmlPdf(html: string): Promise<Buffer> {
  const chromiumPath = await findChromium();
  const tempDirectory = await mkdtemp(join(tmpdir(), 'smartlab-report-'));
  const htmlPath = join(tempDirectory, 'report.html');
  const pdfPath = join(tempDirectory, 'report.pdf');
  try {
    await writeFile(htmlPath, html, 'utf8');
    await execFileAsync(chromiumPath, [
      '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--no-pdf-header-footer', '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=1000',
      '--user-data-dir=' + join(tempDirectory, 'profile'),
      '--print-to-pdf=' + pdfPath, pathToFileURL(htmlPath).href,
    ], { timeout: 60000, maxBuffer: 1024 * 1024 });
    return await readFile(pdfPath);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}
