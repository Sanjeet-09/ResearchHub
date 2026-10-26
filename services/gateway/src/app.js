const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler, logger, getStorageAdapter } = require('@rh/shared');

const requestIdMiddleware = require('./middleware/requestId');
const gatewayAuthMiddleware = require('./middleware/auth');
const auditHookMiddleware = require('./middleware/audit');
const { generalLimiter, authLimiter } = require('./middleware/rateLimiter');
const { createServiceProxy, createLabProxy } = require('./middleware/proxy');

const app = express();

// 1. Core security & tracing headers (frameguard disabled & CSP configured for embedded JupyterLab iframe)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: false,
  })
);
app.use(requestIdMiddleware);

// 2. CORS matching Frontend origin (supports localhost, 127.0.0.1, LAN IP)
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      process.env.NODE_ENV !== 'production' ||
      origin === frontendOrigin ||
      origin.endsWith('.web.app') ||
      origin.endsWith('.firebaseapp.com') ||
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

// 3. Body parsing (bypassed for multipart/form-data, uploads, and Jupyter proxy to allow raw streaming)
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  const url = (req.originalUrl || req.url || '').toLowerCase();
  const isUpload = contentType.toLowerCase().includes('multipart/form-data') ||
                   url.includes('/versions') ||
                   url.includes('/datasets') ||
                   url.includes('/files') ||
                   url.includes('/attachments') ||
                   url.includes('/upload') ||
                   url.includes('/documents') ||
                   url.includes('/proxy');

  if (isUpload) {
    return next();
  }
  express.json({ limit: '10mb' })(req, res, next);
});

// 4. Gateway Health Check (public, no auth)
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', service: 'gateway' });
});

// 5. Un-throttled raw proxy for JupyterLab streaming, WebSockets & kernel burst traffic
// Mounted before rate limiters and auth gatekeeper to prevent 429 kernel startup errors
const labJupyterProxy = createLabProxy();
app.jupyterProxy = labJupyterProxy;
app.use('/api/lab/sessions/:id/proxy', (req, res, next) => {
  // Clear baseUrl to prevent http-proxy-middleware from concatenating it with req.url
  req.baseUrl = '';
  req.url = req.originalUrl;
  labJupyterProxy(req, res, next);
});

// 6. Rate limiters
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api', generalLimiter);

// 7. JWT Authentication & Trust Header Injection
app.use('/api', gatewayAuthMiddleware);

// 8. Audit Logging for mutating actions
app.use('/api', auditHookMiddleware);

// 9. Local Storage Proxy endpoints for dev file uploads/downloads
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

// 10. Service Proxies
// Auth Service Proxy (/api/auth/* -> dynamic SERVICE_URL_AUTH / AUTH_SERVICE_URL)
const authProxy = createServiceProxy(() => process.env.AUTH_SERVICE_URL || process.env.SERVICE_URL_AUTH || 'http://localhost:5001', '/api');
app.use('/api/auth', authProxy);

// Experiment Service Proxy (/api/projects/:pid/experiments & /api/experiments -> experiment-service)
const experimentProxy = createServiceProxy(() => process.env.EXPERIMENT_SERVICE_URL || process.env.SERVICE_URL_EXPERIMENT || 'http://localhost:5003', '/api');
app.use('/api/experiments', experimentProxy);
app.use('/api/projects/:pid/experiments', experimentProxy);

// Dataset Service Proxy (/api/projects/:pid/datasets & /api/datasets -> dataset-service)
const datasetProxy = createServiceProxy(() => process.env.DATASET_SERVICE_URL || process.env.SERVICE_URL_DATASET || 'http://localhost:5004', '/api');
app.use('/api/datasets', datasetProxy);
app.use('/api/projects/:pid/datasets', datasetProxy);

// Document Service Proxy (/api/projects/:pid/documents & /api/documents -> document-service)
const documentProxy = createServiceProxy(() => process.env.DOCUMENT_SERVICE_URL || process.env.SERVICE_URL_DOCUMENT || 'http://localhost:5005', '/api');
app.use('/api/documents', (req, res, next) => {
  documentProxy(req, res, next);
});
app.use('/api/projects/:pid/documents', (req, res, next) => {
  documentProxy(req, res, next);
});

// Publication Service Proxy (/api/publications & /api/projects/:pid/publications -> publication-service)
const publicationProxy = createServiceProxy(() => process.env.PUBLICATION_SERVICE_URL || process.env.SERVICE_URL_PUBLICATION || 'http://localhost:5006', '/api');
app.use('/api/publications', publicationProxy);
app.use('/api/projects/:pid/publications', publicationProxy);

// Equipment Service Proxy (/api/equipment & /api/reservations -> equipment-service)
const equipmentProxy = createServiceProxy(() => process.env.EQUIPMENT_SERVICE_URL || process.env.SERVICE_URL_EQUIPMENT || 'http://localhost:5007', '/api');
app.use('/api/equipment', equipmentProxy);
app.use('/api/reservations', equipmentProxy);

// Activity Service Proxy (/api/projects/:pid/timeline, /api/projects/:pid/presence, /api/activity & /api/audit -> activity-service)
const activityProxy = createServiceProxy(() => process.env.ACTIVITY_SERVICE_URL || process.env.SERVICE_URL_ACTIVITY || 'http://localhost:5008', '/api');
app.use('/api/audit', activityProxy);
app.use('/api/activity', activityProxy);
app.use('/api/projects/:pid/timeline', activityProxy);
app.use('/api/projects/:pid/presence', activityProxy);

// Notification Service Proxy (/api/notifications -> notification-service)
const notificationProxy = createServiceProxy(() => process.env.NOTIFICATION_SERVICE_URL || process.env.SERVICE_URL_NOTIFICATION || 'http://localhost:5009', '/api');
app.use('/api/notifications', notificationProxy);

// Lab Service Proxy (/api/lab/* -> lab-service)
const labServiceProxy = createServiceProxy(() => process.env.LAB_SERVICE_URL || process.env.SERVICE_URL_LAB || 'http://localhost:5010', '/api');
app.use('/api/lab', labServiceProxy);

// Project Service Proxy (/api/projects/* -> dynamic SERVICE_URL_PROJECT / PROJECT_SERVICE_URL)
const projectProxy = createServiceProxy(() => process.env.PROJECT_SERVICE_URL || process.env.SERVICE_URL_PROJECT || 'http://localhost:5002', '/api');
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
