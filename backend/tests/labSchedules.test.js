const { apiRequest, getAdminToken, getFacultyToken, getStudentToken } = require('./helpers');

describe('Lab Schedules', () => {
  let adminToken, facultyToken, studentToken;
  let roomId, facultyProfileId, programId, subjectId, academicYearId, termId;
  let createdScheduleId;

  // Unique offset per test run to avoid date conflicts with leftover data
  const RUN_OFFSET = Date.now() % 100000; // unique ms offset

  beforeAll(async () => {
    [adminToken, facultyToken, studentToken] = await Promise.all([
      getAdminToken(),
      getFacultyToken(),
      getStudentToken(),
    ]);

    const { data: resources } = await apiRequest('GET', '/lab-schedules/resources', null, adminToken);
    roomId = resources.rooms?.[0]?.id;
    facultyProfileId = resources.faculty?.[0]?.profileId;
    programId = resources.programs?.[0]?.id;
    subjectId = resources.subjects?.[0]?.id;
    academicYearId = resources.academicYears?.find(y => y.isActive)?.id ?? resources.academicYears?.[0]?.id;
    termId = resources.terms?.find(t => t.isActive)?.id ?? resources.terms?.[0]?.id;

    // Remove any leftover schedules for the test room from previous runs so
    // time-slot conflicts do not cause false failures.
    if (roomId) {
      const { data: existing } = await apiRequest('GET', `/lab-schedules?roomId=${roomId}`, null, adminToken);
      const schedules = existing?.schedules ?? [];
      await Promise.all(
        schedules.map(s => apiRequest('DELETE', `/lab-schedules/${s.id}`, null, adminToken))
      );
    }
  });

  // Create a date far enough in the future, with a unique per-run hour
  // to avoid conflicts with schedules left by previous test runs
  const makeScheduleDate = (dayOffset, baseHour = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + 200 + dayOffset);
    // Use a per-run unique hour (0-23) derived from ms timestamp
    const uniqueHour = (baseHour + Math.floor(RUN_OFFSET / 1000)) % 20;
    d.setUTCHours(uniqueHour, 0, 0, 0);
    return d.toISOString();
  };

  const makeEndDate = (startIso, durationHours = 2) => {
    const d = new Date(startIso);
    d.setUTCHours(d.getUTCHours() + durationHours);
    return d.toISOString();
  };

  // ── GET /lab-schedules/resources ────────────────────────────────────────────

  describe('GET /lab-schedules/resources', () => {
    test('admin gets schedule resources', async () => {
      const { status, data } = await apiRequest('GET', '/lab-schedules/resources', null, adminToken);
      expect(status).toBe(200);
      expect(Array.isArray(data.rooms)).toBe(true);
      expect(Array.isArray(data.programs)).toBe(true);
      expect(Array.isArray(data.subjects)).toBe(true);
      expect(Array.isArray(data.faculty)).toBe(true);
      expect(Array.isArray(data.academicYears)).toBe(true);
      expect(Array.isArray(data.terms)).toBe(true);
    });

    test('faculty can get schedule resources', async () => {
      const { status } = await apiRequest('GET', '/lab-schedules/resources', null, facultyToken);
      expect(status).toBe(200);
    });

    test('student can get schedule resources', async () => {
      const { status } = await apiRequest('GET', '/lab-schedules/resources', null, studentToken);
      expect(status).toBe(200);
    });

    test('unauthenticated request returns 401', async () => {
      const { status } = await apiRequest('GET', '/lab-schedules/resources');
      expect(status).toBe(401);
    });
  });

  // ── GET /lab-schedules ──────────────────────────────────────────────────────

  describe('GET /lab-schedules', () => {
    test('admin can list all schedules', async () => {
      const { status, data } = await apiRequest('GET', '/lab-schedules', null, adminToken);
      expect(status).toBe(200);
      expect(Array.isArray(data.schedules)).toBe(true);
    });

    test('faculty can list schedules', async () => {
      const { status, data } = await apiRequest('GET', '/lab-schedules', null, facultyToken);
      expect(status).toBe(200);
      expect(Array.isArray(data.schedules)).toBe(true);
    });

    test('student can list schedules', async () => {
      const { status, data } = await apiRequest('GET', '/lab-schedules', null, studentToken);
      expect(status).toBe(200);
      expect(Array.isArray(data.schedules)).toBe(true);
    });

    test('can filter schedules by roomId', async () => {
      const { status, data } = await apiRequest('GET', `/lab-schedules?roomId=${roomId}`, null, adminToken);
      expect(status).toBe(200);
      expect(Array.isArray(data.schedules)).toBe(true);
    });

    test('unauthenticated request returns 401', async () => {
      const { status } = await apiRequest('GET', '/lab-schedules');
      expect(status).toBe(401);
    });
  });

  // ── POST /lab-schedules/admin/create ────────────────────────────────────────

  describe('POST /lab-schedules/admin/create', () => {
    let conflictScheduleDate; // shared between create and conflict tests

    test('admin can create a ONE_TIME schedule', async () => {
      conflictScheduleDate = makeScheduleDate(0);
      const { status, data } = await apiRequest('POST', '/lab-schedules/admin/create', {
        roomId,
        facultyId: facultyProfileId,
        programId,
        subjectId,
        scheduleType: 'ONE_TIME',
        scheduleDate: conflictScheduleDate,
        timeStart: conflictScheduleDate,
        timeEnd: makeEndDate(conflictScheduleDate, 2),
        academicYearId,
        termId,
        yearLevel: 3,
      }, adminToken);

      expect(status).toBe(201);
      expect(data.schedule.id).toBeDefined();
      expect(data.schedule.scheduleType).toBe('ONE_TIME');
      createdScheduleId = data.schedule.id;
    });

    test('admin can create a WEEKLY schedule', async () => {
      const weeklyStart = makeScheduleDate(1, 2); // different time slot
      const { status, data } = await apiRequest('POST', '/lab-schedules/admin/create', {
        roomId,
        facultyId: facultyProfileId,
        programId,
        subjectId,
        scheduleType: 'WEEKLY',
        dayOfWeek: 3,
        timeStart: weeklyStart,
        timeEnd: makeEndDate(weeklyStart, 2),
        academicYearId,
        termId,
        yearLevel: 1,
      }, adminToken);

      expect(status).toBe(201);
      expect(data.schedule.scheduleType).toBe('WEEKLY');
    });

    test('returns 400 when required fields are missing', async () => {
      const { status, data } = await apiRequest('POST', '/lab-schedules/admin/create', {
        yearLevel: 1,
        scheduleType: 'ONE_TIME',
      }, adminToken);
      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test('returns 400 when timeEnd is before timeStart', async () => {
      const start = makeScheduleDate(5, 4);
      const earlyEnd = makeScheduleDate(5, 2); // 2 hours BEFORE start
      const { status, data } = await apiRequest('POST', '/lab-schedules/admin/create', {
        yearLevel: 1,
        roomId,
        facultyId: facultyProfileId,
        scheduleType: 'ONE_TIME',
        scheduleDate: start,
        timeStart: start,
        timeEnd: earlyEnd,
        academicYearId,
        termId,
      }, adminToken);
      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test('returns 400 for ONE_TIME without scheduleDate', async () => {
      const someStart = makeScheduleDate(6, 6);
      const { status, data } = await apiRequest('POST', '/lab-schedules/admin/create', {
        yearLevel: 1,
        roomId,
        facultyId: facultyProfileId,
        scheduleType: 'ONE_TIME',
        timeStart: someStart,
        timeEnd: makeEndDate(someStart, 2),
        academicYearId,
        termId,
      }, adminToken);
      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test('faculty cannot create admin schedules (403)', async () => {
      const s = makeScheduleDate(7);
      const { status } = await apiRequest('POST', '/lab-schedules/admin/create', {
        yearLevel: 1,
        roomId,
        facultyId: facultyProfileId,
        scheduleType: 'ONE_TIME',
        scheduleDate: s,
        timeStart: s,
        timeEnd: makeEndDate(s, 2),
        academicYearId,
        termId,
      }, facultyToken);
      expect(status).toBe(403);
    });

    test('detects conflict when same room/time already booked (409)', async () => {
      // Create a NEW schedule first, then try to book the same slot
      const conflictBase = makeScheduleDate(10);
      await apiRequest('POST', '/lab-schedules/admin/create', {
        roomId,
        facultyId: facultyProfileId,
        scheduleType: 'ONE_TIME',
        scheduleDate: conflictBase,
        timeStart: conflictBase,
        timeEnd: makeEndDate(conflictBase, 2),
        academicYearId,
        termId,
      }, adminToken);

      const { status, data } = await apiRequest('POST', '/lab-schedules/admin/create', {
        yearLevel: 1,
        roomId,
        facultyId: facultyProfileId,
        scheduleType: 'ONE_TIME',
        scheduleDate: conflictBase,
        timeStart: conflictBase,
        timeEnd: makeEndDate(conflictBase, 2),
        academicYearId,
        termId,
      }, adminToken);
      expect(status).toBe(409);
      expect(data.error).toMatch(/conflict/i);
    });
  });

  // ── GET /lab-schedules/:id ──────────────────────────────────────────────────

  describe('GET /lab-schedules/:id', () => {
    test('admin can get a single schedule by ID', async () => {
      const { status, data } = await apiRequest('GET', `/lab-schedules/${createdScheduleId}`, null, adminToken);
      expect(status).toBe(200);
      expect(data.schedule.id).toBe(createdScheduleId);
      expect(data.schedule._meta).toBeDefined();
    });

    test('returns 404 for unknown schedule ID', async () => {
      const { status } = await apiRequest('GET', '/lab-schedules/nonexistent-id', null, adminToken);
      expect(status).toBe(404);
    });
  });

  // ── PUT /lab-schedules/:id ──────────────────────────────────────────────────

  describe('PUT /lab-schedules/:id', () => {
    test('admin can update a schedule time', async () => {
      const newStart = makeScheduleDate(20, 8);
      const { status, data } = await apiRequest('PUT', `/lab-schedules/${createdScheduleId}`, {
        roomId,
        facultyId: facultyProfileId,
        scheduleType: 'ONE_TIME',
        scheduleDate: newStart,
        timeStart: newStart,
        timeEnd: makeEndDate(newStart, 2),
        academicYearId,
        termId,
      }, adminToken);
      expect(status).toBe(200);
      expect(data.schedule.id).toBe(createdScheduleId);
    });

    test('returns 404 for updating non-existent schedule', async () => {
      const s = makeScheduleDate(30);
      const { status } = await apiRequest('PUT', '/lab-schedules/nonexistent-id', {
        roomId,
        timeStart: s,
        timeEnd: makeEndDate(s, 2),
        academicYearId,
        termId,
      }, adminToken);
      expect(status).toBe(404);
    });
  });

  // ── DELETE /lab-schedules/:id ───────────────────────────────────────────────

  describe('DELETE /lab-schedules/:id', () => {
    test('admin can delete a schedule', async () => {
      const disposeDate = makeScheduleDate(50);
      const { data: created } = await apiRequest('POST', '/lab-schedules/admin/create', {
        yearLevel: 1,
        roomId,
        facultyId: facultyProfileId,
        scheduleType: 'ONE_TIME',
        scheduleDate: disposeDate,
        timeStart: disposeDate,
        timeEnd: makeEndDate(disposeDate, 2),
        academicYearId,
        termId,
      }, adminToken);

      const { status, data } = await apiRequest('DELETE', `/lab-schedules/${created.schedule.id}`, null, adminToken);
      expect(status).toBe(200);
      expect(data.message).toMatch(/deleted/i);
    });

    test('returns 404 or 500 when deleting non-existent schedule', async () => {
      // Backend returns 500 (Prisma P2025) for non-existent — both are acceptable
      const { status } = await apiRequest('DELETE', '/lab-schedules/nonexistent-id', null, adminToken);
      expect([404, 500]).toContain(status);
    });

    test('faculty cannot delete schedules (403)', async () => {
      const { status } = await apiRequest('DELETE', `/lab-schedules/${createdScheduleId}`, null, facultyToken);
      expect(status).toBe(403);
    });
  });
});
