const { assertLocalTestEnvironment, cleanupFixtures } = require('./support/localFixtureCleanup');
const { apiRequest, getAdminToken, loginAs } = require('./helpers');

describe('Authentication', () => {
  let adminToken;

  beforeAll(async () => {
    assertLocalTestEnvironment();
    adminToken = await getAdminToken();
  });

  // ── Login ──────────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    test('returns token and user for valid admin credentials', async () => {
      const { status, data } = await apiRequest('POST', '/auth/login', {
        email: 'admin@smartlab.local',
        password: 'SmartLab123!',
      });
      expect(status).toBe(200);
      expect(data.token).toBeDefined();
      expect(data.user.role).toBe('ADMIN');
      expect(data.user.email).toBe('admin@smartlab.local');
    });

    test('returns token for valid faculty credentials', async () => {
      const { status, data } = await apiRequest('POST', '/auth/login', {
        email: 'jane.delacruz@smartlab.local',
        password: 'SmartLab123!',
      });
      expect(status).toBe(200);
      expect(data.token).toBeDefined();
      expect(data.user.role).toBe('FACULTY');
    });

    test('returns token for valid student credentials', async () => {
      const { status, data } = await apiRequest('POST', '/auth/login', {
        email: 'paolo.santos@smartlab.local',
        password: 'SmartLab123!',
      });
      expect(status).toBe(200);
      expect(data.token).toBeDefined();
      expect(data.user.role).toBe('STUDENT');
    });

    test('rejects wrong password with 401', async () => {
      const { status, data } = await apiRequest('POST', '/auth/login', {
        email: 'admin@smartlab.local',
        password: 'WrongPassword!',
      });
      expect(status).toBe(401);
      expect(data.error).toBe('Invalid credentials');
    });

    test('rejects non-existent email with 401', async () => {
      const { status, data } = await apiRequest('POST', '/auth/login', {
        email: 'nobody@smartlab.local',
        password: 'SmartLab123!',
      });
      expect(status).toBe(401);
      expect(data.error).toBe('Invalid credentials');
    });
  });

  // ── Register ────────────────────────────────────────────────────────────────

  describe('Public registration is disabled', () => {
    test.each(['ADMIN', 'FACULTY', 'STUDENT', undefined])(
      'rejects unauthenticated signup with role %s without creating an account',
      async (role) => {
        const email = `blocked_${role ?? 'default'}_${Date.now()}@smartlab.local`;
        const { status, data } = await apiRequest('POST', '/auth/register', {
          email, password: 'Password123!', firstName: 'Blocked', lastName: 'Signup', role,
        });
        expect(status).toBe(404);
        expect(data.token).toBeUndefined();
        const users = await apiRequest('GET', '/users?search=' + encodeURIComponent(email), null, adminToken);
        expect(users.status).toBe(200);
        expect(users.data).toEqual([]);
      }
    );

    test('registration remains unavailable even with an administrator token', async () => {
      const { status, data } = await apiRequest('POST', '/auth/register', {
        email: `blocked_admin_${Date.now()}@smartlab.local`, password: 'Password123!',
        firstName: 'Blocked', lastName: 'Signup', role: 'ADMIN',
      }, adminToken);
      expect(status).toBe(404);
      expect(data.token).toBeUndefined();
    });
  });

  describe('Administrator-managed account creation', () => {
    test('rejects account creation without authentication', async () => {
      const { status } = await apiRequest('POST', '/users', {});
      expect(status).toBe(401);
    });

    test.each(['jane.delacruz@smartlab.local', 'paolo.santos@smartlab.local'])(
      'rejects account creation by %s', async (email) => {
        const token = await loginAs(email);
        const { status } = await apiRequest('POST', '/users', {
          first_name: 'Blocked', last_name: 'Creator',
          gmail: `blocked_creator_${Date.now()}@smartlab.local`,
          password: 'Password123!', role_id: 1, status_id: 1,
        }, token);
        expect(status).toBe(403);
      }
    );

    test.each([[1, 'ADMIN'], [2, 'FACULTY'], [3, 'STUDENT']])(
      'administrator can create role %s (%s), and the new account can log in',
      async (roleId, roleName) => {
        const directory = await apiRequest('GET', '/academic-directory', null, adminToken);
        expect(directory.status).toBe(200);
        const email = `admin_created_${roleName}_${Date.now()}@smartlab.local`;
        let createdId;
        try {
          const { status, data } = await apiRequest('POST', '/users', {
            first_name: 'Registration', last_name: 'Regression', gmail: email,
            password: 'Password123!', role_id: roleId, status_id: 1,
            department_id: directory.data.departments?.[0]?.id,
            program_id: directory.data.programs?.[0]?.id, year_level: 2,
          }, adminToken);
          createdId = data.user?.user_id;
          expect(status).toBe(201);
          expect(createdId).toBeDefined();
          expect(data.user.role_name).toBe(roleName);
          const login = await apiRequest('POST', '/auth/login', { email, password: 'Password123!' });
          expect(login.status).toBe(200);
          expect(login.data.user.role).toBe(roleName);
          expect(login.data.token).toBeDefined();
        } finally {
          if (createdId) {
            await cleanupFixtures({ userIds: [createdId] });
          }
        }
      }
    );
  });

  // ── GET /me ─────────────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    test('returns current user profile with valid token', async () => {
      const { status, data } = await apiRequest('GET', '/auth/me', null, adminToken);
      expect(status).toBe(200);
      expect(data.user.email).toBe('admin@smartlab.local');
      expect(data.user.role).toBe('ADMIN');
    });

    test('returns 401 without token', async () => {
      const { status } = await apiRequest('GET', '/auth/me');
      expect(status).toBe(401);
    });

    test('returns 401 with invalid token', async () => {
      const { status } = await apiRequest('GET', '/auth/me', null, 'invalid.token.here');
      expect(status).toBe(401);
    });
  });
});
