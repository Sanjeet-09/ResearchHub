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
      const res = await request(app).get('/healthz');
      expect(res.status).toBe(200);
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

  describe('Multipart Passthrough', () => {
    it('should bypass express.json for multipart/form-data requests so raw stream passes to proxy', async () => {
      const validToken = jwt.sign(
        { sub: 'user-uuid-1', role: 'student', name: 'Student One' },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('file', Buffer.from('test file content'), 'test.txt');

      // Gateway allows multipart stream to reach proxy without premature consumption or 400/401 gatekeeper error
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(400);
    });
  });

  describe('JupyterLab Relative Proxy', () => {
    let mockJupyterServer;
    let receivedUrl = null;

    beforeAll((done) => {
      const http = require('http');
      mockJupyterServer = http.createServer((req, res) => {
        receivedUrl = req.url;
        res.writeHead(200, {
          'Content-Type': 'text/html',
          'X-Frame-Options': 'DENY',
        });
        res.end('<html><head><script src="/api/lab/sessions/session-uuid-123/proxy/static/lab/main.js"></script></head><body>JupyterLab Ready</body></html>');
      });
      mockJupyterServer.listen(9871, () => {
        process.env.LAB_TARGET_OVERRIDE = 'http://127.0.0.1:9871';
        done();
      });
    });

    afterAll((done) => {
      delete process.env.LAB_TARGET_OVERRIDE;
      if (mockJupyterServer) {
        mockJupyterServer.close(done);
      } else {
        done();
      }
    });

    it('routes /api/lab/sessions/:id/proxy/lab without Bearer auth and preserves subpath matching base_url', async () => {
      const res = await request(app)
        .get('/api/lab/sessions/session-uuid-123/proxy/lab?token=jupyter-token-abc');

      expect(res.status).toBe(200);
      expect(receivedUrl).toBe('/api/lab/sessions/session-uuid-123/proxy/lab?token=jupyter-token-abc');
      expect(res.headers['x-frame-options']).toBeUndefined();
      expect(res.headers['content-security-policy']).toContain('frame-ancestors');
      expect(res.text).toContain('/api/lab/sessions/session-uuid-123/proxy/static/lab/main.js');
    });

    it('routes /api/lab/sessions/:id/proxy/api/kernels to upstream subpath', async () => {
      const res = await request(app)
        .get('/api/lab/sessions/session-uuid-123/proxy/api/kernels');

      expect(res.status).toBe(200);
      expect(receivedUrl).toBe('/api/lab/sessions/session-uuid-123/proxy/api/kernels');
    });

    it('does not concatenate baseUrl twice on static asset requests', async () => {
      const res = await request(app)
        .get('/api/lab/sessions/session-uuid-123/proxy/static/lab/main.js');

      expect(res.status).toBe(200);
      // Crucial: Ensure NO double prefix (/api/lab/sessions/<id>/proxy/api/lab/sessions/<id>/proxy/...)
      expect(receivedUrl).toBe('/api/lab/sessions/session-uuid-123/proxy/static/lab/main.js');
      expect(receivedUrl).not.toContain('/api/lab/sessions/session-uuid-123/proxy/api/lab/sessions/session-uuid-123/proxy');
    });

    it('bypasses rate limiters and auth gatekeepers on proxy routes', async () => {
      const promises = Array.from({ length: 10 }).map(() =>
        request(app).get('/api/lab/sessions/session-uuid-123/proxy/api/kernels')
      );
      const responses = await Promise.all(promises);
      for (const res of responses) {
        expect(res.status).toBe(200);
        expect(res.status).not.toBe(429);
        expect(res.status).not.toBe(401);
      }
    });
  });
});
