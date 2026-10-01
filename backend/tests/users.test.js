const { assertLocalTestEnvironment, cleanupFixtures } = require('./support/localFixtureCleanup');
const { apiRequest, getAdminToken, getFacultyToken, getStudentToken } = require('./helpers');

describe('User Management', () => {
  let adminToken, facultyToken, studentToken;
  let createdUserId;
  const fixtureIds = [];
  afterAll(async () => cleanupFixtures({ userIds: fixtureIds }));
  let departmentId, programId;
  const ts = Date.now();

  beforeAll(async () => {
    assertLocalTestEnvironment();
    [adminToken, facultyToken, studentToken] = await Promise.all([
      getAdminToken(),
      getFacultyToken(),
      getStudentToken(),
    ]);

    // Fetch existing department and program IDs for user creation
    const { data: dirData } = await apiRequest('GET', '/academic-directory', null, adminToken);
    departmentId = dirData.departments?.[0]?.id ?? null;
    programId = dirData.programs?.[0]?.id ?? null;
  });

  // ── GET /users ──────────────────────────────────────────────────────────────

  describe('GET /users', () => {
    test('admin can list all users', async () => {
      const { status, data } = await apiRequest('GET', '/users', null, adminToken);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    test('filters users by role FACULTY', async () => {
      const { status, data } = await apiRequest('GET', '/users?role=FACULTY', null, adminToken);
      expect(status).toBe(200);
      data.forEach(u => expect(u.role_name).toBe('FACULTY'));
    });

    test('filters users by role STUDENT', async () => {
      const { status, data } = await apiRequest('GET', '/users?role=STUDENT', null, adminToken);
      expect(status).toBe(200);
      data.forEach(u => expect(u.role_name).toBe('STUDENT'));
    });

    test('searches users by name', async () => {
      const { status, data } = await apiRequest('GET', '/users?search=admin', null, adminToken);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    test('faculty cannot list all users (403)', async () => {
      const { status } = await apiRequest('GET', '/users', null, facultyToken);
      expect(status).toBe(403);
    });

    test('student cannot list all users (403)', async () => {
      const { status } = await apiRequest('GET', '/users', null, studentToken);
      expect(status).toBe(403);
    });
  });

  // ── POST /users ─────────────────────────────────────────────────────────────

  describe('POST /users', () => {
    test('admin creates a student user successfully', async () => {
      const { status, data } = await apiRequest('POST', '/users', {
        first_name: 'Test',
        last_name: 'Student',
        gmail: `teststudent_${ts}@smartlab.local`,
        password: 'Password123!',
        role_id: 3,
        status_id: 1,
        program_id: programId,
        year_level: 2,
      }, adminToken);
      if (data.user?.user_id) fixtureIds.push(data.user.user_id);
      expect(status).toBe(201);
      expect(data.user.role_name).toBe('STUDENT');
      expect(data.user.user_id).toBeDefined();
      createdUserId = data.user.user_id;
    });

    test('admin creates a faculty user with department', async () => {
      const { status, data } = await apiRequest('POST', '/users', {
        first_name: 'Test',
        last_name: 'Faculty',
        gmail: `testfaculty_${ts}@smartlab.local`,
        password: 'Password123!',
        role_id: 2,
        status_id: 1,
        department_id: departmentId,
      }, adminToken);
      if (data.user?.user_id) fixtureIds.push(data.user.user_id);
      expect(status).toBe(201);
      expect(data.user.role_name).toBe('FACULTY');
    });

    test('rejects missing required fields', async () => {
      const { status, data } = await apiRequest('POST', '/users', {
        gmail: `incomplete_${ts}@smartlab.local`,
        password: 'Password123!',
      }, adminToken);
      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test('rejects duplicate email', async () => {
      const { status, data } = await apiRequest('POST', '/users', {
        first_name: 'Dup',
        last_name: 'User',
        gmail: 'admin@smartlab.local',
        password: 'Password123!',
        role_id: 3,
        status_id: 1,
        program_id: programId,
        year_level: 1,
      }, adminToken);
      expect(status).toBe(409);
      expect(data.error).toMatch(/already registered/i);
    });

    test('rejects faculty without department', async () => {
      const { status, data } = await apiRequest('POST', '/users', {
        first_name: 'No',
        last_name: 'Dept',
        gmail: `nodept_${ts}@smartlab.local`,
        password: 'Password123!',
        role_id: 2,
        status_id: 1,
      }, adminToken);
      expect(status).toBe(400);
      expect(data.error).toMatch(/department/i);
    });

    test('rejects student without program/year level', async () => {
      const { status, data } = await apiRequest('POST', '/users', {
        first_name: 'No',
        last_name: 'Program',
        gmail: `noprog_${ts}@smartlab.local`,
        password: 'Password123!',
        role_id: 3,
        status_id: 1,
      }, adminToken);
      expect(status).toBe(400);
      expect(data.error).toMatch(/program|year/i);
    });

    test('faculty cannot create users (403)', async () => {
      const { status } = await apiRequest('POST', '/users', {
        first_name: 'X',
        last_name: 'Y',
        gmail: `xfac_${ts}@smartlab.local`,
        password: 'P@ssword1',
        role_id: 3,
        status_id: 1,
      }, facultyToken);
      expect(status).toBe(403);
    });
  });

  // ── GET /users/:id ──────────────────────────────────────────────────────────

  describe('GET /users/:id', () => {
    test('admin can get any user by ID', async () => {
      const { status, data } = await apiRequest('GET', `/users/${createdUserId}`, null, adminToken);
      expect(status).toBe(200);
      expect(data.user.id).toBe(createdUserId);
    });

    test('returns 404 for non-existent user', async () => {
      const { status } = await apiRequest('GET', '/users/nonexistent-user-id', null, adminToken);
      expect(status).toBe(404);
    });
  });

  // ── PATCH /users/:id/status ─────────────────────────────────────────────────

  describe('PATCH /users/:id/status', () => {
    test('admin can deactivate a user', async () => {
      const { status, data } = await apiRequest('PATCH', `/users/${createdUserId}/status`, {
        status: 'DEACTIVATED',
      }, adminToken);
      expect(status).toBe(200);
      expect(data.user.status).toBe('DEACTIVATED');
    });

    test('admin can reactivate a user', async () => {
      const { status, data } = await apiRequest('PATCH', `/users/${createdUserId}/status`, {
        status: 'ACTIVE',
      }, adminToken);
      expect(status).toBe(200);
      expect(data.user.status).toBe('ACTIVE');
    });
  });

  // ── PUT /users/:id ──────────────────────────────────────────────────────────

  describe('PUT /users/:id', () => {
    test('admin can update a user name', async () => {
      const { status, data } = await apiRequest('PUT', `/users/${createdUserId}`, {
        first_name: 'Updated',
        last_name: 'Name',
        program_id: programId,
        year_level: 3,
      }, adminToken);
      expect(status).toBe(200);
      expect(data.user.first_name).toBe('Updated');
    });
  });

  // ── DELETE /users/:id ───────────────────────────────────────────────────────

  describe('DELETE /users/:id', () => {
    test('admin retirement preserves the account', async () => {
      const { status, data } = await apiRequest('DELETE', `/users/${createdUserId}`, null, adminToken);
      expect(status).toBe(200);
      expect(data.message).toMatch(/deactivated/i);
      const retained = await apiRequest('GET', `/users/${createdUserId}`, null, adminToken);
      expect(retained.status).toBe(200);
      expect(retained.data.user.status).toBe('DEACTIVATED');
    });

    test('returns 404 for non-existent user retirement', async () => {
      const { status } = await apiRequest('DELETE', '/users/non-existent-id', null, adminToken);
      expect(status).toBe(404);
    });
  });
});
