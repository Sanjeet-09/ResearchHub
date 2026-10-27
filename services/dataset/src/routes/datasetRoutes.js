const express = require('express');
const multer = require('multer');
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
  createVersion,
  confirmVersion,
  getVersionHistory,
  getVersionDownloadUrl,
  restoreVersion,
} = require('../controllers/datasetController');

const router = express.Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

const uploadMiddleware = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.toLowerCase().includes('multipart/form-data')) {
    return upload.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          error: {
            code: 'UPLOAD_ERROR',
            message: err.message || 'File upload error',
          },
        });
      }
      // Fallback: if field name differed, pick first from req.files
      if (!req.file && req.files && req.files.length > 0) {
        req.file = req.files[0];
      }
      next();
    });
  }
  next();
};

router.use(authenticateToken);

// ── Dataset CRUD ─────────────────────────────────────────────────────────────
// All routes live under /projects/:pid/datasets so requireProjectRole
// uses req.params.pid for membership lookup (falls through to req.params.pid).

router.get('/projects/:pid/datasets', requireProjectRole('viewer'), getDatasets);
router.post('/projects/:pid/datasets', requireProjectRole('member'), uploadMiddleware, createDataset);

router.get('/projects/:pid/datasets/:id', requireProjectRole('viewer'), getDatasetById);
router.patch('/projects/:pid/datasets/:id', requireProjectRole('member'), updateDataset);
router.delete('/projects/:pid/datasets/:id', requireProjectRole('lead'), deleteDataset);

// ── Version Control ───────────────────────────────────────────────────────────
// Keep :pid in the path so requireProjectRole always has a valid project UUID.

router.post('/projects/:pid/datasets/:id/versions/upload-url', requireProjectRole('member'), getVersionUploadUrl);
router.post('/projects/:pid/datasets/:id/versions', requireProjectRole('member'), uploadMiddleware, createVersion);
router.post('/projects/:pid/datasets/:id/upload', requireProjectRole('member'), uploadMiddleware, createVersion);
router.get('/projects/:pid/datasets/:id/versions', requireProjectRole('viewer'), getVersionHistory);
router.get('/projects/:pid/datasets/:id/versions/:versionId/download', requireProjectRole('viewer'), getVersionDownloadUrl);
router.post('/projects/:pid/datasets/:id/versions/:versionId/restore', requireProjectRole('member'), restoreVersion);

// Standalone routes (when proxied via /api/datasets or /api/projects/:pid/datasets)
router.post('/datasets/:id/versions', uploadMiddleware, createVersion);
router.post('/datasets/:id/upload', uploadMiddleware, createVersion);
router.get('/datasets/:id/versions', getVersionHistory);
router.get('/datasets/:id', getDatasetById);
router.get('/datasets', getDatasets);

router.post('/:id/versions', uploadMiddleware, createVersion);
router.post('/:id/upload', uploadMiddleware, createVersion);
router.post('/upload', uploadMiddleware, createVersion);
router.get('/:id/versions', getVersionHistory);

module.exports = router;
