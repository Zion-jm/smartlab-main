const { validateEnvironment } = require('../dist/config/environment');
const { assertDemoDatabase } = require('../dist/config/seedSafety');
const fs = require('fs');
const path = require('path');
const valid = { DATABASE_URL: 'postgresql://test:private@localhost:5432/smartlab_test', JWT_SECRET: 'test-only', PORT: '3001' };
describe('portable configuration (run backend build first)', () => {
  test('accepts configured database and port', () => expect(() => validateEnvironment(valid)).not.toThrow());
  test.each([
    { DATABASE_URL: '' }, { DATABASE_URL: 'invalid-private' }, { DATABASE_URL: 'https://example.org/db' },
    { JWT_SECRET: '' }, { PORT: '0' }, { PORT: '65536' }, { PORT: '3001oops' }
  ])('rejects invalid config %p', override => expect(() => validateEnvironment({ ...valid, ...override })).toThrow());
  test('does not echo invalid credentials', () => {
    try { validateEnvironment({ ...valid, DATABASE_URL: 'invalid-private' }); } catch (e) { expect(e.message).not.toContain('invalid-private'); }
  });
  const seed = { ...valid, NODE_ENV: 'test', ALLOW_DEMO_SEED: '1', DEMO_DATABASE_NAME: 'smartlab_test' };
  test('accepts explicitly confirmed test database', () => expect(() => assertDemoDatabase(seed)).not.toThrow());
  test('accepts explicitly confirmed remote development database', () => expect(() => assertDemoDatabase({ ...seed, NODE_ENV: 'development', DATABASE_URL: 'postgresql://user:pass@dev.example.invalid/smartlab_test' })).not.toThrow());
  test.each([{ NODE_ENV: 'production' }, { NODE_ENV: '' }, { ALLOW_DEMO_SEED: '' }, { DEMO_DATABASE_NAME: '' }, { DEMO_DATABASE_NAME: 'wrong' }, { DATABASE_URL: 'invalid' }])('rejects unsafe seed %p', override => expect(() => assertDemoDatabase({ ...seed, ...override })).toThrow());
  test('run workflows contain no automatic installation or data changes', () => {
    const config = fs.readFileSync(path.join(__dirname, '../../.replit'), 'utf8');
    const args = config.split('\n').filter(line => line.trim().startsWith('args =')).join('\n');
    expect(args).not.toMatch(/npm install|db push|db:seed/);
  });
  test('email without credentials renders locally without SMTP', async () => {
    const old = process.env.SMTP_PASS;
    process.env.SMTP_PASS = '';
    try {
      jest.resetModules();
      const { transporter } = require('../dist/services/email/transporter');
      const result = await transporter.sendMail({ from: 'sender@example.invalid', to: 'recipient@example.invalid', subject: 'Local test', text: 'Not delivered' });
      expect(JSON.parse(result.message).subject).toBe('Local test');
    } finally { if (old === undefined) delete process.env.SMTP_PASS; else process.env.SMTP_PASS = old; }
  });
});

describe('production environment requirements',()=>{
  const env={...valid,NODE_ENV:'production',JWT_SECRET:'test-only-32-character-minimum-secret',FRONTEND_URL:'https://smartlab.example'};
  test('accepts explicit HTTPS origin and long signing secret',()=>expect(()=>validateEnvironment(env)).not.toThrow());
  test.each([{JWT_SECRET:'short'},{FRONTEND_URL:''},{FRONTEND_URL:'https://smartlab.example/path'},{FRONTEND_URL:'http://public.example'},{FRONTEND_URL:'https://user:pass@smartlab.example'}])('rejects incomplete/unsafe production config %p',override=>expect(()=>validateEnvironment({...env,...override})).toThrow());
  test('allows HTTP loopback for production rehearsals',()=>expect(()=>validateEnvironment({...env,FRONTEND_URL:'http://localhost:3121'})).not.toThrow());
});
