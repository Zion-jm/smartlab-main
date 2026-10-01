// Credential-free diagnostic for the same renderer used by production reports.
const { renderHtmlPdf } = require('../dist/services/chromiumPdfService');
async function main() {
  const started = Date.now();
  try {
    const pdf = await renderHtmlPdf('<!doctype html><html><body><h1>SmartLab PDF runtime check</h1></body></html>');
    if (pdf.subarray(0, 5).toString() !== '%PDF-' || pdf.length < 1000) throw Object.assign(new Error(), { code: 'INVALID_PDF' });
    console.log(`PASS: standalone production PDF renderer (${pdf.length} bytes, ${Date.now() - started} ms)`);
  } catch (error) {
    // Never print the command, environment, raw stderr, or generated HTML.
    const stderr = typeof error.stderr === 'string' ? error.stderr : '';
    console.error('PDF runtime diagnostic:', JSON.stringify({
      elapsedMs: Date.now() - started,
      code: typeof error.code === 'number' ? error.code : /^[A-Z0-9_]+$/.test(error.code || '') ? error.code : 'RENDER_FAILED',
      killed: error.killed === true,
      signal: ['SIGTERM', 'SIGKILL', 'SIGABRT', 'SIGSEGV', 'SIGTRAP'].includes(error.signal) ? error.signal : null,
      missingLibrary: /error while loading shared libraries/i.test(stderr),
      sandboxFailure: /no usable sandbox|running as root without --no-sandbox/i.test(stderr),
      pdfWritten: /bytes written to file/i.test(stderr),
      profileFailure: /singleton|profile.*in use/i.test(stderr),
    }));
    process.exitCode = 1;
  }
}
main();
