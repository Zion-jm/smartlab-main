export function assertDemoDatabase(env: NodeJS.ProcessEnv): void {
  if (!['development', 'test'].includes(env.NODE_ENV ?? '')) {
    throw new Error('Demo data operations require NODE_ENV=development or test; production is forbidden.');
  }
  if (env.ALLOW_DEMO_SEED !== '1') throw new Error('Demo data operations require explicit ALLOW_DEMO_SEED=1.');
  if (!env.DEMO_DATABASE_NAME?.trim()) throw new Error('Confirm the target using DEMO_DATABASE_NAME.');
  let database: URL;
  try { database = new URL(env.DATABASE_URL ?? ''); }
  catch { throw new Error('A valid PostgreSQL DATABASE_URL is required for demo data.'); }
  let name: string;
  try { name = decodeURIComponent(database.pathname.slice(1)); }
  catch { throw new Error('Invalid database name in DATABASE_URL.'); }
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.hostname || name !== env.DEMO_DATABASE_NAME) {
    throw new Error('DEMO_DATABASE_NAME must match the configured PostgreSQL database.');
  }
}
