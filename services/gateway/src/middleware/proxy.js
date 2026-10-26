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

const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');

const labTargetCache = new Map();

/**
 * Resolve target JupyterLab VM URL for a given sessionId.
 */
async function resolveLabTarget(sessionId) {
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
      const { rows } = await pool.query('SELECT url, state FROM lab_sessions WHERE id = $1', [sessionId]);
      if (rows.length > 0 && rows[0].url) {
        let rawUrl = rows[0].url;
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
 * Configured with HTML response interceptor to rewrite absolute asset paths if needed.
 */
function createLabProxy() {
  return createProxyMiddleware({
    router: async (req) => {
      const sessionId = req.params?.id || (req.url || req.originalUrl || '').match(/\/api\/lab\/sessions\/([^/]+)\/proxy/)?.[1];
      const target = await resolveLabTarget(sessionId);
      return target || 'http://127.0.0.1:8888';
    },
    changeOrigin: true,
    ws: true,
    selfHandleResponse: true,
    pathRewrite: (path, req) => {
      // Forward the full proxy path so JupyterLab instances started with --ServerApp.base_url resolve correctly
      const original = req.originalUrl || req.url || path;
      return original.startsWith('/') ? original : '/' + original;
    },
    on: {
      proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
        delete proxyRes.headers['x-frame-options'];
        if (typeof res.removeHeader === 'function') {
          res.removeHeader('x-frame-options');
        }
        const csp = "frame-ancestors 'self' https://*.web.app https://*.run.app https://*.firebaseapp.com http://localhost:3000 http://localhost:5000 http://127.0.0.1:3000";
        proxyRes.headers['content-security-policy'] = csp;
        if (typeof res.setHeader === 'function') {
          res.setHeader('content-security-policy', csp);
          res.setHeader('cross-origin-resource-policy', 'cross-origin');
        }

        const contentType = proxyRes.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
          const sessionId = req.params?.id || (req.url || req.originalUrl || '').match(/\/api\/lab\/sessions\/([^/]+)\/proxy/)?.[1];
          if (sessionId) {
            const prefix = `/api/lab/sessions/${sessionId}/proxy`;
            let html = responseBuffer.toString('utf8');
            // Ensure absolute asset URLs /static/, /themes/, /api/ resolve through the proxy subpath
            html = html
              .replace(/(href|src)=["']\/static\//g, `$1="${prefix}/static/`)
              .replace(/(href|src)=["']\/themes\//g, `$1="${prefix}/themes/`)
              .replace(/(href|src)=["']\/api\//g, `$1="${prefix}/api/`)
              .replace(/"baseUrl":\s*"\/"/g, `"baseUrl": "${prefix}/"`)
              .replace(/"appUrl":\s*"\/lab"/g, `"appUrl": "${prefix}/lab"`);
            return html;
          }
        }
        return responseBuffer;
      }),
      error: (err, req, res) => {
        logger.warn({ err: err.message, url: req.url }, 'JupyterLab proxy connection error');
        if (res && typeof res.writeHead === 'function' && !res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: {
                code: 'BAD_GATEWAY',
                message: 'JupyterLab session container is unreachable or still starting up',
              },
            })
          );
        } else if (res && typeof res.destroy === 'function') {
          res.destroy();
        }
      },
    },
  });

  const wrapper = (req, res, next) => {
    const url = req.originalUrl || req.url || '';
    const match = url.match(/^(\/api\/lab\/sessions\/[^/]+\/proxy\/lab)(\?.*)?$/);
    if (match) {
      const targetUrl = match[1] + '/' + (match[2] || '');
      return res.redirect(302, targetUrl);
    }
    return proxy(req, res, next);
  };
  wrapper.upgrade = (req, socket, head) => {
    if (typeof proxy.upgrade === 'function') {
      proxy.upgrade(req, socket, head);
    }
  };
  return wrapper;
}

module.exports = { createServiceProxy, createLabProxy };
