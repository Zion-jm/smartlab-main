export type BorrowRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'BORROWED'
  | 'RETURNED'
  | 'REJECTED'
  | 'CANCELLED';

export interface BorrowRequestItemSummary {
  id: string;
  equipmentId: string;
  equipmentName: string;
  quantity: number;
}

export interface BorrowRequest {
  id: string;
  referenceCode?: string;
  requesterId?: string;
  requesterName: string;
  requesterEmail: string;
  requesterRole: string;
  requesterAvatar?: string | null;
  program?: string | null;
  programId?: string | null;
  yearLevel?: number | null;
  facultyId?: string | null;
  facultyName?: string | null;
  location?: string | null;
  roomId?: string | null;
  isComputerLab?: boolean | null;
  subject?: string | null;
  subjectId?: string | null;
  equipmentList?: string | null;
  dateNeeded: string;
  timeStart?: string | null;
  timeEnd?: string | null;
  purpose?: string | null;
  notes?: string | null;
  status: BorrowRequestStatus;
  rejectionNote?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  borrowedAt?: string | null;
  returnedAt?: string | null;
  cancelledAt?: string | null;
  declinedAt?: string | null;
  items?: BorrowRequestItemSummary[];
}

export type BorrowRequestRoleFilter = 'ALL' | 'FACULTY' | 'STUDENT' | 'STAFF';

export type BorrowRequestSort = 'newest' | 'oldest' | 'date-asc' | 'date-desc' | 'name-asc' | 'name-desc';

export interface BorrowRequestFilters {
  search: string;
  status: BorrowRequestStatus | 'ALL';
  role: BorrowRequestRoleFilter;
  fromDate: string;
  toDate: string;
  sort: BorrowRequestSort;
}
