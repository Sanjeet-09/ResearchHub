const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler, logger } = require('@rh/shared');

const requestIdMiddleware = require('./middleware/requestId');
const gatewayAuthMiddleware = require('./middleware/auth');
const auditHookMiddleware = require('./middleware/audit');
const { generalLimiter, authLimiter } = require('./middleware/rateLimiter');
const { createServiceProxy } = require('./middleware/proxy');

const app = express();

// 1. Core security & tracing headers
app.use(helmet());
app.use(requestIdMiddleware);

// 2. CORS matching Frontend origin (supports localhost, 127.0.0.1, LAN IP)
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      process.env.NODE_ENV !== 'production' ||
      origin === frontendOrigin ||
      origin.includes(':3000') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')
    ) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
}));

// 3. Body parsing (for JSON requests)
app.use(express.json());

// 4. Gateway Health Check (public, no auth)
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', service: 'gateway' });
});

// 5. Rate limiters
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api', generalLimiter);

// 6. JWT Authentication & Trust Header Injection
app.use('/api', gatewayAuthMiddleware);

// 7. Audit Logging for mutating actions
app.use('/api', auditHookMiddleware);

// 8. Service Proxies
// Auth Service Proxy (/api/auth/* -> dynamic SERVICE_URL_AUTH/auth/*)
const authProxy = createServiceProxy(() => process.env.SERVICE_URL_AUTH || 'http://localhost:5001', '/api');
app.use('/api/auth', authProxy);

// Project Service Proxy (/api/projects/* -> dynamic SERVICE_URL_PROJECT/projects/*)
const projectProxy = createServiceProxy(() => process.env.SERVICE_URL_PROJECT || 'http://localhost:5002', '/api');
app.use('/api/projects', projectProxy);

// 9. Unmatched API route handler
app.use('/api', (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.originalUrl} not found on API gateway`,
    },
  });
});

// 10. Global Error Handler
app.use(errorHandler);

module.exports = app;
