const express = require('express');
const multer = require('multer');
const {
  authenticateToken,
  requireProjectRole,
} = require('@rh/shared');

const {
  getDocuments,
  getUploadUrl,
  createDocument,
  uploadDocument,
  createOrUploadDocument,
  getDocumentById,
  updateDocument,
  deleteDocument,
  getDownloadUrl,
  getDocumentContent,
  searchDocuments,
} = require('../controllers/documentController');

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

// ── Document CRUD ────────────────────────────────────────────────────────────
// All routes live under /projects/:pid/documents

router.get('/projects/:pid/documents/search', requireProjectRole('viewer'), searchDocuments);
router.get('/projects/:pid/documents', requireProjectRole('viewer'), getDocuments);
router.post('/projects/:pid/documents/upload-url', requireProjectRole('member'), getUploadUrl);
router.post('/projects/:pid/documents/upload', requireProjectRole('member'), multipartMiddleware, uploadDocument);
router.post('/projects/:pid/documents', requireProjectRole('member'), multipartMiddleware, createOrUploadDocument);

router.get('/projects/:pid/documents/:id', requireProjectRole('viewer'), getDocumentById);
router.patch('/projects/:pid/documents/:id', requireProjectRole('member'), updateDocument);
router.delete('/projects/:pid/documents/:id', requireProjectRole('member'), deleteDocument);

router.get('/projects/:pid/documents/:id/download', requireProjectRole('viewer'), getDownloadUrl);
router.get('/projects/:pid/documents/:id/content', requireProjectRole('viewer'), getDocumentContent);

// Standalone document endpoints (when proxied via /api/documents)
router.post('/documents/upload', multipartMiddleware, uploadDocument);
router.post('/documents', multipartMiddleware, createOrUploadDocument);
router.get('/documents', getDocuments);
router.get('/documents/:id/download', getDownloadUrl);
router.get('/documents/:id/content', getDocumentContent);
router.get('/documents/:id', getDocumentById);
router.patch('/documents/:id', updateDocument);
router.delete('/documents/:id', deleteDocument);

router.get('/:id/content', getDocumentContent);
router.get('/:id/download', getDownloadUrl);
router.get('/:id', getDocumentById);

module.exports = router;
