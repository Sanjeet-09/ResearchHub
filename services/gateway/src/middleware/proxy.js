const http = require('http');
const https = require('https');
const { logger } = require('@rh/shared');

/**
 * Creates an HTTP/HTTPS reverse proxy to downstream microservices.
 * Injects trust headers (X-User-Id, X-User-Role, X-Request-Id) automatically.
 * Supports string target or dynamic getter function for dynamic ports in tests.
 */
const createServiceProxy = (targetUrlResolver, pathRewritePrefix = '') => {
  return (req, res, next) => {
    // Never intercept JupyterLab proxy routes destined for VM
    const pathToCheck = req.originalUrl || req.url || '';
    if (pathToCheck.includes('/proxy')) {
      return next();
    }

    const rawTarget = typeof targetUrlResolver === 'function'
      ? targetUrlResolver()
      : targetUrlResolver;

    const url = new URL(rawTarget);
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;

    // Determine target path
    let targetPath = req.originalUrl || req.url;
    if (pathRewritePrefix && targetPath.startsWith(pathRewritePrefix)) {
      targetPath = targetPath.slice(pathRewritePrefix.length);
    }
    if (!targetPath.startsWith('/')) {
      targetPath = '/' + targetPath;
    }

    const headers = { ...req.headers };
    delete headers.host;
    headers.host = url.host;

    if (req.user) {
      headers['x-user-id'] = req.user.id;
      headers['x-user-role'] = req.user.role;
      headers['x-user-name'] = encodeURIComponent(req.user.name || '');
    }

    if (req.id) {
      headers['x-request-id'] = req.id;
    }

    const options = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      method: req.method,
      path: targetPath,
      headers,
    };

    const proxyReq = transport.request(options, (proxyRes) => {
      res.status(proxyRes.statusCode);
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        res.setHeader(key, value);
      }
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      logger.error({ err: err.message, targetUrl: rawTarget, path: targetPath }, 'Gateway upstream proxy error');
      if (!res.headersSent) {
        res.status(502).json({
          error: {
            code: 'BAD_GATEWAY',
            message: 'Upstream microservice is unreachable',
          },
        });
      }
    });

    // Handle body forwarding
    if (req.body && Object.keys(req.body).length > 0) {
      const bodyData = Buffer.isBuffer(req.body)
        ? req.body
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body);

      proxyReq.setHeader('content-type', 'application/json');
      proxyReq.setHeader('content-length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
      proxyReq.end();
    } else if (['GET', 'HEAD', 'DELETE', 'OPTIONS'].includes(req.method)) {
      proxyReq.end();
    } else {
      req.pipe(proxyReq);
    }
  };
};

const { createProxyMiddleware } = require('http-proxy-middleware');

const labTargetCache = new Map();

/**
 * Resolve target JupyterLab VM URL for a given sessionId or request.
 */
async function resolveLabTarget(sessionIdOrReq) {
  let sessionId = sessionIdOrReq;
  if (sessionIdOrReq && typeof sessionIdOrReq === 'object') {
    sessionId = sessionIdOrReq.params?.id ||
      (sessionIdOrReq.url || sessionIdOrReq.originalUrl || '').match(/\/api\/lab\/sessions\/([^/]+)\/proxy/)?.[1] ||
      (sessionIdOrReq.baseUrl || '').match(/\/api\/lab\/sessions\/([^/]+)\/proxy/)?.[1];
  }

  if (!sessionId) return null;

  if (process.env.LAB_TARGET_OVERRIDE) {
    return process.env.LAB_TARGET_OVERRIDE;
  }

  const cached = labTargetCache.get(sessionId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.target;
  }

  try {
    const { pool } = require('@rh/shared');
    if (pool) {
      const { rows } = await pool.query('SELECT url, public_ip, state FROM lab_sessions WHERE id = $1', [sessionId]);
      if (rows.length > 0) {
        let rawUrl = rows[0].url;
        if (rows[0].public_ip) {
          rawUrl = `http://${rows[0].public_ip}:8888`;
        }
        if (rawUrl) {
          try {
            const parsed = new URL(rawUrl);
            const targetUrl = `${parsed.protocol}//${parsed.hostname}:${parsed.port || 8888}`;
            labTargetCache.set(sessionId, { target: targetUrl, expiresAt: Date.now() + 30000 });
            return targetUrl;
          } catch (_) {
            labTargetCache.set(sessionId, { target: rawUrl, expiresAt: Date.now() + 30000 });
            return rawUrl;
          }
        }
      }
    }
  } catch (err) {
    logger.warn({ err: err.message, sessionId }, 'Gateway could not resolve lab session target from database');
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:8888';
  }

  return null;
}

/**
 * Reverse proxy for JupyterLab VM instances.
 * Routes /api/lab/sessions/:id/proxy/* to target VM port 8888.
 * Preserves subpath matching JupyterLab's --ServerApp.base_url.
 * Supports WebSockets (ws: true) for interactive Jupyter kernels.
 */
function createLabProxy() {
  return createProxyMiddleware({
    target: 'http://127.0.0.1:8888',
    router: async (req) => {
      return await resolveLabTarget(req);
    },
    changeOrigin: true,
    ws: true,
    proxyTimeout: 30000,
    timeout: 30000,
    // Do NOT specify pathRewrite here; req.url is already the exact full path
    on: {
      proxyRes: (proxyRes, req, res) => {
        delete proxyRes.headers['x-frame-options'];
        const csp =
          "frame-ancestors 'self' https://*.web.app https://*.run.app https://*.firebaseapp.com http://localhost:3000 http://localhost:5000 http://127.0.0.1:3000";
        proxyRes.headers['content-security-policy'] = csp;
        if (res && typeof res.setHeader === 'function') {
          res.setHeader('content-security-policy', csp);
          res.setHeader('cross-origin-resource-policy', 'cross-origin');
        }
        if (res && typeof res.removeHeader === 'function') {
          res.removeHeader('x-frame-options');
        }
      },
      error: (err, req, res) => {
        console.error(`[LabProxy Error] Target failed: ${err.code} - ${err.message}`);
        if (res && !res.headersSent && typeof res.status === 'function') {
          res.status(502).json({
            error: {
              code: "BAD_GATEWAY",
              message: "Cannot reach JupyterLab container. Container may still be initializing."
            }
          });
        } else if (res && typeof res.writeHead === 'function' && !res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: {
                code: "BAD_GATEWAY",
                message: "Cannot reach JupyterLab container. Container may still be initializing."
              }
            })
          );
        } else if (res && typeof res.destroy === 'function') {
          res.destroy();
        }
      }
    }
  });
}

module.exports = { createServiceProxy, createLabProxy };
