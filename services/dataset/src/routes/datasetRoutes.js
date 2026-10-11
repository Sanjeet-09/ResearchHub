const express = require('express');
const {
  authenticateToken,
  requireProjectRole,
} = require('@rh/shared');

const {
  getDatasets,
  createDataset,
  getDatasetById,
  updateDataset,
  deleteDataset,
  getVersionUploadUrl,
  confirmVersion,
  getVersionHistory,
  getVersionDownloadUrl,
  restoreVersion,
} = require('../controllers/datasetController');

const router = express.Router({ mergeParams: true });

router.use(authenticateToken);

// ── Dataset CRUD ─────────────────────────────────────────────────────────────
// All routes live under /projects/:pid/datasets so requireProjectRole
// uses req.params.pid for membership lookup (falls through to req.params.pid).

router.get('/projects/:pid/datasets', requireProjectRole('viewer'), getDatasets);
router.post('/projects/:pid/datasets', requireProjectRole('member'), createDataset);

router.get('/projects/:pid/datasets/:id', requireProjectRole('viewer'), getDatasetById);
router.patch('/projects/:pid/datasets/:id', requireProjectRole('member'), updateDataset);
router.delete('/projects/:pid/datasets/:id', requireProjectRole('lead'), deleteDataset);

// ── Version Control ───────────────────────────────────────────────────────────
// Keep :pid in the path so requireProjectRole always has a valid project UUID.

router.post('/projects/:pid/datasets/:id/versions/upload-url', requireProjectRole('member'), getVersionUploadUrl);
router.post('/projects/:pid/datasets/:id/versions', requireProjectRole('member'), confirmVersion);
router.get('/projects/:pid/datasets/:id/versions', requireProjectRole('viewer'), getVersionHistory);
router.get('/projects/:pid/datasets/:id/versions/:versionId/download', requireProjectRole('viewer'), getVersionDownloadUrl);
router.post('/projects/:pid/datasets/:id/versions/:versionId/restore', requireProjectRole('member'), restoreVersion);

module.exports = router;
