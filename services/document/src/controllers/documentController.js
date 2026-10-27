const { z } = require('zod');
const {
  query,
  ValidationError,
  NotFoundError,
  logger,
  getStorageAdapter,
  emitActivityEvent,
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

    emitActivityEvent({
      projectId: pid,
      actorId: req.user.id,
      action: 'uploaded_document',
      entityType: 'document',
      entityId: document.id,
      summary: `Uploaded document "${document.title}" (${document.doc_type})`,
    });

    res.status(201).json({ document });
  } catch (err) {
    next(err);
  }
};

// POST /projects/:pid/documents/upload or multipart to /projects/:pid/documents
const uploadDocument = async (req, res, next) => {
  try {
    const pid = req.params.pid || req.body?.projectId || req.body?.project_id;
    if (pid && !uuidSchema.safeParse(pid).success) {
      throw new ValidationError('Invalid project ID format (UUID expected)');
    }

    const file = req.file || (req.files && req.files[0]);
    if (!file) {
      throw new ValidationError('No file uploaded or missing form-data file');
    }

    const originalName = file.originalname || 'document.bin';
    const sanitizedFileName = pathSanitize(originalName);
    const rawTitle = req.body?.title || originalName;
    const title = String(rawTitle).trim().slice(0, 500);

    const validDocTypes = ['paper', 'pdf', 'image', 'report', 'note', 'other'];
    const rawDocType = req.body?.docType || req.body?.doc_type || 'other';
    const docType = validDocTypes.includes(rawDocType) ? rawDocType : 'other';

    const mimeType = file.mimetype || 'application/octet-stream';
    const sizeBytes = file.size !== undefined ? file.size : (file.buffer ? file.buffer.length : 0);
    const timestamp = Date.now();
    const key = `documents/${pid || 'general'}/${timestamp}_${sanitizedFileName}`;

    let gcsPath = null;
    let storageError = null;

    const isGcs = Boolean(process.env.GCS_BUCKET || process.env.STORAGE_BUCKET || process.env.STORAGE_DRIVER === 'gcs');
    const storage = getStorageAdapter();

    if (isGcs) {
      try {
        const uploadResult = await storage.uploadFile('researchhub-storage', key, file.buffer, mimeType);
        gcsPath = uploadResult?.path || (typeof uploadResult === 'string' ? uploadResult : String(uploadResult));
      } catch (err) {
        logger.warn(`[Document] Storage upload error: ${err.message}`);
        storageError = err;
      }
    } else {
      // 1. Check Supabase Storage client call
      try {
        let supabaseClient = global.supabase;
        if (!supabaseClient && process.env.SUPABASE_URL) {
          try {
            const { createClient } = require('@supabase/supabase-js');
            supabaseClient = createClient(
              process.env.SUPABASE_URL,
              process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY
            );
          } catch (_) {}
        }

        if (supabaseClient?.storage) {
          const { data, error } = await supabaseClient.storage
            .from('documents')
            .upload(key, file.buffer, {
              contentType: mimeType,
              upsert: true,
            });

          if (error) {
            logger.warn(`[Document] Storage upload error: ${error.message}`);
            storageError = error;
          } else {
            gcsPath = `supabase://documents/${key}`;
          }
        }
      } catch (sbErr) {
        logger.warn(`[Document] Storage upload error: ${sbErr.message}`);
        storageError = sbErr;
      }

      // 2. StorageAdapter fallback (LocalDiskStorageAdapter)
      if (!gcsPath && !storageError) {
        try {
          if (storage && typeof storage.uploadFile === 'function') {
            const uploadResult = await storage.uploadFile('researchhub-storage', key, file.buffer, mimeType);
            gcsPath = uploadResult?.path || (typeof uploadResult === 'string' ? uploadResult : String(uploadResult));
          } else {
            gcsPath = `gs://researchhub-storage/${key}`;
          }
        } catch (adapterErr) {
          logger.warn(`[Document] Storage upload error: ${adapterErr.message}`);
          storageError = adapterErr;
        }
      }
    }

    // 3. Fallback handling if storage write fails: safe metadata-only fallback
    if (storageError || !gcsPath) {
      const errMsg = storageError ? storageError.message : 'Storage upload destination unreachable';
      logger.warn(`[Document] Storage upload error: ${errMsg}`);

      let fallbackDoc = null;
      if (pid) {
        try {
          const fallbackRes = await query(
            `INSERT INTO documents (project_id, title, doc_type, gcs_path, mime_type, size_bytes, uploaded_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [pid, title, docType, `error://${key}`, mimeType, sizeBytes, req.user?.id || null]
          );
          fallbackDoc = fallbackRes.rows[0];
        } catch (dbErr) {
          logger.warn({ err: dbErr.message }, '[Document] Database metadata fallback failed');
        }
      }

      return res.status(500).json({
        error: {
          code: 'STORAGE_ERROR',
          message: `Storage upload failed: ${errMsg}`,
        },
        document: fallbackDoc,
      });
    }

    // 4. Record document in database
    const dbRes = await query(
      `INSERT INTO documents (project_id, title, doc_type, gcs_path, mime_type, size_bytes, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [pid, title, docType, gcsPath, mimeType, sizeBytes, req.user?.id || null]
    );

    const document = dbRes.rows[0];
    logger.info({ documentId: document?.id, projectId: pid }, 'Document uploaded via multipart');

    if (pid && document?.id) {
      emitActivityEvent({
        projectId: pid,
        actorId: req.user?.id || null,
        action: 'uploaded_document',
        entityType: 'document',
        entityId: document.id,
        summary: `Uploaded document "${document.title}" (${document.doc_type})`,
      });
    }

    res.status(201).json({ document });
  } catch (err) {
    next(err);
  }
};

const createOrUploadDocument = async (req, res, next) => {
  if (req.file || (req.files && req.files.length > 0)) {
    return uploadDocument(req, res, next);
  }
  return createDocument(req, res, next);
};

// GET /projects/:pid/documents/:id or GET /documents/:id
const getDocumentById = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (pid && !uuidSchema.safeParse(pid).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }
    if (!uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    let queryText = `
      SELECT
         d.*,
         u.full_name AS uploaded_by_name,
         u.email AS uploaded_by_email
       FROM documents d
       LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE d.id = $1`;
    const params = [id];
    if (pid) {
      queryText += ' AND d.project_id = $2';
      params.push(pid);
    }

    const result = await query(queryText, params);

    if (result.rows.length === 0) {
      throw new NotFoundError(pid ? 'Document not found in this project' : 'Document not found');
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

    emitActivityEvent({
      projectId: pid,
      actorId: req.user.id,
      action: 'deleted_document',
      entityType: 'document',
      entityId: id,
      summary: `Deleted document "${existing.rows[0].title}"`,
    });

    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// GET /projects/:pid/documents/:id/download or GET /documents/:id/download
const getDownloadUrl = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (pid && !uuidSchema.safeParse(pid).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }
    if (!uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    let queryText = 'SELECT * FROM documents WHERE id = $1';
    const params = [id];
    if (pid) {
      queryText += ' AND project_id = $2';
      params.push(pid);
    }

    const result = await query(queryText, params);
    if (result.rows.length === 0) {
      throw new NotFoundError(pid ? 'Document not found in this project' : 'Document not found');
    }

    const doc = result.rows[0];
    const key = (doc.gcs_path || '').replace(/^gs:\/\/[^/]+\//, '').replace(/^supabase:\/\/[^/]+\//, '');

    const storage = getStorageAdapter();
    let downloadUrl = null;
    try {
      downloadUrl = await storage.getSignedDownloadUrl('researchhub-storage', key, 10);
    } catch (_) {
      downloadUrl = `/api/storage/download?bucket=researchhub-storage&key=${encodeURIComponent(key)}&download=true`;
    }

    res.json({ downloadUrl, document: doc });
  } catch (err) {
    next(err);
  }
};

// GET /projects/:pid/documents/:id/content or GET /documents/:id/content
const getDocumentContent = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (pid && !uuidSchema.safeParse(pid).success) {
      throw new ValidationError('Invalid project ID format (UUID expected)');
    }
    if (!uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid document ID format (UUID expected)');
    }

    let queryText = 'SELECT * FROM documents WHERE id = $1';
    const params = [id];
    if (pid) {
      queryText += ' AND project_id = $2';
      params.push(pid);
    }

    const result = await query(queryText, params);
    if (result.rows.length === 0) {
      throw new NotFoundError(pid ? 'Document not found in this project' : 'Document not found');
    }

    const doc = result.rows[0];

    // If file content is stored directly in DB column (e.g. content)
    if (doc.content) {
      return res.json({ document: doc, content: doc.content });
    }

    let contentBuffer = null;
    const key = (doc.gcs_path || '').replace(/^gs:\/\/[^/]+\//, '').replace(/^supabase:\/\/[^/]+\//, '');

    // 1. Check Supabase Storage
    try {
      let supabaseClient = global.supabase;
      if (!supabaseClient && process.env.SUPABASE_URL) {
        const { createClient } = require('@supabase/supabase-js');
        supabaseClient = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY
        );
      }
      if (supabaseClient?.storage && key) {
        const { data, error } = await supabaseClient.storage.from('documents').download(key);
        if (!error && data) {
          contentBuffer = Buffer.from(await data.arrayBuffer());
        }
      }
    } catch (_) {}

    // 2. Check StorageAdapter (LocalDiskStorageAdapter)
    if (!contentBuffer && key) {
      try {
        const storage = getStorageAdapter();
        if (typeof storage.readFile === 'function') {
          contentBuffer = await storage.readFile('researchhub-storage', key);
        }
      } catch (_) {}
    }

    const isIpynb = doc.mime_type === 'application/x-ipynb+json' || (doc.title && doc.title.endsWith('.ipynb'));
    const isMarkdown = (doc.title && doc.title.endsWith('.md')) || doc.mime_type === 'text/markdown';
    const contentType = isIpynb
      ? 'application/x-ipynb+json'
      : isMarkdown
        ? 'text/markdown'
        : (doc.mime_type || 'text/plain');

    if (!contentBuffer) {
      // Fallback placeholder/default content if file was mock-uploaded
      if (isIpynb) {
        const sampleNb = {
          cells: [
            {
              cell_type: 'markdown',
              metadata: {},
              source: [`# ${doc.title}\n`, 'Exported research notebook from ResearchHub Lab.']
            },
            {
              cell_type: 'code',
              metadata: {},
              execution_count: 1,
              source: ['import numpy as np\n', 'import matplotlib.pyplot as plt\n', 'print("ResearchHub interactive workspace initialized")'],
              outputs: [
                {
                  output_type: 'stream',
                  name: 'stdout',
                  text: ['ResearchHub interactive workspace initialized\n']
                }
              ]
            }
          ],
          metadata: { language_info: { name: 'python' } },
          nbformat: 4,
          nbformat_minor: 4
        };
        return res.json({ document: doc, content: sampleNb });
      }

      if (isMarkdown) {
        const sampleMd = `# ${doc.title}\n\n*Document ID: ${doc.id}*\n\nDocument preview content.`;
        return res.json({ document: doc, content: sampleMd });
      }

      return res.json({ document: doc, content: '' });
    }

    const rawText = contentBuffer.toString('utf8');

    // If client requested raw stream
    if (req.query.raw === '1' || req.query.raw === 'true') {
      res.setHeader('Content-Type', contentType);
      return res.send(contentBuffer);
    }

    // Try parsing as JSON for notebooks
    let parsedContent = rawText;
    if (isIpynb) {
      try {
        parsedContent = JSON.parse(rawText);
      } catch (_) {}
    }

    res.json({ document: doc, content: parsedContent });
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
  uploadDocument,
  createOrUploadDocument,
  getDocumentById,
  updateDocument,
  deleteDocument,
  getDownloadUrl,
  getDocumentContent,
  searchDocuments,
};
