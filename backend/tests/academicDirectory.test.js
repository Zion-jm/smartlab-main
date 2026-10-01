const { apiRequest, getAdminToken, getFacultyToken } = require('./helpers');

describe('Academic Directory', () => {
  let adminToken, facultyToken;
  let buildingId, roomId, programId, subjectId, departmentId;

  // Use random suffix so codes are unique across test runs regardless of date
  const uid = () => Math.random().toString(36).slice(2, 8).toUpperCase();
  const ts = Date.now();

  beforeAll(async () => {
    [adminToken, facultyToken] = await Promise.all([getAdminToken(), getFacultyToken()]);
  });

  // ── GET / ────────────────────────────────────────────────────────────────────

  describe('GET /academic-directory', () => {
    test('admin gets full directory summary', async () => {
      const { status, data } = await apiRequest('GET', '/academic-directory', null, adminToken);
      expect(status).toBe(200);
      expect(data.summary).toBeDefined();
      expect(typeof data.summary.buildings).toBe('number');
      expect(typeof data.summary.rooms).toBe('number');
      expect(typeof data.summary.programs).toBe('number');
      expect(Array.isArray(data.buildings)).toBe(true);
      expect(Array.isArray(data.rooms)).toBe(true);
      expect(Array.isArray(data.programs)).toBe(true);
      expect(Array.isArray(data.subjects)).toBe(true);
      expect(Array.isArray(data.departments)).toBe(true);
    });

    test('faculty cannot access directory (403)', async () => {
      const { status } = await apiRequest('GET', '/academic-directory', null, facultyToken);
      expect(status).toBe(403);
    });

    test('unauthenticated request returns 401', async () => {
      const { status } = await apiRequest('GET', '/academic-directory');
      expect(status).toBe(401);
    });
  });

  // ── GET /programs ─────────────────────────────────────────────────────────────

  describe('GET /academic-directory/programs', () => {
    test('admin gets programs list', async () => {
      const { status, data } = await apiRequest('GET', '/academic-directory/programs', null, adminToken);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data[0].program_id).toBeDefined();
        expect(data[0].program_code).toBeDefined();
        expect(data[0].program_name).toBeDefined();
      }
    });
  });

  // ── GET /departments ──────────────────────────────────────────────────────────

  describe('GET /academic-directory/departments', () => {
    test('admin gets departments list', async () => {
      const { status, data } = await apiRequest('GET', '/academic-directory/departments', null, adminToken);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data[0].department_id).toBeDefined();
        expect(data[0].department_name).toBeDefined();
      }
    });
  });

  // ── Buildings ─────────────────────────────────────────────────────────────────

  describe('POST /academic-directory/buildings', () => {
    test('admin creates a building', async () => {
      const { status, data } = await apiRequest('POST', '/academic-directory/buildings', {
        name: `Test Building ${ts}`,
      }, adminToken);
      expect(status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.name).toMatch(/Test Building/);
      buildingId = data.id;
    });

    test('rejects building with empty name', async () => {
      const { status, data } = await apiRequest('POST', '/academic-directory/buildings', {
        name: '',
      }, adminToken);
      expect(status).toBe(400);
      expect(data.error).toMatch(/name/i);
    });
  });

  describe('PUT /academic-directory/buildings/:id', () => {
    test('admin updates a building name', async () => {
      const { status, data } = await apiRequest('PUT', `/academic-directory/buildings/${buildingId}`, {
        name: `Updated Building ${ts}`,
      }, adminToken);
      expect(status).toBe(200);
      expect(data.name).toMatch(/Updated Building/);
    });
  });

  // ── Rooms ─────────────────────────────────────────────────────────────────────

  describe('POST /academic-directory/rooms', () => {
    test('admin creates a room', async () => {
      const { status, data } = await apiRequest('POST', '/academic-directory/rooms', {
        roomNumber: `R-${ts}`,
        roomName: 'Test Lab Room',
        buildingId,
        isComputerLab: true,
      }, adminToken);
      expect(status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.isComputerLab).toBe(true);
      roomId = data.id;
    });

    test('rejects room with empty roomNumber', async () => {
      const { status, data } = await apiRequest('POST', '/academic-directory/rooms', {
        roomNumber: '',
      }, adminToken);
      expect(status).toBe(400);
      expect(data.error).toMatch(/room number/i);
    });
  });

  describe('PUT /academic-directory/rooms/:id', () => {
    test('admin updates a room', async () => {
      const { status, data } = await apiRequest('PUT', `/academic-directory/rooms/${roomId}`, {
        roomNumber: `R-${ts}-UPD`,
        roomName: 'Updated Lab',
        buildingId,
        isComputerLab: false,
      }, adminToken);
      expect(status).toBe(200);
      expect(data.isComputerLab).toBe(false);
    });
  });

  // ── Programs ──────────────────────────────────────────────────────────────────

  describe('POST /academic-directory/programs', () => {
    test('admin creates a program', async () => {
      const code = `P${uid()}`;
      const { status, data } = await apiRequest('POST', '/academic-directory/programs', {
        code,
        name: `Test Program ${ts}`,
      }, adminToken);
      expect(status).toBe(201);
      expect(data.id).toBeDefined();
      programId = data.id;
    });

    test('rejects program with missing code or name', async () => {
      const { status, data } = await apiRequest('POST', '/academic-directory/programs', {
        code: '',
        name: '',
      }, adminToken);
      expect(status).toBe(400);
      expect(data.error).toMatch(/code|name/i);
    });
  });

  describe('PUT /academic-directory/programs/:id', () => {
    test('admin updates a program', async () => {
      const code = `U${uid()}`;
      const { status, data } = await apiRequest('PUT', `/academic-directory/programs/${programId}`, {
        code,
        name: `Updated Program ${ts}`,
      }, adminToken);
      expect(status).toBe(200);
      expect(data.code).toBe(code.toUpperCase());
    });
  });

  // ── Subjects ──────────────────────────────────────────────────────────────────

  describe('POST /academic-directory/subjects', () => {
    test('admin creates a subject', async () => {
      const code = `S${uid()}`;
      const { status, data } = await apiRequest('POST', '/academic-directory/subjects', {
        code,
        name: `Test Subject ${ts}`,
      }, adminToken);
      expect(status).toBe(201);
      expect(data.id).toBeDefined();
      subjectId = data.id;
    });

    test('rejects subject with missing code or name', async () => {
      const { status } = await apiRequest('POST', '/academic-directory/subjects', {
        code: '',
        name: '',
      }, adminToken);
      expect(status).toBe(400);
    });
  });

  describe('PUT /academic-directory/subjects/:id', () => {
    test('admin updates a subject', async () => {
      const code = `V${uid()}`;
      const { status, data } = await apiRequest('PUT', `/academic-directory/subjects/${subjectId}`, {
        code,
        name: `Updated Subject ${ts}`,
      }, adminToken);
      expect(status).toBe(200);
      expect(data.code).toBe(code.toUpperCase());
    });
  });

  // ── Departments ───────────────────────────────────────────────────────────────

  describe('POST /academic-directory/departments', () => {
    test('admin creates a department', async () => {
      const { status, data } = await apiRequest('POST', '/academic-directory/departments', {
        name: `Test Department ${ts}`,
      }, adminToken);
      expect(status).toBe(201);
      expect(data.id).toBeDefined();
      departmentId = data.id;
    });

    test('rejects department with empty name', async () => {
      const { status, data } = await apiRequest('POST', '/academic-directory/departments', {
        name: '',
      }, adminToken);
      expect(status).toBe(400);
      expect(data.error).toMatch(/name/i);
    });
  });

  describe('PUT /academic-directory/departments/:id', () => {
    test('admin updates a department', async () => {
      const { status, data } = await apiRequest('PUT', `/academic-directory/departments/${departmentId}`, {
        name: `Updated Department ${ts}`,
      }, adminToken);
      expect(status).toBe(200);
      expect(data.name).toMatch(/Updated Department/);
    });
  });
});
