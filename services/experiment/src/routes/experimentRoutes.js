const express = require('express');
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
  getDownloadUrl,
  deleteFile,
  getExperimentLinks,
} = require('../controllers/experimentController');

const router = express.Router({ mergeParams: true });

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
router.get('/projects/:pid/experiments/:id/files/:fileId/download', requireProjectRole('viewer'), getDownloadUrl);
router.delete('/projects/:pid/experiments/:id/files/:fileId', requireProjectRole('member'), deleteFile);

// Traceability links
router.get('/projects/:pid/experiments/:id/links', requireProjectRole('viewer'), getExperimentLinks);
router.get('/experiments/:id/links', getExperimentLinks);

module.exports = router;
