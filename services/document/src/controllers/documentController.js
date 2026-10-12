const { z } = require('zod');
const {
  query,
  ValidationError,
  NotFoundError,
  logger,
  getStorageAdapter,
} = require('@rh/shared');

const uuidSchema = z.string().uuid();

const uploadUrlSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  mimeType: z.string().optional().default('application/octet-stream'),
  docType: z.enum(['paper', 'pdf', 'image', 'report', 'note', 'other']).optional().default('other'),
  title: z.string().min(1, 'Title is required').max(500).optional(),
});

const confirmUploadSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  docType: z.enum(['paper', 'pdf', 'image', 'report', 'note', 'other']).optional().default('other'),
  gcsPath: z.string().min(1, 'GCS path is required'),
  mimeType: z.string().optional().default('application/octet-stream'),
  sizeBytes: z.number().optional().default(0),
  fileName: z.string().min(1, 'File name is required'),
});

const updateDocumentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  docType: z.enum(['paper', 'pdf', 'image', 'report', 'note', 'other']).optional(),
});

// Helper sanitization for file key
function pathSanitize(str) {
  return String(str).replace(/[^a-zA-Z0-9_.-]/g, '_');
}

// ─── Document CRUD ───────────────────────────────────────────────────────────

// GET /projects/:pid/documents
const getDocuments = async (req, res, next) => {
  try {
    const { pid } = req.params;
    if (!uuidSchema.safeParse(pid).success) {
      throw new ValidationError('Invalid project ID format (UUID expected)');
    }

    const { docType, search, page = 1, limit = 50 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const params = [pid];
    let whereClause = 'WHERE d.project_id = $1';
    let paramIdx = 2;

    if (docType) {
      whereClause += ` AND d.doc_type = $${paramIdx}`;
      params.push(docType);
      paramIdx++;
    }

    if (search) {
      whereClause += ` AND d.title ILIKE $${paramIdx}`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    params.push(parseInt(limit), offset);

    const result = await query(
      `SELECT
         d.id,
         d.title,
         d.doc_type,
         d.gcs_path,
         d.mime_type,
         d.size_bytes,
         d.project_id,
         d.created_at,
         u.id AS uploaded_by_id,
         u.full_name AS uploaded_by_name,
         u.email AS uploaded_by_email
       FROM documents d
       LEFT JOIN users u ON d.uploaded_by = u.id
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    // Get total count for pagination
    const countResult = await query(
      `SELECT COUNT(*) AS total FROM documents d ${whereClause}`,
      params.slice(0, paramIdx - 1)
    );

    res.json({
      documents: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    next(err);
  }
};

// POST /projects/:pid/documents/upload-url
const getUploadUrl = async (req, res, next) => {
  try {
    const { pid } = req.params;
    if (!uuidSchema.safeParse(pid).success) {
      throw new ValidationError('Invalid project ID format (UUID expected)');
    }

    const parsed = uploadUrlSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { fileName, mimeType } = parsed.data;
    const sanitizedFileName = pathSanitize(fileName);
    const timestamp = Date.now();
    const key = `documents/${pid}/${timestamp}_${sanitizedFileName}`;

    const storage = getStorageAdapter();
    const signedData = await storage.getSignedUploadUrl('researchhub-storage', key, mimeType);

    res.json({
      uploadUrl: signedData.uploadUrl,
      gcsPath: signedData.gcsPath,
      key,
    });
  } catch (err) {
    next(err);
  }
};

// POST /projects/:pid/documents
const createDocument = async (req, res, next) => {
  try {
    const { pid } = req.params;
    if (!uuidSchema.safeParse(pid).success) {
      throw new ValidationError('Invalid project ID format (UUID expected)');
    }

    const parsed = confirmUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { title, docType, gcsPath, mimeType, sizeBytes, fileName } = parsed.data;

    const dbRes = await query(
      `INSERT INTO documents (project_id, title, doc_type, gcs_path, mime_type, size_bytes, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [pid, title, docType, gcsPath, mimeType, sizeBytes, req.user.id]
    );

    const document = dbRes.rows[0];
    logger.info({ documentId: document.id, projectId: pid }, 'Document created');

    res.status(201).json({ document });
  } catch (err) {
    next(err);
  }
};

// GET /projects/:pid/documents/:id
const getDocumentById = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (!uuidSchema.safeParse(pid).success || !uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    const result = await query(
      `SELECT
         d.*,
         u.full_name AS uploaded_by_name,
         u.email AS uploaded_by_email
       FROM documents d
       LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE d.id = $1 AND d.project_id = $2`,
      [id, pid]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Document not found in this project');
    }

    res.json({ document: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// PATCH /projects/:pid/documents/:id
const updateDocument = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (!uuidSchema.safeParse(pid).success || !uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    const parsed = updateDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const existing = await query(
      'SELECT * FROM documents WHERE id = $1 AND project_id = $2',
      [id, pid]
    );
    if (existing.rows.length === 0) {
      throw new NotFoundError('Document not found in this project');
    }

    const current = existing.rows[0];
    const {
      title = current.title,
      docType = current.doc_type,
    } = parsed.data;

    const dbRes = await query(
      `UPDATE documents
       SET title = $1, doc_type = $2
       WHERE id = $3 AND project_id = $4
       RETURNING *`,
      [title, docType, id, pid]
    );

    logger.info({ documentId: id }, 'Document updated');
    res.json({ document: dbRes.rows[0] });
  } catch (err) {
    next(err);
  }
};

// DELETE /projects/:pid/documents/:id
const deleteDocument = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (!uuidSchema.safeParse(pid).success || !uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    const existing = await query(
      'SELECT * FROM documents WHERE id = $1 AND project_id = $2',
      [id, pid]
    );
    if (existing.rows.length === 0) {
      throw new NotFoundError('Document not found in this project');
    }

    await query('DELETE FROM documents WHERE id = $1', [id]);

    if (existing.rows[0].gcs_path) {
      try {
        const key = existing.rows[0].gcs_path.replace(/^gs:\/\/[^/]+\//, '');
        const storage = getStorageAdapter();
        await storage.deleteFile('researchhub-storage', key);
      } catch (storageErr) {
        logger.warn({ err: storageErr.message }, 'Failed to delete storage file for document');
      }
    }

    logger.info({ documentId: id }, 'Document deleted');
    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// GET /projects/:pid/documents/:id/download
const getDownloadUrl = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (!uuidSchema.safeParse(pid).success || !uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    const result = await query(
      'SELECT * FROM documents WHERE id = $1 AND project_id = $2',
      [id, pid]
    );
    if (result.rows.length === 0) {
      throw new NotFoundError('Document not found in this project');
    }

    const doc = result.rows[0];
    const key = doc.gcs_path.replace(/^gs:\/\/[^/]+\//, '');

    const storage = getStorageAdapter();
    const downloadUrl = await storage.getSignedDownloadUrl('researchhub-storage', key, 10);

    res.json({ downloadUrl, document: doc });
  } catch (err) {
    next(err);
  }
};

// GET /projects/:pid/documents/search
const searchDocuments = async (req, res, next) => {
  try {
    const { pid } = req.params;
    if (!uuidSchema.safeParse(pid).success) {
      throw new ValidationError('Invalid project ID format (UUID expected)');
    }

    const { q = '' } = req.query;
    if (!q.trim()) {
      return res.json({ documents: [] });
    }

    const result = await query(
      `SELECT
         d.id,
         d.title,
         d.doc_type,
         d.size_bytes,
         d.created_at,
         u.full_name AS uploaded_by_name
       FROM documents d
       LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE d.project_id = $1 AND d.title ILIKE $2
       ORDER BY d.created_at DESC
       LIMIT 20`,
      [pid, `%${q}%`]
    );

    res.json({ documents: result.rows });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDocuments,
  getUploadUrl,
  createDocument,
  getDocumentById,
  updateDocument,
  deleteDocument,
  getDownloadUrl,
  searchDocuments,
};
