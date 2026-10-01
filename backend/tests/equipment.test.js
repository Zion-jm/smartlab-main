const { assertLocalTestEnvironment, cleanupFixtures } = require('./support/localFixtureCleanup');
const { apiRequest, getAdminToken, getFacultyToken, getStudentToken } = require('./helpers');

describe('Equipment', () => {
  let adminToken, facultyToken, studentToken;
  let createdEquipmentId;
  const fixtureIds = [];
  let zeroStockEquipmentId;

  beforeAll(async () => {
    assertLocalTestEnvironment();
    [adminToken, facultyToken, studentToken] = await Promise.all([
      getAdminToken(),
      getFacultyToken(),
      getStudentToken(),
    ]);
  });

  afterAll(async () => cleanupFixtures({ equipmentIds: fixtureIds }));

  // ── GET /equipment ──────────────────────────────────────────────────────────

  describe('GET /equipment', () => {
    test('admin can list all equipment', async () => {
      const { status, data } = await apiRequest('GET', '/equipment', null, adminToken);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    test('faculty can list all equipment', async () => {
      const { status, data } = await apiRequest('GET', '/equipment', null, facultyToken);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    test('student can list equipment', async () => {
      const { status, data } = await apiRequest('GET', '/equipment', null, studentToken);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    test('unauthenticated request returns 401', async () => {
      const { status } = await apiRequest('GET', '/equipment');
      expect(status).toBe(401);
    });

    test('filters by status AVAILABLE', async () => {
      const { status, data } = await apiRequest('GET', '/equipment?status=AVAILABLE', null, adminToken);
      expect(status).toBe(200);
      data.forEach(eq => expect(eq.status).toBe('AVAILABLE'));
    });

    test('filters by search term', async () => {
      const { status, data } = await apiRequest('GET', '/equipment?search=laptop', null, adminToken);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  // ── POST /equipment ─────────────────────────────────────────────────────────

  describe('POST /equipment', () => {
    test('admin can create equipment with valid data', async () => {
      const { status, data } = await apiRequest('POST', '/equipment', {
        name: `Test Projector ${Date.now()}`,
        description: 'A test projector',
        totalQuantity: 5,
        borrowedQuantity: 0,
        damagedQuantity: 0,
      }, adminToken);
      if (data.id) fixtureIds.push(data.id);
      expect(status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.availableQuantity).toBe(5);
      expect(data.status).toBe('AVAILABLE');
      createdEquipmentId = data.id;
    });

    test('auto-derives UNAVAILABLE status when totalQuantity is 0', async () => {
      const { status, data } = await apiRequest('POST', '/equipment', {
        name: `Zero Stock ${Date.now()}`,
        totalQuantity: 0,
        borrowedQuantity: 0,
        damagedQuantity: 0,
      }, adminToken);
      if (data.id) fixtureIds.push(data.id);
      expect(status).toBe(201);
      expect(data.status).toBe('UNAVAILABLE');
      expect(data.availableQuantity).toBe(0);
      zeroStockEquipmentId = data.id;
    });

    test('rejects equipment without a name', async () => {
      const { status, data } = await apiRequest('POST', '/equipment', {
        totalQuantity: 3,
      }, adminToken);
      expect(status).toBe(400);
      expect(data.error).toMatch(/name/i);
    });

    test('rejects when borrowed + damaged exceeds total', async () => {
      const { status, data } = await apiRequest('POST', '/equipment', {
        name: 'Bad Quantities',
        totalQuantity: 2,
        borrowedQuantity: 2,
        damagedQuantity: 1,
      }, adminToken);
      expect(status).toBe(400);
      expect(data.error).toMatch(/exceed/i);
    });

    test('faculty cannot create equipment (403)', async () => {
      const { status } = await apiRequest('POST', '/equipment', {
        name: 'Faculty Attempt',
        totalQuantity: 1,
      }, facultyToken);
      expect(status).toBe(403);
    });
  });

  // ── GET /equipment/:id ──────────────────────────────────────────────────────

  describe('GET /equipment/:id', () => {
    test('admin can get equipment by ID', async () => {
      const { status, data } = await apiRequest('GET', `/equipment/${createdEquipmentId}`, null, adminToken);
      expect(status).toBe(200);
      expect(data.id).toBe(createdEquipmentId);
    });

    test('returns 404 for unknown ID', async () => {
      const { status } = await apiRequest('GET', '/equipment/nonexistent-id-xyz', null, adminToken);
      expect(status).toBe(404);
    });
  });

  // ── GET /equipment/stats/overview ───────────────────────────────────────────

  describe('GET /equipment/stats/overview', () => {
    test('admin gets inventory stats', async () => {
      const { status, data } = await apiRequest('GET', '/equipment/stats/overview', null, adminToken);
      expect(status).toBe(200);
      expect(data.inventory).toBeDefined();
      expect(typeof data.inventory.uniqueItems).toBe('number');
      expect(typeof data.inventory.utilizationRate).toBe('number');
      expect(data.pendingRequests).toBeDefined();
    });

    test('faculty cannot access stats (403)', async () => {
      const { status } = await apiRequest('GET', '/equipment/stats/overview', null, facultyToken);
      expect(status).toBe(403);
    });
  });

  // ── PUT /equipment/:id ──────────────────────────────────────────────────────

  describe('PUT /equipment/:id', () => {
    test('admin can update equipment name and quantities', async () => {
      const { status, data } = await apiRequest('PUT', `/equipment/${createdEquipmentId}`, {
        name: 'Updated Projector Name',
        totalQuantity: 10,
        borrowedQuantity: 0,
        damagedQuantity: 2,
      }, adminToken);
      expect(status).toBe(200);
      expect(data.name).toBe('Updated Projector Name');
      expect(data.availableQuantity).toBe(8);
    });

    test('rejects update with empty name', async () => {
      const { status } = await apiRequest('PUT', `/equipment/${createdEquipmentId}`, {
        name: '',
        totalQuantity: 5,
      }, adminToken);
      expect(status).toBe(400);
    });

    test('returns 404 for updating unknown equipment', async () => {
      const { status } = await apiRequest('PUT', '/equipment/nonexistent-id', {
        name: 'Ghost',
        totalQuantity: 1,
      }, adminToken);
      expect(status).toBe(404);
    });
  });

  // ── DELETE /equipment/:id ───────────────────────────────────────────────────

  describe('DELETE /equipment/:id', () => {
    test('admin retirement preserves equipment', async () => {
      const { data: created } = await apiRequest('POST', '/equipment', {
        name: `Delete Me ${Date.now()}`,
        totalQuantity: 1,
      }, adminToken);
      if (created.id) fixtureIds.push(created.id);
      const { status, data } = await apiRequest('DELETE', `/equipment/${created.id}`, null, adminToken);
      expect(status).toBe(200);
      expect(data.message).toMatch(/retired/i);
      const retained = await apiRequest('GET', `/equipment/${created.id}`, null, adminToken);
      expect(retained.status).toBe(200);
      expect(retained.data.status).toBe('UNAVAILABLE');
    });

    test('returns 404 when deleting non-existent equipment', async () => {
      const { status } = await apiRequest('DELETE', '/equipment/does-not-exist', null, adminToken);
      expect(status).toBe(404);
    });

    test('student cannot delete equipment (403)', async () => {
      const { status } = await apiRequest('DELETE', `/equipment/${createdEquipmentId}`, null, studentToken);
      expect(status).toBe(403);
    });
  });
});
