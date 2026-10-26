const express = require('express');
const multer = require('multer');
const {
  authenticateToken,
  requireProjectRole,
} = require('@rh/shared');

const {
  getExperiments,
  createExperiment,
  getExperimentById,
  updateExperiment,
  deleteExperiment,
  getUploadUrl,
  confirmFileUpload,
  uploadExperimentFile,
  getDownloadUrl,
  deleteFile,
  getExperimentLinks,
} = require('../controllers/experimentController');

const router = express.Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

const multipartMiddleware = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.toLowerCase().includes('multipart/form-data')) {
    return upload.any()(req, res, (err) => {
      if (err) return next(err);
      if (req.files && req.files.length > 0 && !req.file) {
        req.file = req.files[0];
      }
      next();
    });
  }
  next();
};

router.use(authenticateToken);

// Experiment CRUD under /projects/:pid/experiments
router.get('/projects/:pid/experiments', requireProjectRole('viewer'), getExperiments);
router.post('/projects/:pid/experiments', requireProjectRole('member'), createExperiment);

router.get('/projects/:pid/experiments/:id', requireProjectRole('viewer'), getExperimentById);
router.patch('/projects/:pid/experiments/:id', requireProjectRole('member'), updateExperiment);
router.delete('/projects/:pid/experiments/:id', requireProjectRole('member'), deleteExperiment);

// Files flow
router.post('/projects/:pid/experiments/:id/files/upload-url', requireProjectRole('member'), getUploadUrl);
router.post('/projects/:pid/experiments/:id/files/confirm', requireProjectRole('member'), confirmFileUpload);
router.post('/projects/:pid/experiments/:id/files', requireProjectRole('member'), multipartMiddleware, uploadExperimentFile);
router.get('/projects/:pid/experiments/:id/files/:fileId/download', requireProjectRole('viewer'), getDownloadUrl);
router.delete('/projects/:pid/experiments/:id/files/:fileId', requireProjectRole('member'), deleteFile);

// Standalone experiment endpoints (when proxied via /api/experiments)
router.post('/experiments/:id/files', multipartMiddleware, uploadExperimentFile);
router.post('/experiments/:id/attachments', multipartMiddleware, uploadExperimentFile);

// Traceability links
router.get('/projects/:pid/experiments/:id/links', requireProjectRole('viewer'), getExperimentLinks);
router.get('/experiments/:id/links', getExperimentLinks);

module.exports = router;
