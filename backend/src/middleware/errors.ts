import { ErrorRequestHandler, RequestHandler, Response } from 'express';
import { errorCode, mapError } from '../services/domainError';

export function sendError(error: unknown, res: Response): void {
  const mapped = mapError(error);
  if (mapped.status >= 500) console.error('API request failed', { code: mapped.code });
  if (mapped.code === 'REPORT_BUSY') res.setHeader('Retry-After', '5');
  res.status(mapped.status).json({ error: mapped.error, code: mapped.code });
}
// Preserve existing error strings and useful validation/conflict detail fields.
export const errorResponseContract: RequestHandler = (_req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body: any) => {
    if (res.statusCode >= 400) body = {
      ...(body && typeof body === 'object' ? body : {}),
      error: typeof body?.error === 'string' ? body.error : 'Request failed.',
      code: typeof body?.code === 'string' ? body.code : errorCode(res.statusCode),
    };
    return json(body);
  };
  next();
};
export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) { next(error); return; }
  sendError(error, res);
};
