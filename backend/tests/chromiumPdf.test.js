const fs = require('node:fs/promises');
jest.mock('node:fs/promises', () => ({ access: jest.fn(), mkdtemp: jest.fn(), writeFile: jest.fn(), readFile: jest.fn(), rm: jest.fn() }));
const mockExecute = jest.fn();
jest.mock('node:util', () => ({ ...jest.requireActual('node:util'), promisify: () => (...args) => mockExecute(...args) }));
const { renderHtmlPdf } = require('../dist/services/chromiumPdfService');
beforeEach(() => { jest.clearAllMocks(); fs.access.mockResolvedValue(); fs.mkdtemp.mockResolvedValue('C:/temporary report #1'); fs.writeFile.mockResolvedValue(); fs.readFile.mockResolvedValue(Buffer.from('%PDF-test')); fs.rm.mockResolvedValue(); mockExecute.mockResolvedValue(); });
test('runs Chromium with bounded execution, encoded file URL, isolated profile, and cleanup', async () => {
  await expect(renderHtmlPdf('<html>report</html>')).resolves.toEqual(Buffer.from('%PDF-test'));
  expect(mockExecute.mock.calls[0][2]).toEqual({ timeout: 60000, maxBuffer: 1024 * 1024 });
  expect(mockExecute.mock.calls[0][1].at(-1)).toContain('temporary%20report%20%231');
  expect(mockExecute.mock.calls[0][1].some(a => a.startsWith('--user-data-dir='))).toBe(true);
  expect(fs.rm).toHaveBeenCalledWith('C:/temporary report #1', {recursive:true,force:true});
});
test.each(['write','mockExecute','read'])('cleans up after %s failure and propagates it', async stage => {
  const fail = new Error(stage + ' failed');
  ({write:fs.writeFile,mockExecute,read:fs.readFile})[stage].mockRejectedValueOnce(fail);
  await expect(renderHtmlPdf('<html/>')).rejects.toBe(fail);
  expect(fs.rm).toHaveBeenCalledTimes(1);
});
test('missing browser fails before allocating a directory', async () => {
  fs.access.mockRejectedValue(new Error('missing'));
  await expect(renderHtmlPdf('<html/>')).rejects.toThrow('Chromium is not available');
  expect(fs.mkdtemp).not.toHaveBeenCalled();
});
