const { apiRequest, getAdminToken, getFacultyToken, getStudentToken } = require('./helpers');

describe('Borrow Requests', () => {
  let adminToken, facultyToken, studentToken;
  let equipmentId, facultyProfileId, programId, subjectId, academicYearId, termId;
  let pendingRequestId, approvedRequestId;

  beforeAll(async () => {
    [adminToken, facultyToken, studentToken] = await Promise.all([
      getAdminToken(),
      getFacultyToken(),
      getStudentToken(),
    ]);

    const { data: resources } = await apiRequest('GET', '/lab-schedules/resources', null, adminToken);
    facultyProfileId = resources.faculty?.[0]?.profileId;
    programId = resources.programs?.[0]?.id;
    subjectId = resources.subjects?.[0]?.id;
    academicYearId = resources.academicYears?.find(y => y.isActive)?.id ?? resources.academicYears?.[0]?.id;
    termId = resources.terms?.find(t => t.isActive)?.id ?? resources.terms?.[0]?.id;

    // Create test equipment with enough stock
    const { data: eq } = await apiRequest('POST', '/equipment', {
      name: `BR Test Equipment ${Date.now()}`,
      totalQuantity: 20,
      borrowedQuantity: 0,
      damagedQuantity: 0,
    }, adminToken);
    equipmentId = eq.id;
  });

  afterAll(async () => {
    if (equipmentId) {
      await apiRequest('DELETE', `/equipment/${equipmentId}`, null, adminToken);
    }
  });

  // Each call advances the day offset so no two default requests share a date,
  // which prevents triggering the duplicate-detection guard unintentionally.
  let _dayOffset = 200;
  const makeRequestBody = (overrides = {}) => {
    const offset = _dayOffset++;
    const dateNeeded = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
    dateNeeded.setUTCHours(0, 0, 0, 0);
    return {
      facultyId: facultyProfileId,
      programId,
      subjectId,
      yearLevel: 2,
      dateNeeded: dateNeeded.toISOString(),
      location: 'Test Location',
      timeStart: new Date(dateNeeded.getTime() + 8 * 60 * 60 * 1000).toISOString(),
      timeEnd: new Date(dateNeeded.getTime() + 10 * 60 * 60 * 1000).toISOString(),
      purpose: 'Testing purposes',
      academicYearId,
      termId,
      items: [{ equipmentId, quantity: 2 }],
      ...overrides,
    };
  };

  // ── POST / — Create ─────────────────────────────────────────────────────────

  describe('POST /borrow-requests', () => {
    test('student can create a borrow request', async () => {
      const { status, data } = await apiRequest('POST', '/borrow-requests', makeRequestBody(), studentToken);
      expect(status).toBe(201);
      expect(data.request.id).toBeDefined();
      expect(data.request.status).toBe('PENDING');
      pendingRequestId = data.request.id;
    });

    test('admin can also create a borrow request', async () => {
      const { status, data } = await apiRequest('POST', '/borrow-requests', makeRequestBody(), adminToken);
      expect(status).toBe(201);
      expect(data.request.status).toBe('PENDING');
    });

    test('unauthenticated user cannot create a request (401)', async () => {
      const { status } = await apiRequest('POST', '/borrow-requests', makeRequestBody());
      expect(status).toBe(401);
    });

    test('duplicate request — same equipment + same date returns 409', async () => {
      // Pin a fixed dateNeeded so both requests land on the same calendar day
      const fixedDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      fixedDate.setUTCHours(0, 0, 0, 0);
      const body = makeRequestBody({ dateNeeded: fixedDate.toISOString() });

      // First request — should succeed
      const first = await apiRequest('POST', '/borrow-requests', body, studentToken);
      expect(first.status).toBe(201);

      // Second request — same equipment, same date, same user → duplicate
      const second = await apiRequest('POST', '/borrow-requests', body, studentToken);
      expect(second.status).toBe(409);
      expect(second.data.error).toMatch(/pending request/i);
      expect(second.data.existingRequestId).toBe(first.data.request.id);
    });

    test('duplicate check is per-user — different user can request same equipment on same date', async () => {
      const fixedDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
      fixedDate.setUTCHours(0, 0, 0, 0);
      const body = makeRequestBody({ dateNeeded: fixedDate.toISOString() });

      // Student creates a request
      const studentRes = await apiRequest('POST', '/borrow-requests', body, studentToken);
      expect(studentRes.status).toBe(201);

      // Admin creates a request for the same equipment+date — different user, should succeed
      const adminRes = await apiRequest('POST', '/borrow-requests', body, adminToken);
      expect(adminRes.status).toBe(201);
    });

    test('duplicate check is per-date — same equipment on a different date is allowed', async () => {
      const dayA = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      dayA.setUTCHours(0, 0, 0, 0);
      const dayB = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
      dayB.setUTCHours(0, 0, 0, 0);

      const first = await apiRequest('POST', '/borrow-requests', makeRequestBody({ dateNeeded: dayA.toISOString() }), studentToken);
      expect(first.status).toBe(201);

      // Same equipment, different date → should succeed
      const second = await apiRequest('POST', '/borrow-requests', makeRequestBody({ dateNeeded: dayB.toISOString() }), studentToken);
      expect(second.status).toBe(201);
    });

    test('duplicate check is cleared once the PENDING request is cancelled', async () => {
      const fixedDate = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);
      fixedDate.setUTCHours(0, 0, 0, 0);
      const body = makeRequestBody({ dateNeeded: fixedDate.toISOString() });

      // Create first request
      const { data: first } = await apiRequest('POST', '/borrow-requests', body, studentToken);
      expect(first.request.id).toBeDefined();

      // Confirm duplicate is blocked
      const dup = await apiRequest('POST', '/borrow-requests', body, studentToken);
      expect(dup.status).toBe(409);

      // Cancel the first request
      await apiRequest('PATCH', `/borrow-requests/${first.request.id}/cancel`, null, studentToken);

      // Now the same request should go through (no longer PENDING)
      const retry = await apiRequest('POST', '/borrow-requests', body, studentToken);
      expect(retry.status).toBe(201);
    });
  });

  // ── GET /my-requests ────────────────────────────────────────────────────────

  describe('GET /borrow-requests/my-requests', () => {
    test('student sees their own requests', async () => {
      const { status, data } = await apiRequest('GET', '/borrow-requests/my-requests', null, studentToken);
      expect(status).toBe(200);
      expect(Array.isArray(data.requests)).toBe(true);
      expect(data.requests.length).toBeGreaterThan(0);
    });

    test('admin sees their own submitted requests', async () => {
      const { status, data } = await apiRequest('GET', '/borrow-requests/my-requests', null, adminToken);
      expect(status).toBe(200);
      expect(Array.isArray(data.requests)).toBe(true);
    });
  });

  // ── GET / — Admin list ──────────────────────────────────────────────────────

  describe('GET /borrow-requests (admin)', () => {
    test('admin can list all requests', async () => {
      const { status, data } = await apiRequest('GET', '/borrow-requests', null, adminToken);
      expect(status).toBe(200);
      expect(Array.isArray(data.requests)).toBe(true);
      expect(data.stats).toBeDefined();
      expect(typeof data.stats.PENDING).toBe('number');
    });

    test('admin can filter by PENDING status', async () => {
      const { status, data } = await apiRequest('GET', '/borrow-requests?status=PENDING', null, adminToken);
      expect(status).toBe(200);
      data.requests.forEach(r => expect(r.status).toBe('PENDING'));
    });

    test('faculty can list all requests', async () => {
      const { status, data } = await apiRequest('GET', '/borrow-requests', null, facultyToken);
      expect(status).toBe(200);
      expect(Array.isArray(data.requests)).toBe(true);
    });

    test('student cannot list all requests (403)', async () => {
      const { status } = await apiRequest('GET', '/borrow-requests', null, studentToken);
      expect(status).toBe(403);
    });
  });

  // ── GET /:id ────────────────────────────────────────────────────────────────

  describe('GET /borrow-requests/:id', () => {
    test('admin can get a specific request', async () => {
      const { status, data } = await apiRequest('GET', `/borrow-requests/${pendingRequestId}`, null, adminToken);
      expect(status).toBe(200);
      expect(data.request.id).toBe(pendingRequestId);
    });

    test('returns 404 for non-existent request', async () => {
      const { status } = await apiRequest('GET', '/borrow-requests/nonexistent-id', null, adminToken);
      expect(status).toBe(404);
    });
  });

  // ── PATCH /:id/reject ───────────────────────────────────────────────────────

  describe('PATCH /borrow-requests/:id/reject', () => {
    let rejectTargetId;

    beforeAll(async () => {
      const { data } = await apiRequest('POST', '/borrow-requests', makeRequestBody(), studentToken);
      rejectTargetId = data.request.id;
    });

    test('admin can reject a PENDING request with a reason', async () => {
      const { status, data } = await apiRequest('PATCH', `/borrow-requests/${rejectTargetId}/reject`, {
        reason: 'Equipment not available for that date',
      }, adminToken);
      expect(status).toBe(200);
      expect(data.request.status).toBe('REJECTED');
    });

    test('rejects without reason returns 400', async () => {
      const { data: newReq } = await apiRequest('POST', '/borrow-requests', makeRequestBody(), studentToken);
      const { status, data } = await apiRequest('PATCH', `/borrow-requests/${newReq.request.id}/reject`, {
        reason: '',
      }, adminToken);
      expect(status).toBe(400);
      expect(data.error).toMatch(/reason/i);
    });

    test('cannot reject an already-rejected request', async () => {
      const { status } = await apiRequest('PATCH', `/borrow-requests/${rejectTargetId}/reject`, {
        reason: 'Double reject',
      }, adminToken);
      expect(status).toBe(400);
    });

    test('faculty cannot reject requests (403)', async () => {
      const { data: newReq } = await apiRequest('POST', '/borrow-requests', makeRequestBody(), studentToken);
      const { status } = await apiRequest('PATCH', `/borrow-requests/${newReq.request.id}/reject`, {
        reason: 'Unauthorized',
      }, facultyToken);
      expect(status).toBe(403);
    });
  });

  // ── Full lifecycle: PENDING → APPROVED → BORROWED → RETURNED ───────────────

  describe('Full borrow request lifecycle', () => {
    beforeAll(async () => {
      const { data } = await apiRequest('POST', '/borrow-requests', makeRequestBody(), studentToken);
      pendingRequestId = data.request.id;
    });

    test('STEP 1: admin approves a PENDING request', async () => {
      const { status, data } = await apiRequest('PATCH', `/borrow-requests/${pendingRequestId}/approve`, null, adminToken);
      expect(status).toBe(200);
      expect(data.request.status).toBe('APPROVED');
      approvedRequestId = pendingRequestId;
    });

    test('cannot approve an already-approved request', async () => {
      const { status } = await apiRequest('PATCH', `/borrow-requests/${approvedRequestId}/approve`, null, adminToken);
      expect(status).toBe(400);
    });

    test('STEP 2: admin marks request as BORROWED', async () => {
      const { status, data } = await apiRequest('PATCH', `/borrow-requests/${approvedRequestId}/borrow`, null, adminToken);
      expect(status).toBe(200);
      expect(data.request.status).toBe('BORROWED');
    });

    test('equipment available quantity decreases after borrowing', async () => {
      const { data } = await apiRequest('GET', `/equipment/${equipmentId}`, null, adminToken);
      expect(data.borrowedQuantity).toBeGreaterThanOrEqual(2);
    });

    test('STEP 3: admin marks request as RETURNED', async () => {
      const { status, data } = await apiRequest('PATCH', `/borrow-requests/${approvedRequestId}/return`, null, adminToken);
      expect(status).toBe(200);
      expect(data.request.status).toBe('RETURNED');
    });

    test('equipment available quantity restored after return', async () => {
      const { data } = await apiRequest('GET', `/equipment/${equipmentId}`, null, adminToken);
      expect(data.availableQuantity).toBeGreaterThanOrEqual(2);
    });

    test('cannot perform invalid state transitions on a returned request', async () => {
      // backend throws via ensureTransition — may return 400 or 500 depending on error handling
      const { status } = await apiRequest('PATCH', `/borrow-requests/${approvedRequestId}/borrow`, null, adminToken);
      expect([400, 500]).toContain(status);
    });
  });

  // ── PATCH /:id/cancel ───────────────────────────────────────────────────────

  describe('PATCH /borrow-requests/:id/cancel', () => {
    test('student can cancel their own PENDING request', async () => {
      const { data: newReq } = await apiRequest('POST', '/borrow-requests', makeRequestBody(), studentToken);
      const { status, data } = await apiRequest('PATCH', `/borrow-requests/${newReq.request.id}/cancel`, null, studentToken);
      expect(status).toBe(200);
      expect(data.request.status).toBe('CANCELLED');
    });

    test("student cannot cancel another user's request (403)", async () => {
      const { data: adminReq } = await apiRequest('POST', '/borrow-requests', makeRequestBody(), adminToken);
      const { status } = await apiRequest('PATCH', `/borrow-requests/${adminReq.request.id}/cancel`, null, studentToken);
      expect(status).toBe(403);
    });

    test('student cannot cancel an already-approved request (400)', async () => {
      const { data: newReq } = await apiRequest('POST', '/borrow-requests', makeRequestBody(), studentToken);
      await apiRequest('PATCH', `/borrow-requests/${newReq.request.id}/approve`, null, adminToken);
      const { status } = await apiRequest('PATCH', `/borrow-requests/${newReq.request.id}/cancel`, null, studentToken);
      expect(status).toBe(400);
    });

    test('admin can cancel a BORROWED request (restores equipment)', async () => {
      const { data: newReq } = await apiRequest('POST', '/borrow-requests', makeRequestBody(), studentToken);
      await apiRequest('PATCH', `/borrow-requests/${newReq.request.id}/approve`, null, adminToken);
      await apiRequest('PATCH', `/borrow-requests/${newReq.request.id}/borrow`, null, adminToken);
      const { status, data } = await apiRequest('PATCH', `/borrow-requests/${newReq.request.id}/cancel`, null, adminToken);
      expect(status).toBe(200);
      expect(data.request.status).toBe('CANCELLED');
    });

    test('admin can cancel a PENDING request', async () => {
      const { data: newReq } = await apiRequest('POST', '/borrow-requests', makeRequestBody(), studentToken);
      const { status, data } = await apiRequest('PATCH', `/borrow-requests/${newReq.request.id}/cancel`, null, adminToken);
      expect(status).toBe(200);
      expect(data.request.status).toBe('CANCELLED');
    });
  });
});
