export function validateEnvironment(env: NodeJS.ProcessEnv): void {
  if (!env.DATABASE_URL?.trim()) throw new Error('DATABASE_URL is required. Configure backend/.env or environment secrets.');
  let database: URL;
  try { database = new URL(env.DATABASE_URL); }
  catch { throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.'); }
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.hostname || database.pathname.length <= 1) {
    throw new Error('DATABASE_URL must identify a PostgreSQL host and database.');
  }
  if (!env.JWT_SECRET?.trim()) throw new Error('JWT_SECRET is required. Generate a private random value.');
  if (env.NODE_ENV === 'production') {
    if (env.JWT_SECRET.trim().length < 32) throw new Error('Production JWT_SECRET must contain at least 32 characters.');
    let frontend: URL;
    try { frontend = new URL(env.FRONTEND_URL ?? ''); } catch { throw new Error('Production FRONTEND_URL must be an explicit HTTP(S) origin.'); }
    if (!['https:', 'http:'].includes(frontend.protocol) || frontend.origin !== env.FRONTEND_URL || frontend.username || frontend.password)
      throw new Error('Production FRONTEND_URL must be an origin without a path.');
    if (frontend.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(frontend.hostname)) throw new Error('Production FRONTEND_URL must use HTTPS except for local smoke tests.');
  }
  for (const origin of (env.CORS_ORIGINS ?? '').split(',').filter(Boolean)) {
    let parsed: URL;
    try { parsed = new URL(origin.trim()); } catch { throw new Error('CORS_ORIGINS must contain exact HTTP(S) origins.'); }
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.origin !== origin.trim()) throw new Error('CORS_ORIGINS must contain exact origins without paths or wildcards.');
    if (env.NODE_ENV === 'production' && parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) throw new Error('Production CORS origins must use HTTPS.');
  }
  if (env.TRUSTED_PROXIES?.split(',').some(value => !value.trim() || ['true', 'false', '*'].includes(value.trim()) || /^\d+$/.test(value.trim()))) throw new Error('TRUSTED_PROXIES requires explicit trusted addresses/subnets, not a boolean or hop count.');
  if (env.PORT !== undefined && (!/^\d+$/.test(env.PORT) || Number(env.PORT) < 1 || Number(env.PORT) > 65535)) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
}
