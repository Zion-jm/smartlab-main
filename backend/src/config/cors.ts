import cors from 'cors';
/** Exact origins only; requests without an Origin still require normal authentication. */
export function corsOptions(env: NodeJS.ProcessEnv): cors.CorsOptions {
  const origins = new Set([env.FRONTEND_URL, ...(env.CORS_ORIGINS ?? '').split(',')].filter(Boolean).map(s => s!.trim()));
  if (env.NODE_ENV !== 'production') for (const host of ['localhost', '127.0.0.1']) origins.add('http://' + host + ':5000');
  return { origin: (origin, callback) => callback(null, !origin || origins.has(origin)), credentials: true, exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Page-Size'] };
}
