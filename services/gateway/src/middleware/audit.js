const { logger, emitAuditLog } = require('@rh/shared');

const auditHookMiddleware = (req, res, next) => {
  const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  if (mutatingMethods.includes(req.method)) {
    const actorId = req.user ? req.user.id : null;
    const actorRole = req.user ? req.user.role : null;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const path = req.originalUrl || req.url;
    const method = req.method;

    // Log structured audit record to logger
    logger.info({
      audit: true,
      requestId: req.id,
      actorId: actorId || 'anonymous',
      actorRole,
      method,
      path,
      ip,
      userAgent,
      timestamp: new Date().toISOString(),
    }, `Audit trail: ${method} ${path}`);

    // Capture response completion to log and emit audit log row
    res.on('finish', () => {
      logger.info({
        auditCompletion: true,
        requestId: req.id,
        statusCode: res.statusCode,
      }, `Audit completed with status ${res.statusCode}`);

      // Persist to audit_logs table via activity-service when mutation succeeds
      if (res.statusCode >= 200 && res.statusCode < 400 && actorId) {
        const segments = path.replace(/^\/api\//, '').split('/');
        const entityType = segments[0] || 'unknown';

        emitAuditLog({
          actorId,
          action: `${method} ${path}`,
          entityType,
          entityId: null,
          ip: typeof ip === 'string' ? ip.split(',')[0].trim() : null,
          userAgent: userAgent || null,
          before: null,
          after: req.body && typeof req.body === 'object' ? req.body : null,
        });
      }
    });
  }

  next();
};

module.exports = auditHookMiddleware;
