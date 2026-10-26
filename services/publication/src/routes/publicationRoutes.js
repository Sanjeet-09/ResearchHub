const express = require('express');
const {
  authenticateToken,
  requireProjectRole,
} = require('@rh/shared');

const {
  getPublications,
  createPublication,
  getPublicationById,
  updatePublication,
  deletePublication,
  addLink,
  removeLink,
  getTrace,
} = require('../controllers/publicationController');

const router = express.Router({ mergeParams: true });

router.use(authenticateToken);

// ── Publication CRUD ─────────────────────────────────────────────────────────
router.get('/projects/:pid/publications', requireProjectRole('viewer'), getPublications);
router.post('/projects/:pid/publications', requireProjectRole('member'), createPublication);

router.get('/projects/:pid/publications/:id', requireProjectRole('viewer'), getPublicationById);
router.patch('/projects/:pid/publications/:id', requireProjectRole('member'), updatePublication);
router.delete('/projects/:pid/publications/:id', requireProjectRole('lead'), deletePublication);

// Standalone publication endpoints (when proxied via /api/publications)
router.get('/publications', getPublications);
router.post('/publications', createPublication);
router.get('/publications/:id', getPublicationById);
router.patch('/publications/:id', updatePublication);
router.delete('/publications/:id', deletePublication);

// ── Links (Traceability) ────────────────────────────────────────────────────
router.post('/projects/:pid/publications/:id/links', requireProjectRole('member'), addLink);
router.delete('/projects/:pid/publications/:id/links', requireProjectRole('member'), removeLink);
router.post('/publications/:id/links', addLink);
router.delete('/publications/:id/links', removeLink);

// ── Trace View ──────────────────────────────────────────────────────────────
router.get('/projects/:pid/publications/:id/trace', requireProjectRole('viewer'), getTrace);
router.get('/publications/:id/trace', getTrace);

module.exports = router;
