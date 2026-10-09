const { logger } = require('@rh/shared');

const auditHookMiddleware = (req, res, next) => {
  const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  if (mutatingMethods.includes(req.method)) {
    const actorId = req.user ? req.user.id : 'anonymous';
    const auditRecord = {
      audit: true,
      requestId: req.id,
      actorId,
      actorRole: req.user ? req.user.role : null,
      method: req.method,
      path: req.originalUrl || req.url,
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
    };

    // Log structured audit record
    logger.info(auditRecord, `Audit trail: ${req.method} ${req.originalUrl}`);

    // Capture response completion to log final status code
    res.on('finish', () => {
      logger.info({
        auditCompletion: true,
        requestId: req.id,
        statusCode: res.statusCode,
      }, `Audit completed with status ${res.statusCode}`);
    });
  }

  next();
};

module.exports = auditHookMiddleware;
