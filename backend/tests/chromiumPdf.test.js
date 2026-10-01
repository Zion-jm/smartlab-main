const fs = require('node:fs/promises');
jest.mock('node:fs/promises', () => ({ access: jest.fn() }));
const mockPage = { route: jest.fn(), setContent: jest.fn(), pdf: jest.fn() };
const mockBrowser = { newPage: jest.fn(), close: jest.fn() };
const mockLaunch = jest.fn();
jest.mock('playwright-core', () => ({ chromium: { launch: (...args) => mockLaunch(...args) } }));
const { renderHtmlPdf } = require('../dist/services/chromiumPdfService');
beforeEach(() => {
  jest.resetAllMocks(); fs.access.mockResolvedValue(); mockLaunch.mockResolvedValue(mockBrowser);
  mockBrowser.newPage.mockResolvedValue(mockPage); mockBrowser.close.mockResolvedValue();
  mockPage.route.mockResolvedValue(); mockPage.setContent.mockResolvedValue(); mockPage.pdf.mockResolvedValue(Buffer.from('%PDF-test'));
});
afterEach(() => jest.useRealTimers());
test('prints with CSS page size and backgrounds, blocks external requests, and closes browser', async () => {
  await expect(renderHtmlPdf('<html>report</html>')).resolves.toEqual(Buffer.from('%PDF-test'));
  expect(mockPage.pdf).toHaveBeenCalledWith({ printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
  const abort = jest.fn(); mockPage.route.mock.calls[0][1]({ abort }); expect(abort).toHaveBeenCalled();
  expect(mockBrowser.close).toHaveBeenCalledTimes(1);
});
test.each(['newPage', 'setContent', 'pdf'])('closes browser after %s failure', async stage => {
  const error = new Error('render failed'); (mockBrowser[stage] || mockPage[stage]).mockRejectedValueOnce(error);
  await expect(renderHtmlPdf('<html/>')).rejects.toBe(error); expect(mockBrowser.close).toHaveBeenCalledTimes(1);
});
test('missing Chromium fails before launching', async () => {
  fs.access.mockRejectedValue(new Error('missing'));
  await expect(renderHtmlPdf('<html/>')).rejects.toThrow('Chromium is not available'); expect(mockLaunch).not.toHaveBeenCalled();
});
test('bounds a hung PDF call and closes browser', async () => {
  jest.useFakeTimers(); mockPage.pdf.mockReturnValue(new Promise(() => {}));
  const result = expect(renderHtmlPdf('<html/>')).rejects.toThrow('PDF rendering timed out');
  await jest.advanceTimersByTimeAsync(60000); await result; expect(mockBrowser.close).toHaveBeenCalledTimes(1);
});
