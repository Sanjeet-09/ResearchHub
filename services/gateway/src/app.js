const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler, logger, getStorageAdapter } = require('@rh/shared');

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

// 8. Local Storage Proxy endpoints for dev file uploads/downloads
const fs = require('fs');
app.post('/api/storage/upload', express.raw({ type: '*/*', limit: '50mb' }), async (req, res, next) => {
  try {
    const { bucket, key } = req.query;
    if (!bucket || !key) return res.status(400).json({ error: { message: 'bucket and key required' } });
    const storage = getStorageAdapter();
    const gcsPath = await storage.uploadFile(bucket, key, req.body, req.headers['content-type']);
    res.json({ status: 'uploaded', gcsPath });
  } catch (err) {
    next(err);
  }
});

app.get('/api/storage/download', async (req, res, next) => {
  try {
    const { bucket, key, download } = req.query;
    if (!bucket || !key) return res.status(400).json({ error: { message: 'bucket and key required' } });
    const storage = getStorageAdapter();
    const filePath = storage._getFilePath(bucket, key);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: { message: 'File not found on local storage' } });
    }
    const pathMod = require('path');
    const cleanFilename = pathMod.basename(key).replace(/^\d+_/, '');

    if (download === 'true' || download === '1') {
      return res.download(filePath, cleanFilename);
    }

    res.setHeader('Content-Disposition', `inline; filename="${cleanFilename}"`);
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

// 9. Service Proxies
// Auth Service Proxy (/api/auth/* -> dynamic SERVICE_URL_AUTH/auth/*)
const authProxy = createServiceProxy(() => process.env.SERVICE_URL_AUTH || 'http://localhost:5001', '/api');
app.use('/api/auth', authProxy);

// Experiment Service Proxy (/api/projects/:pid/experiments & /api/experiments -> experiment-service)
const experimentProxy = createServiceProxy(() => process.env.SERVICE_URL_EXPERIMENT || 'http://localhost:5003', '/api');
app.use('/api/experiments', experimentProxy);
app.use('/api/projects/:pid/experiments', experimentProxy);

// Dataset Service Proxy (/api/projects/:pid/datasets -> dataset-service)
const datasetProxy = createServiceProxy(() => process.env.SERVICE_URL_DATASET || 'http://localhost:5004', '/api');
app.use('/api/projects/:pid/datasets', datasetProxy);

// Document Service Proxy (/api/projects/:pid/documents -> document-service)
const documentProxy = createServiceProxy(() => process.env.SERVICE_URL_DOCUMENT || 'http://localhost:5005', '/api');
app.use('/api/projects/:pid/documents', documentProxy);

// Publication Service Proxy (/api/publications & /api/projects/:pid/publications -> publication-service)
const publicationProxy = createServiceProxy(() => process.env.SERVICE_URL_PUBLICATION || 'http://localhost:5006', '/api');
app.use('/api/publications', publicationProxy);
app.use('/api/projects/:pid/publications', publicationProxy);

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
