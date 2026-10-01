const { apiRequest, getAdminToken, getStudentToken } = require('./helpers');

describe('Notifications', () => {
  let adminToken, studentToken;

  beforeAll(async () => {
    [adminToken, studentToken] = await Promise.all([getAdminToken(), getStudentToken()]);
  });

  // ── GET /notifications ───────────────────────────────────────────────────────

  describe('GET /notifications', () => {
    test('admin can get their notifications', async () => {
      const { status, data } = await apiRequest('GET', '/notifications', null, adminToken);
      expect(status).toBe(200);
      expect(Array.isArray(data.notifications)).toBe(true);
      expect(typeof data.unreadCount).toBe('number');
    });

    test('student can get their notifications', async () => {
      const { status, data } = await apiRequest('GET', '/notifications', null, studentToken);
      expect(status).toBe(200);
      expect(Array.isArray(data.notifications)).toBe(true);
    });

    test('returns 401 without token', async () => {
      const { status } = await apiRequest('GET', '/notifications');
      expect(status).toBe(401);
    });
  });

  // ── GET /notifications/unread-count ─────────────────────────────────────────

  describe('GET /notifications/unread-count', () => {
    test('returns numeric unread count for admin', async () => {
      const { status, data } = await apiRequest('GET', '/notifications/unread-count', null, adminToken);
      expect(status).toBe(200);
      expect(typeof data.count).toBe('number');
      expect(data.count).toBeGreaterThanOrEqual(0);
    });

    test('returns numeric unread count for student', async () => {
      const { status, data } = await apiRequest('GET', '/notifications/unread-count', null, studentToken);
      expect(status).toBe(200);
      expect(typeof data.count).toBe('number');
    });
  });

  // ── PATCH /notifications/read-all ───────────────────────────────────────────

  describe('PATCH /notifications/read-all', () => {
    test('admin can mark all notifications as read', async () => {
      const { status, data } = await apiRequest('PATCH', '/notifications/read-all', null, adminToken);
      expect(status).toBe(200);
      expect(data.message).toMatch(/read/i);
    });

    test('student can mark all notifications as read', async () => {
      const { status, data } = await apiRequest('PATCH', '/notifications/read-all', null, studentToken);
      expect(status).toBe(200);
      expect(data.message).toMatch(/read/i);
    });

    test('unread count is 0 after marking all read', async () => {
      await apiRequest('PATCH', '/notifications/read-all', null, adminToken);
      const { data } = await apiRequest('GET', '/notifications/unread-count', null, adminToken);
      expect(data.count).toBe(0);
    });
  });

  // ── PATCH /notifications/:id/read ────────────────────────────────────────────

  describe('PATCH /notifications/:id/read', () => {
    test('returns 404 for non-existent notification', async () => {
      const { status } = await apiRequest('PATCH', '/notifications/nonexistent-id/read', null, adminToken);
      expect(status).toBe(404);
    });
  });
});
