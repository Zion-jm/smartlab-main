import type { Account } from '../types/account';

export const ROLE_VALUE_TO_ID: Record<Account['role'], number> = {
  ADMIN: 1,
  FACULTY: 2,
  STUDENT: 3,
};

export const ROLE_ID_TO_VALUE: Record<number, Account['role']> = {
  1: 'ADMIN',
  2: 'FACULTY',
  3: 'STUDENT',
};

export const STATUS_VALUE_TO_ID: Record<Account['status'], number> = {
  ACTIVE: 1,
  // Preserve the existing API ID for deactivated accounts.
  DEACTIVATED: 3,
};

export const STATUS_ID_TO_VALUE: Record<number, Account['status']> = {
  1: 'ACTIVE',
  3: 'DEACTIVATED',
};
