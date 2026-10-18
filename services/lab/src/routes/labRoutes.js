'use strict';

const express = require('express');
const { authenticateToken } = require('@rh/shared');
const {
  getProfiles,
  createSession,
  getSessions,
  getSession,
  pauseSession,
  resumeSession,
  stopSession,
  exportSession,
  reconcile,
} = require('../controllers/labController');

const router = express.Router();

// ─ Public / Internal endpoints
router.get('/healthz', (req, res) => {
  res.json({ status: 'ok', service: 'lab', driver: process.env.LAB_DRIVER || 'local' });
});

// Internal reconciler endpoint (Cloud Scheduler OIDC or local cron trigger)
// In local mode, this is called unprotected or with a simple header check.
router.post('/internal/reconcile', reconcile);

// ─ Protected endpoints
router.get('/lab/profiles', authenticateToken, getProfiles);

router.post('/lab/sessions', authenticateToken, createSession);
router.get('/lab/sessions', authenticateToken, getSessions);
router.get('/lab/sessions/:id', authenticateToken, getSession);

router.post('/lab/sessions/:id/pause', authenticateToken, pauseSession);
router.post('/lab/sessions/:id/resume', authenticateToken, resumeSession);
router.post('/lab/sessions/:id/stop', authenticateToken, stopSession);
router.post('/lab/sessions/:id/export', authenticateToken, exportSession);

module.exports = router;
