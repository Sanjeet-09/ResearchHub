const express = require('express');
const { authenticateToken } = require('@rh/shared');
const {
  recordEvent,
  recordAudit,
  getProjectTimeline,
  getAuditLogs,
  recordPresenceHeartbeat,
  getProjectPresence,
} = require('../controllers/activityController');

const router = express.Router();

// Internal service endpoints (fire-and-forget from services & gateway)
router.post('/internal/events', recordEvent);
router.post('/internal/audit', recordAudit);

// Protected endpoints
router.get('/projects/:pid/timeline', authenticateToken, getProjectTimeline);
router.get('/audit', authenticateToken, getAuditLogs);

// Presence endpoints
router.post('/activity/presence/heartbeat', authenticateToken, recordPresenceHeartbeat);
router.post('/presence/heartbeat', authenticateToken, recordPresenceHeartbeat);
router.get('/projects/:pid/presence', authenticateToken, getProjectPresence);

module.exports = router;
