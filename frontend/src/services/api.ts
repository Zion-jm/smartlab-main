import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// A stale tab must never send a request using another tab's newly signed-in account.
let tabToken = localStorage.getItem('token');
window.addEventListener('storage', event => {
  if ((event.key === 'token' || event.key === null) && localStorage.getItem('token') !== tabToken) window.location.reload();
});
// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token !== tabToken && config.url !== '/auth/login') {
    window.location.reload();
    return Promise.reject(new Error('Your sign-in session changed. Refresh before continuing.'));
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(response => {
  if (response.config.url === '/auth/login' && response.data?.token) tabToken = response.data.token;
  return response;
}, async error => {
  if (error.response?.data instanceof Blob && error.response.data.type.includes('json')) {
    try { error.response.data = JSON.parse(await error.response.data.text()); } catch { /* Preserve original error if decoding fails. */ }
  }
  const sentToken = error.config?.headers?.Authorization;
  if (error.response?.data?.code === 'SESSION_INVALID' && sentToken === 'Bearer ' + localStorage.getItem('token')) {
    localStorage.removeItem('token');
    window.dispatchEvent(new Event('smartlab:session-invalid'));
  }
  return Promise.reject(error);
});

// Auth API
export const authApi = {
  forgotPassword: (email: string) => api.post('/auth/forgot-password', {email}),
  resetPassword: (data: {token:string;password:string}) => api.post('/auth/reset-password',data),
  requestReactivation: (data: { email: string; password: string; reason: string }) => api.post('/auth/reactivation', data),
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  getMe: () => api.get('/auth/me'),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.patch('/auth/password', data),
};

type JsonPayload = Record<string, unknown>;

// Complete-data consumers (calendars/charts/selectors) must not mistake one page for the whole dataset.
// Hard cap bounds browser memory and requests; oversized views fail visibly instead of truncating.
async function collectPages(url: string, key?: string, params?: Record<string, unknown>) {
  const rows: unknown[] = [];
  const seen = new Set<string>();
  let expectedTotal: number | undefined;
  let first: AxiosResponse | undefined;
  for (let page = 1; page <= 10; page++) {
    const response = await api.get(url, { params: { ...params, page, pageSize: 100 } });
    first ??= response;
    const total = Number(response.headers['x-total-count'] ?? response.data?.total);
    if (!Number.isFinite(total) || total > 1000) throw new Error('This view exceeds 1000 records. Narrow the period or filters.');
    if (expectedTotal !== undefined && expectedTotal !== total) throw new Error('Data changed while loading. Refresh or narrow the filters.');
    expectedTotal = total;
    const batch = key ? response.data[key] : response.data;
    for (const row of batch) {
      const id = row.id ?? row.user_id;
      if (typeof id !== 'string' || seen.has(id)) throw new Error('Data changed while loading. Refresh or narrow the filters.');
      seen.add(id);
    }
    if (!batch.length && rows.length < total) throw new Error('Data changed while loading. Refresh or narrow the filters.');
    rows.push(...batch);
    if (rows.length >= total) return { ...first, data: key ? { ...first.data, [key]: rows, total } : rows };
  }
  throw new Error('Data changed while loading. Refresh or narrow the filters.');
}

// Equipment API
export const equipmentApi = {
  getPage: (params?: Record<string, unknown>) => api.get('/equipment', { params }),
  getAll: (params?: Record<string, unknown>) => collectPages('/equipment', undefined, params),
  getStats: (params?: Record<string, unknown>) => api.get('/equipment/stats/overview', { params }),
  getById: (id: string) => api.get(`/equipment/${id}`),
  create: (data: JsonPayload) => api.post('/equipment', data),
  update: (id: string, data: JsonPayload) => api.put(`/equipment/${id}`, data),
  restore: (id: string) => api.post(`/equipment/${id}/restore`),
  retire: (id: string) => api.post(`/equipment/${id}/retire`),
};

// Borrow Requests API
export const borrowRequestApi = {
  getPage: (params?: Record<string, unknown>) => api.get('/borrow-requests', { params }),
  getAll: (params?: Record<string, unknown>) => collectPages('/borrow-requests', 'requests', params),
  getMyRequests: (params?: Record<string, unknown>) => collectPages('/borrow-requests/my-requests', 'requests', params),
  getMyPage: (params?: Record<string, unknown>) => api.get('/borrow-requests/my-requests', { params }),
  getById: (id: string) => api.get(`/borrow-requests/${id}`),
  create: (data: JsonPayload) => api.post('/borrow-requests', data),
  update: (id: string, data: JsonPayload) => api.put(`/borrow-requests/${id}`, data),
  approve: (id: string, data?: JsonPayload) => api.patch(`/borrow-requests/${id}/approve`, data),
  reject: (id: string, data?: JsonPayload) => api.patch(`/borrow-requests/${id}/reject`, data),
  borrow: (id: string, data?: JsonPayload) => api.patch(`/borrow-requests/${id}/borrow`, data),
  return: (id: string, data?: JsonPayload) => api.patch(`/borrow-requests/${id}/return`, data),
  cancel: (id: string, data?: JsonPayload) => api.patch(`/borrow-requests/${id}/cancel`, data),
};

// Users API
export const userApi = {
  sendPasswordReset: (id:string) => api.post('/users/'+encodeURIComponent(id)+'/password-reset'),
  getById: (id: string) => api.get('/users/' + encodeURIComponent(id)),
  getPage: (params?: Record<string, unknown>) => api.get('/users', { params }),
  getAll: (params?: Record<string, unknown>) => collectPages('/users', undefined, params),
  create: (data: JsonPayload) => api.post('/users', data),
  update: (id: number | string, data: JsonPayload) => api.put(`/users/${id}`, data),
};

// Academic Directory API
export const directoryApi = {
  getOverview: () => api.get('/academic-directory'),
  getPrograms: () => api.get('/academic-directory/programs'),
  getDepartments: () => api.get('/academic-directory/departments'),
  createBuilding: (data: JsonPayload) => api.post('/academic-directory/buildings', data),
  updateBuilding: (id: string, data: JsonPayload) => api.put(`/academic-directory/buildings/${id}`, data),
  createRoom: (data: JsonPayload) => api.post('/academic-directory/rooms', data),
  updateRoom: (id: string, data: JsonPayload) => api.put(`/academic-directory/rooms/${id}`, data),
  createProgram: (data: JsonPayload) => api.post('/academic-directory/programs', data),
  updateProgram: (id: string, data: JsonPayload) => api.put(`/academic-directory/programs/${id}`, data),
  createSubject: (data: JsonPayload) => api.post('/academic-directory/subjects', data),
  updateSubject: (id: string, data: JsonPayload) => api.put(`/academic-directory/subjects/${id}`, data),
  createDepartment: (data: JsonPayload) => api.post('/academic-directory/departments', data),
  updateDepartment: (id: string, data: JsonPayload) => api.put(`/academic-directory/departments/${id}`, data),
};

type LabScheduleQuery = {
  page?: number; pageSize?: number; source?: string; scheduleType?: string; room?: string; program?: string; faculty?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  roomId?: string;
  facultyId?: string;
  search?: string;
  academicYearId?: string;
  termId?: string;
};

// Lab Schedule API
export const labScheduleApi = {
  getPage: (params?: LabScheduleQuery) => api.get('/lab-schedules', { params }),
  getAll: (params?: LabScheduleQuery) => collectPages('/lab-schedules', 'schedules', params),
  getResources: () => api.get('/lab-schedules/resources'),
  create: (data: JsonPayload) => api.post('/lab-schedules/admin/create', data),
  update: (id: string, data: JsonPayload) => api.put(`/lab-schedules/${id}`, data),
};

// Academic period API
export const academicPeriodApi = {
  get: () => api.get('/academic-period'),
  getCurrent: () => api.get('/academic-period/current'),
  activate: (data: { year: string; termName: string; reason?: string }) =>
    api.post('/academic-period', data),
};

export type AuditLog = {
  id: string;
  actorUserId: string;
  actor: { id: string; name: string; email: string };
  action: string;
  actionLabel: string;
  entityType: string;
  entityLabel: string;
  recordReference?: string;
  entityId: string;
  details: unknown;
  summary: string;
  createdAt: string;
};

export type AuditLogQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  action?: string;
  entityType?: string;
  actorUserId?: string;
  actor?: string;
  from?: string;
  to?: string;
};

export const auditLogsApi = {
  getAll: (params?: AuditLogQuery) => api.get<{
    logs: AuditLog[];
    total: number;
    page: number;
    pageSize: number;
  }>('/audit-logs', { params }),
};

// Conflict API
export const conflictApi = {
  check: (data: JsonPayload, config?: AxiosRequestConfig) => api.post('/conflicts/check', data, config),
};

// Notifications API
export const notificationApi = {
  getAll: (params?: { offset?: number; unread?: boolean }) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

export type BorrowRequestReportPdfParams = {
  scope: 'period' | 'filtered';
  academicYearId?: string;
  termId?: string;
  from?: string;
  to?: string;
  search?: string;
  status?: string;
  room?: string;
  program?: string;
  year?: string;
};

export type DemandAnalysisPdfParams = BorrowRequestReportPdfParams & {
  groupBy: 'faculty' | 'submittedBy' | 'program' | 'subject' | 'room';
  demandSource: 'ALL' | 'STUDENT' | 'FACULTY';
  demandRoomType: 'ALL' | 'COMPUTER_LAB' | 'OTHER';
  demandStatusScope: 'ACTIVE' | 'ALL';
};

export type LabScheduleReportPdfParams = {
  scope: 'period' | 'filtered';
  view: 'log' | 'analysis';
  academicYearId?: string;
  termId?: string;
  from?: string;
  to?: string;
  search?: string;
  day?: string;
  room?: string;
  roomType?: 'ALL' | 'COMPUTER_LAB' | 'OTHER';
  program?: string;
  year?: string;
  scheduleType?: 'ALL' | 'WEEKLY' | 'ONE_TIME';
};

export type EquipmentReportPdfParams = {
  scope: 'period' | 'filtered';
  view: 'inventory' | 'usage';
  report: 'log' | 'analysis';
  academicYearId?: string;
  termId?: string;
  from?: string;
  to?: string;
  search?: string;
  status?: 'AVAILABLE' | 'BORROWED' | 'DAMAGED' | 'UNAVAILABLE';
  lowStock?: boolean;
};

export const reportsApi = {
  downloadBorrowRequestPdf: (params: BorrowRequestReportPdfParams) =>
    api.get('/reports/borrow-requests.pdf', {
      params,
      responseType: 'blob',
    }),
  downloadDemandAnalysisPdf: (params: DemandAnalysisPdfParams) =>
    api.get('/reports/demand-analysis.pdf', {
      params,
      responseType: 'blob',
    }),
  downloadLabSchedulePdf: (params: LabScheduleReportPdfParams) =>
    api.get('/reports/lab-schedules.pdf', {
      params,
      responseType: 'blob',
    }),
  downloadEquipmentPdf: (params: EquipmentReportPdfParams) =>
    api.get('/reports/equipment.pdf', {
      params,
      responseType: 'blob',
    }),
};

export default api;

export const studentAcademicApi = {
  list: (params: { academicYearId: string; search?: string; page?: number }) => api.get('/student-academic-records', { params }),
  save: (data: JsonPayload) => api.post('/student-academic-records', data),
  me: () => api.get('/student-academic-records/me'),
};
