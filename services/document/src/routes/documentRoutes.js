const express = require('express');
const {
  authenticateToken,
  requireProjectRole,
} = require('@rh/shared');

const {
  getDocuments,
  getUploadUrl,
  createDocument,
  getDocumentById,
  updateDocument,
  deleteDocument,
  getDownloadUrl,
  searchDocuments,
} = require('../controllers/documentController');

const router = express.Router({ mergeParams: true });

router.use(authenticateToken);

// ── Document CRUD ────────────────────────────────────────────────────────────
// All routes live under /projects/:pid/documents

router.get('/projects/:pid/documents/search', requireProjectRole('viewer'), searchDocuments);
router.get('/projects/:pid/documents', requireProjectRole('viewer'), getDocuments);
router.post('/projects/:pid/documents/upload-url', requireProjectRole('member'), getUploadUrl);
router.post('/projects/:pid/documents', requireProjectRole('member'), createDocument);

router.get('/projects/:pid/documents/:id', requireProjectRole('viewer'), getDocumentById);
router.patch('/projects/:pid/documents/:id', requireProjectRole('member'), updateDocument);
router.delete('/projects/:pid/documents/:id', requireProjectRole('member'), deleteDocument);

router.get('/projects/:pid/documents/:id/download', requireProjectRole('viewer'), getDownloadUrl);

module.exports = router;
