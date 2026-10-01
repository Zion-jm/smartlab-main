const { apiRequest, getAdminToken, getFacultyToken, getStudentToken } = require('./helpers');

describe('Schedule Conflict Detection', () => {
  let adminToken, facultyToken, studentToken;
  let roomId, academicYearId, termId;

  beforeAll(async () => {
    [adminToken, facultyToken, studentToken] = await Promise.all([
      getAdminToken(),
      getFacultyToken(),
      getStudentToken(),
    ]);

    // Load schedule resources to get valid IDs
    const { data } = await apiRequest('GET', '/lab-schedules/resources', null, adminToken);
    roomId = data.rooms?.[0]?.id;
    academicYearId = data.academicYears?.[0]?.id;
    termId = data.terms?.[0]?.id;
  });

  // ── POST /conflicts/check ────────────────────────────────────────────────────

  describe('POST /conflicts/check', () => {
    test('admin can check conflicts — no conflict returns empty array', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const dateStr = futureDate.toISOString().slice(0, 10);

      const { status, data } = await apiRequest('POST', '/conflicts/check', {
        roomId,
        academicYearId,
        termId,
        scheduleType: 'ONE_TIME',
        scheduleDate: `${dateStr}T07:00:00.000Z`,
        timeStart: `${dateStr}T07:00:00.000Z`,
        timeEnd: `${dateStr}T09:00:00.000Z`,
      }, adminToken);

      expect(status).toBe(200);
      expect(typeof data.hasConflicts).toBe('boolean');
      expect(Array.isArray(data.conflicts)).toBe(true);
    });

    test('faculty can check conflicts', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 31);
      const dateStr = futureDate.toISOString().slice(0, 10);

      const { status, data } = await apiRequest('POST', '/conflicts/check', {
        roomId,
        academicYearId,
        termId,
        scheduleType: 'ONE_TIME',
        scheduleDate: `${dateStr}T09:00:00.000Z`,
        timeStart: `${dateStr}T09:00:00.000Z`,
        timeEnd: `${dateStr}T11:00:00.000Z`,
      }, facultyToken);

      expect(status).toBe(200);
      expect(data.hasConflicts).toBeDefined();
    });

    test('student can check conflicts', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 32);
      const dateStr = futureDate.toISOString().slice(0, 10);

      const { status } = await apiRequest('POST', '/conflicts/check', {
        roomId,
        academicYearId,
        termId,
        scheduleType: 'ONE_TIME',
        scheduleDate: `${dateStr}T10:00:00.000Z`,
        timeStart: `${dateStr}T10:00:00.000Z`,
        timeEnd: `${dateStr}T12:00:00.000Z`,
      }, studentToken);

      expect(status).toBe(200);
    });

    test('returns 400 when required fields are missing', async () => {
      const { status, data } = await apiRequest('POST', '/conflicts/check', {
        scheduleType: 'ONE_TIME',
      }, adminToken);
      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test('returns 400 when timeEnd is before timeStart', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 40);
      const dateStr = futureDate.toISOString().slice(0, 10);

      const { status, data } = await apiRequest('POST', '/conflicts/check', {
        roomId,
        academicYearId,
        termId,
        scheduleType: 'ONE_TIME',
        scheduleDate: `${dateStr}T07:00:00.000Z`,
        timeStart: `${dateStr}T10:00:00.000Z`,
        timeEnd: `${dateStr}T08:00:00.000Z`,
      }, adminToken);
      expect(status).toBe(400);
      expect(data.error).toMatch(/timeEnd/i);
    });

    test('returns 400 when scheduleDate is missing for ONE_TIME', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 41);
      const dateStr = futureDate.toISOString().slice(0, 10);

      const { status, data } = await apiRequest('POST', '/conflicts/check', {
        roomId,
        academicYearId,
        termId,
        scheduleType: 'ONE_TIME',
        timeStart: `${dateStr}T07:00:00.000Z`,
        timeEnd: `${dateStr}T09:00:00.000Z`,
      }, adminToken);
      expect(status).toBe(400);
      expect(data.error).toMatch(/scheduleDate/i);
    });

    test('unauthenticated request returns 401', async () => {
      const { status } = await apiRequest('POST', '/conflicts/check', {
        roomId,
        scheduleType: 'ONE_TIME',
      });
      expect(status).toBe(401);
    });
  });
});
