export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: 'ADMIN' | 'FACULTY' | 'STUDENT';
  status: 'ACTIVE' | 'DEACTIVATED';
  department?: string | null;
  departmentId?: string | null;
  program?: string | null;
  programId?: string | null;
  yearLevel?: number | null;
  createdAt?: string;
  lastLoginAt?: string | null;
}
