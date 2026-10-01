import { Prisma } from '@prisma/client';

export const errorCode = (status: number): string => ({ 400: 'VALIDATION_ERROR', 401: 'AUTHENTICATION_REQUIRED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 413: 'PAYLOAD_TOO_LARGE', 503: 'SERVICE_UNAVAILABLE' }[status] ?? 'INTERNAL_ERROR');
export class DomainError extends Error {
  constructor(public readonly statusCode: number, message: string, public readonly code = errorCode(statusCode)) {
    super(message); this.name = 'DomainError';
  }
}
export class ValidationError extends DomainError {
  constructor(message: string) { super(400, message); }
}
export function mapError(error: unknown): { status: number; error: string; code: string } {
  if (error instanceof DomainError) return { status: error.statusCode, error: error.message, code: error.code };
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return { status: 409, error: 'Record already exists.', code: 'CONFLICT' };
    if (error.code === 'P2025') return { status: 404, error: 'Record not found.', code: 'NOT_FOUND' };
    if (['P2003', 'P2014', 'P2034'].includes(error.code)) return { status: 409, error: 'The operation conflicts with current records. Refresh and try again.', code: 'CONFLICT' };
    if (['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(error.code)) return { status: 503, error: 'Service unavailable. Please try again.', code: 'SERVICE_UNAVAILABLE' };
  }
  if (error instanceof Prisma.PrismaClientInitializationError) return { status: 503, error: 'Service unavailable. Please try again.', code: 'SERVICE_UNAVAILABLE' };
  // Only known HTTP parser/static-file errors are trusted, never arbitrary status fields.
  const http = error as { type?: string; status?: number; code?: string } | null;
  if (http?.type === 'entity.parse.failed') return { status: 400, error: 'Invalid JSON body.', code: 'VALIDATION_ERROR' };
  if (http?.type === 'entity.too.large') return { status: 413, error: 'Request body is too large.', code: 'PAYLOAD_TOO_LARGE' };
  if (http?.status === 404 && http.code === 'ENOENT') return { status: 404, error: 'Resource not found.', code: 'NOT_FOUND' };
  return { status: 500, error: 'Internal server error.', code: 'INTERNAL_ERROR' };
}
