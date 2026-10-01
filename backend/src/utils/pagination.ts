import { Response } from 'express';
import { ValidationError } from '../services/domainError';
export function pagination(query: Record<string, unknown>) {
  const number = (value: unknown, fallback: number, max: number) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) throw new ValidationError('Invalid pagination. Use page 1–10000 and pageSize 1–100.');
    return Number(value);
  };
  const page = number(query.page, 1, 10000), pageSize = number(query.pageSize, 25, 100);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
export function pageHeaders(res: Response, page: { page: number; pageSize: number }, total: number) {
  res.set({ 'X-Total-Count': String(total), 'X-Page': String(page.page), 'X-Page-Size': String(page.pageSize) });
}
