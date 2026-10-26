const http = require('http');
const https = require('https');
const logger = require('./logger');

const ACTIVITY_SERVICE_URL = process.env.ACTIVITY_SERVICE_URL || process.env.SERVICE_URL_ACTIVITY || 'http://localhost:5008';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || process.env.SERVICE_URL_NOTIFICATION || 'http://localhost:5009';

const getTransport = (parsedUrl) => (parsedUrl.protocol === 'https:' ? https : http);
const getPort = (parsedUrl, defaultHttpPort) => parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : defaultHttpPort);

/**
 * Emit an activity event to activity-service /internal/events
 * Fire-and-forget with 2s timeout. Failure is logged but never throws.
 */
function emitActivityEvent({ projectId, actorId, action, entityType, entityId, summary, metadata = {} }) {
  // Direct DB insertion fallback / dual-write
  try {
    const { pool } = require('./db');
    if (pool && typeof pool.query === 'function') {
      pool.query(
        `INSERT INTO activity_events (project_id, actor_id, action, entity_type, entity_id, summary, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          projectId || null,
          actorId || null,
          action,
          entityType || null,
          entityId || null,
          summary || null,
          JSON.stringify(metadata || {}),
        ]
      ).catch(() => {});
    }
  } catch (_) {}

  try {
    const payload = JSON.stringify({
      projectId,
      actorId,
      action,
      entityType,
      entityId,
      summary,
      metadata,
    });

    const parsedUrl = new URL(`${ACTIVITY_SERVICE_URL}/internal/events`);

    const req = getTransport(parsedUrl).request(
      {
        hostname: parsedUrl.hostname,
        port: getPort(parsedUrl, 5008),
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 2000,
      },
      (res) => {
        res.resume();
      }
    );

    req.on('error', (err) => {
      logger.warn({ err: err.message, action }, 'Failed to emit activity event (fire-and-forget)');
    });

    req.on('timeout', () => {
      req.destroy();
      logger.warn({ action }, 'Activity event request timed out (fire-and-forget)');
    });

    req.write(payload);
    req.end();
  } catch (err) {
    logger.warn({ err: err.message }, 'Error initiating activity event emit');
  }
}

/**
 * Emit a notification to notification-service /internal/notify
 * Fire-and-forget with 2s timeout. Failure is logged but never throws.
 */
function emitNotification({ userId, userIds, type, title, body, link }) {
  try {
    const payload = JSON.stringify({
      userId,
      userIds,
      type,
      title,
      body,
      link,
    });

    const parsedUrl = new URL(`${NOTIFICATION_SERVICE_URL}/internal/notify`);

    const req = getTransport(parsedUrl).request(
      {
        hostname: parsedUrl.hostname,
        port: getPort(parsedUrl, 5009),
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 2000,
      },
      (res) => {
        res.resume();
      }
    );

    req.on('error', (err) => {
      logger.warn({ err: err.message, type }, 'Failed to emit notification (fire-and-forget)');
    });

    req.on('timeout', () => {
      req.destroy();
      logger.warn({ type }, 'Notification request timed out (fire-and-forget)');
    });

    req.write(payload);
    req.end();
  } catch (err) {
    logger.warn({ err: err.message }, 'Error initiating notification emit');
  }
}

/**
 * Emit an audit log entry to activity-service /internal/audit
 * Fire-and-forget with 2s timeout. Failure is logged but never throws.
 */
function emitAuditLog({ actorId, action, entityType, entityId, ip, userAgent, before, after }) {
  try {
    const payload = JSON.stringify({
      actorId,
      action,
      entityType,
      entityId,
      ip,
      userAgent,
      before,
      after,
    });

    const parsedUrl = new URL(`${ACTIVITY_SERVICE_URL}/internal/audit`);

    const req = getTransport(parsedUrl).request(
      {
        hostname: parsedUrl.hostname,
        port: getPort(parsedUrl, 5008),
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 2000,
      },
      (res) => {
        res.resume();
      }
    );

    req.on('error', (err) => {
      logger.warn({ err: err.message, action }, 'Failed to emit audit log (fire-and-forget)');
    });

    req.on('timeout', () => {
      req.destroy();
      logger.warn({ action }, 'Audit log request timed out (fire-and-forget)');
    });

    req.write(payload);
    req.end();
  } catch (err) {
    logger.warn({ err: err.message }, 'Error initiating audit log emit');
  }
}

module.exports = {
  emitActivityEvent,
  emitNotification,
  emitAuditLog,
};
