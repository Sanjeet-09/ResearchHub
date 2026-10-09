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

module.exports = { createServiceProxy };
