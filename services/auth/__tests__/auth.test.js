const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock @rh/shared database query
jest.mock('@rh/shared', () => {
  const original = jest.requireActual('@rh/shared');
  return {
    ...original,
    query: jest.fn(),
  };
});

const { query, JWT_SECRET } = require('@rh/shared');
const app = require('../src/app');

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /healthz', () => {
    it('should return 200 and healthy status', async () => {
      const res = await request(app).get('/healthz');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok', service: 'auth-service' });
    });
  });

  describe('POST /auth/register', () => {
    it('should reject registration if email is invalid', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'invalid-email', password: 'password123', fullName: 'Test User' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject registration if password is under 8 characters', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'test@example.com', password: 'short', fullName: 'Test User' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('at least 8 characters');
    });

    it('should reject registration if user already exists', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] });

      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'existing@example.com', password: 'password123', fullName: 'Existing User' });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('already exists');
    });

    it('should successfully register a new user as student', async () => {
      // 1. check existing email -> returns empty
      query.mockResolvedValueOnce({ rows: [] });
      // 2. insert -> returns user record
      const fakeUser = {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'newstudent@example.com',
        full_name: 'New Student',
        role: 'student',
        created_at: new Date().toISOString(),
        last_seen_at: null,
      };
      query.mockResolvedValueOnce({ rows: [fakeUser] });

      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'newstudent@example.com', password: 'password123', fullName: 'New Student' });

      expect(res.status).toBe(201);
      expect(res.body.user).toEqual(fakeUser);
      expect(res.body.token).toBeDefined();

      const decoded = jwt.verify(res.body.token, JWT_SECRET);
      expect(decoded.sub).toBe(fakeUser.id);
      expect(decoded.role).toBe('student');
    });
  });

  describe('POST /auth/login', () => {
    it('should reject login for non-existent user', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'unknown@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('No account found with this email');
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should reject login for wrong password', async () => {
      const passwordHash = await bcrypt.hash('correctpassword', 10);
      query.mockResolvedValueOnce({
        rows: [{
          id: 'user-id',
          email: 'user@example.com',
          password_hash: passwordHash,
          full_name: 'User',
          role: 'researcher',
        }],
      });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('Incorrect password');
      expect(res.body.error.code).toBe('INVALID_PASSWORD');
    });

    it('should login successfully with correct credentials', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      const fakeUser = {
        id: 'user-id',
        email: 'user@example.com',
        password_hash: passwordHash,
        full_name: 'Dr. Alan Grant',
        role: 'researcher',
        created_at: new Date().toISOString(),
      };
      query.mockResolvedValueOnce({ rows: [fakeUser] });
      // Update last_seen_at query
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.password_hash).toBeUndefined();
      expect(res.body.user.role).toBe('researcher');
    });
  });

  describe('GET /auth/me', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request(app).get('/auth/me');
      expect(res.status).toBe(401);
    });

    it('should return 200 and user profile when token is valid', async () => {
      const token = jwt.sign(
        { sub: 'user-123', role: 'student', name: 'Sam Carter' },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      const fakeUser = {
        id: 'user-123',
        email: 'sam@example.com',
        full_name: 'Sam Carter',
        role: 'student',
        created_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      };
      query.mockResolvedValueOnce({ rows: [fakeUser] });
      query.mockResolvedValueOnce({ rows: [] }); // update last_seen_at

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual(fakeUser);
    });

    it('should support gateway forwarded X-User-Id header', async () => {
      const fakeUser = {
        id: 'user-123',
        email: 'sam@example.com',
        full_name: 'Sam Carter',
        role: 'student',
        created_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      };
      query.mockResolvedValueOnce({ rows: [fakeUser] });
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/auth/me')
        .set('X-User-Id', 'user-123')
        .set('X-User-Role', 'student');

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual(fakeUser);
    });
  });

  describe('PATCH /auth/users/:id/role', () => {
    it('should forbid student from changing roles', async () => {
      const studentToken = jwt.sign(
        { sub: 'student-id', role: 'student', name: 'Student' },
        JWT_SECRET
      );

      const res = await request(app)
        .patch('/auth/users/target-id/role')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ role: 'professor' });

      expect(res.status).toBe(403);
    });

    it('should allow professor to change role', async () => {
      const professorToken = jwt.sign(
        { sub: 'prof-id', role: 'professor', name: 'Professor' },
        JWT_SECRET
      );

      const updatedUser = {
        id: 'target-id',
        email: 'promoted@example.com',
        full_name: 'Promoted User',
        role: 'researcher',
        created_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      };
      query.mockResolvedValueOnce({ rows: [updatedUser] });

      const res = await request(app)
        .patch('/auth/users/target-id/role')
        .set('Authorization', `Bearer ${professorToken}`)
        .send({ role: 'researcher' });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('researcher');
    });
  });
});
