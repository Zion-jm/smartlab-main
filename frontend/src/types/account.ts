export interface Account {
  id: string;
  activationState?: 'LEGACY' | 'PENDING' | 'COMPLETE' | 'CANCELLED';
  roleId: number;
  role: 'ADMIN' | 'FACULTY' | 'STUDENT';
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  department?: string | null;
  departmentId?: string | null;
  program?: string | null;
  programId?: string | null;
  yearLevel?: number | null;
  status: 'ACTIVE' | 'DEACTIVATED';
  statusId: number;
}
