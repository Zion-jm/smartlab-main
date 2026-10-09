import type { RequestHandler } from 'express';

/** Single-instance limits. Keys come from verified users, never client headers. */
export function createRequestLimiter(max: number, windowMs: number, now = Date.now): RequestHandler {
  const buckets = new Map<string, { count: number; until: number }>();
  let swept = 0;
  return (req, res, next) => {
    const time = now();
    if (time - swept >= 30000) {
      for (const [key, bucket] of buckets) if (bucket.until <= time) buckets.delete(key);
      swept = time;
    }
    const key = req.user ? 'user:' + req.user.id : 'ip:' + req.ip;
    let bucket = buckets.get(key);
    if (!bucket || bucket.until <= time) {
      if (buckets.size >= 20000 && !bucket) {
        res.setHeader('Retry-After', '60');
        res.status(429).json({ error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' }); return;
      }
      bucket = { count: 0, until: time + windowMs }; buckets.set(key, bucket);
    }
    if (bucket.count >= max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.until - time) / 1000))));
      res.status(429).json({ error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' }); return;
    }
    bucket.count++;
    next();
  };
}
export const accountApiLimiter = createRequestLimiter(300, 60000);
export const writeLimiter = createRequestLimiter(60, 60000);
export const passwordChangeLimiter = createRequestLimiter(5, 15 * 60000);
export const reportLimiter = createRequestLimiter(10, 60000);
