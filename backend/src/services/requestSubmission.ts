import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { borrowRequestInclude } from './borrowRequestService';
import { RequestActionError } from './requestActionError';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)]));
  return value;
}
export function submissionIdentity(body: Record<string, unknown>) {
  const { submissionKey, ...payload } = body;
  if (submissionKey === undefined) return { submissionKey: null, submissionHash: null };
  if (typeof submissionKey !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(submissionKey)) throw new RequestActionError(400, 'Invalid submission key.');
  return { submissionKey, submissionHash: createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex') };
}
export async function findSubmission(tx: Prisma.TransactionClient, userId: string, identity: ReturnType<typeof submissionIdentity>) {
  if (!identity.submissionKey) return null;
  const existing = await tx.borrowRequest.findUnique({ where: { requestedBy_submissionKey: { requestedBy: userId, submissionKey: identity.submissionKey } }, include: borrowRequestInclude });
  if (existing && existing.submissionHash !== identity.submissionHash) throw new RequestActionError(409, 'This submission key was already used with different request details. Start a new submission.');
  return existing;
}

export class DuplicateRequestError extends RequestActionError {
  constructor(public readonly existingRequestId: string) {
    super(409, 'You already have a pending request for one or more of these equipment items on the same date.');
  }
}
