import { createHash } from 'node:crypto';
import { RequestHandler } from 'express';

/** Bounded process-local limiter for the single-service deployment. */
export function createAuthLimiter(options: { ipMax?: number; accountMax?: number; now?: () => number } = {}): RequestHandler {
  const ipMax = options.ipMax ?? 120, accountMax = options.accountMax ?? 10;
  const now = options.now ?? Date.now;
  const buckets = new Map<string, { count: number; until: number }>();
  let lastSweep = 0;
  return (req, res, next) => {
    const time = now();
    if (time - lastSweep >= 30_000) {
      for (const [key, bucket] of buckets) if (bucket.until <= time) buckets.delete(key);
      lastSweep = time;
    }
    // req.ip uses the socket unless a deployment explicitly configures trusted proxies.
    const keys = [{ key: 'ip:' + req.ip, max: ipMax, window: 60_000 }];
    if (typeof req.body?.email === 'string') keys.push({
      key: 'account:' + createHash('sha256').update(req.body.email.trim().toLowerCase()).digest('hex'),
      max: accountMax, window: 15 * 60_000,
    });
    for (const { key, max, window } of keys) {
      let bucket = buckets.get(key);
      if (!bucket || bucket.until <= time) {
        if (!bucket && buckets.size >= 20_000) {
          res.setHeader('Retry-After', '60');
          res.status(429).json({ error: 'Too many sign-in attempts. Please try again later.', code: 'RATE_LIMITED' }); return;
        }
        bucket = { count: 0, until: time + window }; buckets.set(key, bucket);
      }
      if (bucket.count >= max) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.until - time) / 1000))));
        res.status(429).json({ error: 'Too many sign-in attempts. Please try again later.', code: 'RATE_LIMITED' }); return;
      }
    }
    // Reserve before async authentication so concurrent attempts cannot bypass the limit.
    const claimed = keys.map(({ key }) => { const bucket = buckets.get(key)!; bucket.count++; return { key, bucket }; });
    res.once('finish', () => {
      if (res.statusCode < 400 || res.statusCode >= 500) {
        for (const { key, bucket } of claimed) if (key.startsWith('account:')) bucket.count = Math.max(0, bucket.count - 1);
      }
    });
    next();
  };
}
export const authLimiter = createAuthLimiter();
