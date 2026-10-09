const request = require('supertest');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('@rh/shared');
const app = require('../src/app');

describe('API Gateway', () => {
  describe('GET /healthz', () => {
    it('should return 200 and gateway status without authentication', async () => {
      const res = await request(app).get('/healthz');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok', service: 'gateway' });
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  describe('Authentication Gatekeeper', () => {
    it('should block unauthenticated access to protected routes with 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should block requests with invalid JWT tokens with 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.value');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should allow access to public routes without Bearer token', async () => {
      // /api/auth/login is public; it proxies upstream to auth-service.
      // If auth-service is not running in test, it will return 502 Bad Gateway from the proxy,
      // NOT 401 Unauthorized from the gateway auth gatekeeper!
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).not.toBe(401);
    });

    it('should permit access with valid JWT token past the gateway gatekeeper', async () => {
      const validToken = jwt.sign(
        { sub: 'user-uuid-1', role: 'student', name: 'Student One' },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      // Past the auth gatekeeper, request reaches the proxy
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      // Gateway passed auth check, so it doesn't return 401
      expect(res.status).not.toBe(401);
    });
  });

  describe('Security and Headers', () => {
    it('should inject X-Request-Id header on all requests', async () => {
      const res = await request(app).get('/healthz');
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id'].length).toBeGreaterThan(10);
    });

    it('should preserve incoming X-Request-Id if provided', async () => {
      const customId = 'custom-request-id-12345';
      const res = await request(app)
        .get('/healthz')
        .set('X-Request-Id', customId);

      expect(res.headers['x-request-id']).toBe(customId);
    });
  });
});
