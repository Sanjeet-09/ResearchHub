const request = require('supertest');
const http = require('http');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock @rh/shared database query for controlled in-memory DB testing
jest.mock('@rh/shared', () => {
  const original = jest.requireActual('@rh/shared');
  return {
    ...original,
    query: jest.fn(),
  };
});

const { query, JWT_SECRET } = require('@rh/shared');
const authApp = require('../../auth/src/app');
const gatewayApp = require('../src/app');

describe('Phase 1 End-to-End Verification (Gateway + Auth Service)', () => {
  let authServer;
  let authPort;

  beforeAll((done) => {
    // Start auth service on an ephemeral port
    authServer = http.createServer(authApp);
    authServer.listen(0, () => {
      authPort = authServer.address().port;
      process.env.SERVICE_URL_AUTH = `http://localhost:${authPort}`;
      done();
    });
  });

  afterAll((done) => {
    if (authServer) {
      authServer.close(done);
    } else {
      done();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Full Authentication Flow: register → login → /auth/me', () => {
    it('1. register works through gateway, assigns student role by default', async () => {
      // Mock existing email check (none)
      query.mockResolvedValueOnce({ rows: [] });

      const newStudent = {
        id: 'student-uuid-001',
        email: 'alex@university.edu',
        full_name: 'Alex Rivera',
        role: 'student',
        created_at: new Date().toISOString(),
        last_seen_at: null,
      };
      // Mock insert user
      query.mockResolvedValueOnce({ rows: [newStudent] });

      const res = await request(gatewayApp)
        .post('/api/auth/register')
        .send({
          email: 'alex@university.edu',
          password: 'securepassword123',
          fullName: 'Alex Rivera',
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('alex@university.edu');
      expect(res.body.user.role).toBe('student');
      expect(res.body.token).toBeDefined();
    });

    it('2. login works through gateway, validates password and returns JWT', async () => {
      const passwordHash = await bcrypt.hash('securepassword123', 10);
      const studentUser = {
        id: 'student-uuid-001',
        email: 'alex@university.edu',
        password_hash: passwordHash,
        full_name: 'Alex Rivera',
        role: 'student',
        created_at: new Date().toISOString(),
      };

      // Mock user lookup
      query.mockResolvedValueOnce({ rows: [studentUser] });
      // Mock update last_seen_at
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(gatewayApp)
        .post('/api/auth/login')
        .send({
          email: 'alex@university.edu',
          password: 'securepassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('alex@university.edu');
      expect(res.body.user.role).toBe('student');
      expect(res.body.user.password_hash).toBeUndefined();
    });

    it('3. /auth/me works through gateway with Bearer token', async () => {
      const studentUser = {
        id: 'student-uuid-001',
        email: 'alex@university.edu',
        full_name: 'Alex Rivera',
        role: 'student',
        created_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      };

      const token = jwt.sign(
        { sub: studentUser.id, role: studentUser.role, name: studentUser.full_name },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      // Mock lookup in auth-service getMe
      query.mockResolvedValueOnce({ rows: [studentUser] });
      // Mock update last_seen_at
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(gatewayApp)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual(studentUser);
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  describe('RBAC Verification: student/professor vs admin access', () => {
    it('4. unauthenticated call to protected route returns 401', async () => {
      const res = await request(gatewayApp).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('5. non-admin (student/professor) cannot reach admin-only role update (returns 403 Forbidden)', async () => {
      const professorToken = jwt.sign(
        { sub: 'prof-uuid-001', role: 'professor', name: 'Prof. Vance' },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      const res = await request(gatewayApp)
        .patch('/api/auth/users/target-user-id/role')
        .set('Authorization', `Bearer ${professorToken}`)
        .send({ role: 'researcher' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('6. admin can reach and update user roles successfully', async () => {
      const adminToken = jwt.sign(
        { sub: 'admin-uuid-001', role: 'admin', name: 'Admin System' },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      const updatedTargetUser = {
        id: 'target-user-id',
        email: 'promoted@university.edu',
        full_name: 'Promoted Researcher',
        role: 'researcher',
        created_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      };

      query.mockResolvedValueOnce({ rows: [{ id: 'target-user-id', role: 'student' }] });
      query.mockResolvedValueOnce({ rows: [updatedTargetUser] });

      const res = await request(gatewayApp)
        .patch('/api/auth/users/target-user-id/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'researcher' });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('researcher');
    });
  });
});
