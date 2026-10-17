const { z } = require('zod');
const {
  query,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  logger,
  getStorageAdapter,
  emitActivityEvent,
} = require('@rh/shared');

const uuidSchema = z.string().uuid();

const createExperimentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  hypothesis: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  results: z.string().optional().nullable(),
  status: z.enum(['planned', 'running', 'completed', 'failed']).optional().default('planned'),
});

const updateExperimentSchema = z.object({
  title: z.string().min(1).optional(),
  hypothesis: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  results: z.string().optional().nullable(),
  status: z.enum(['planned', 'running', 'completed', 'failed']).optional(),
});

const uploadUrlSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  mimeType: z.string().optional().default('application/octet-stream'),
  sizeBytes: z.number().optional().default(0),
});

const confirmFileSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  gcsPath: z.string().min(1, 'GCS path is required'),
  mimeType: z.string().optional().nullable(),
  sizeBytes: z.number().optional().default(0),
});

// GET /projects/:pid/experiments
const getExperiments = async (req, res, next) => {
  try {
    const { pid } = req.params;
    const pidParse = uuidSchema.safeParse(pid);
    if (!pidParse.success) {
      throw new ValidationError('Invalid project ID format (UUID expected)');
    }

    const result = await query(
      'SELECT e.*, u.full_name as creator_name FROM experiments e LEFT JOIN users u ON e.created_by = u.id WHERE e.project_id = $1 ORDER BY e.created_at DESC',
      [pid]
    );

    res.json({ experiments: result.rows });
  } catch (err) {
    next(err);
  }
};

// POST /projects/:pid/experiments
const createExperiment = async (req, res, next) => {
  try {
    const { pid } = req.params;
    const pidParse = uuidSchema.safeParse(pid);
    if (!pidParse.success) {
      throw new ValidationError('Invalid project ID format (UUID expected)');
    }

    const parsed = createExperimentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { title, hypothesis, notes, results, status } = parsed.data;

    const dbRes = await query(
      `INSERT INTO experiments (project_id, title, hypothesis, notes, results, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [pid, title, hypothesis || null, notes || null, results || null, status, req.user.id]
    );

    const experiment = dbRes.rows[0];
    logger.info({ experimentId: experiment.id, projectId: pid }, 'Experiment created successfully');

    emitActivityEvent({
      projectId: pid,
      actorId: req.user.id,
      action: 'created_experiment',
      entityType: 'experiment',
      entityId: experiment.id,
      summary: `Created experiment "${experiment.title}"`,
    });

    res.status(201).json({ experiment });
  } catch (err) {
    next(err);
  }
};

// GET /projects/:pid/experiments/:id
const getExperimentById = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (!uuidSchema.safeParse(pid).success || !uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    const expRes = await query(
      'SELECT e.*, u.full_name as creator_name FROM experiments e LEFT JOIN users u ON e.created_by = u.id WHERE e.id = $1 AND e.project_id = $2',
      [id, pid]
    );

    if (expRes.rows.length === 0) {
      throw new NotFoundError('Experiment not found in this project');
    }

    const filesRes = await query(
      'SELECT f.*, u.full_name as uploader_name FROM experiment_files f LEFT JOIN users u ON f.uploaded_by = u.id WHERE f.experiment_id = $1 ORDER BY f.created_at ASC',
      [id]
    );

    res.json({
      experiment: expRes.rows[0],
      files: filesRes.rows,
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /projects/:pid/experiments/:id
const updateExperiment = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (!uuidSchema.safeParse(pid).success || !uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    const parsed = updateExperimentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const existing = await query(
      'SELECT * FROM experiments WHERE id = $1 AND project_id = $2',
      [id, pid]
    );
    if (existing.rows.length === 0) {
      throw new NotFoundError('Experiment not found in this project');
    }

    const current = existing.rows[0];
    const {
      title = current.title,
      hypothesis = current.hypothesis,
      notes = current.notes,
      results = current.results,
      status = current.status,
    } = parsed.data;

    const dbRes = await query(
      `UPDATE experiments
       SET title = $1, hypothesis = $2, notes = $3, results = $4, status = $5, updated_at = NOW()
       WHERE id = $6 AND project_id = $7
       RETURNING *`,
      [title, hypothesis, notes, results, status, id, pid]
    );

    logger.info({ experimentId: id }, 'Experiment updated successfully');

    emitActivityEvent({
      projectId: pid,
      actorId: req.user.id,
      action: 'updated_experiment',
      entityType: 'experiment',
      entityId: id,
      summary: `Updated experiment "${title}" (status: ${status})`,
      metadata: { status, previousStatus: current.status },
    });

    res.json({ experiment: dbRes.rows[0] });
  } catch (err) {
    next(err);
  }
};

// DELETE /projects/:pid/experiments/:id
const deleteExperiment = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (!uuidSchema.safeParse(pid).success || !uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    const existing = await query('SELECT * FROM experiments WHERE id = $1 AND project_id = $2', [id, pid]);
    if (existing.rows.length === 0) {
      throw new NotFoundError('Experiment not found in this project');
    }

    await query('DELETE FROM experiments WHERE id = $1 AND project_id = $2', [id, pid]);
    logger.info({ experimentId: id }, 'Experiment deleted successfully');

    emitActivityEvent({
      projectId: pid,
      actorId: req.user.id,
      action: 'deleted_experiment',
      entityType: 'experiment',
      entityId: id,
      summary: `Deleted experiment "${existing.rows[0].title}"`,
    });

    res.json({ message: 'Experiment deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// POST /projects/:pid/experiments/:id/files/upload-url
const getUploadUrl = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (!uuidSchema.safeParse(pid).success || !uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    const parsed = uploadUrlSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const expRes = await query('SELECT id FROM experiments WHERE id = $1 AND project_id = $2', [id, pid]);
    if (expRes.rows.length === 0) {
      throw new NotFoundError('Experiment not found in this project');
    }

    const { fileName, mimeType } = parsed.data;
    const sanitizedFileName = pathSanitize(fileName);
    const key = `datasets/${pid}/experiments/${id}/${Date.now()}_${sanitizedFileName}`;

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

// Helper sanitization for file key
function pathSanitize(str) {
  return String(str).replace(/[^a-zA-Z0-9_.-]/g, '_');
}

// POST /projects/:pid/experiments/:id/files/confirm
const confirmFileUpload = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (!uuidSchema.safeParse(pid).success || !uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    const parsed = confirmFileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const expRes = await query('SELECT id FROM experiments WHERE id = $1 AND project_id = $2', [id, pid]);
    if (expRes.rows.length === 0) {
      throw new NotFoundError('Experiment not found in this project');
    }

    const { fileName, gcsPath, mimeType, sizeBytes } = parsed.data;

    const dbRes = await query(
      `INSERT INTO experiment_files (experiment_id, file_name, gcs_path, mime_type, size_bytes, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, fileName, gcsPath, mimeType || 'application/octet-stream', sizeBytes || 0, req.user.id]
    );

    const fileRecord = dbRes.rows[0];
    logger.info({ fileId: fileRecord.id, experimentId: id }, 'Experiment file record created');

    res.status(201).json({ file: fileRecord });
  } catch (err) {
    next(err);
  }
};

// GET /projects/:pid/experiments/:id/files/:fileId/download
const getDownloadUrl = async (req, res, next) => {
  try {
    const { pid, id, fileId } = req.params;
    if (!uuidSchema.safeParse(pid).success || !uuidSchema.safeParse(id).success || !uuidSchema.safeParse(fileId).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    const fileRes = await query(
      `SELECT f.* FROM experiment_files f
       JOIN experiments e ON f.experiment_id = e.id
       WHERE f.id = $1 AND e.id = $2 AND e.project_id = $3`,
      [fileId, id, pid]
    );

    if (fileRes.rows.length === 0) {
      throw new NotFoundError('File attachment not found');
    }

    const file = fileRes.rows[0];
    const key = file.gcs_path.replace(/^gs:\/\/[^/]+\//, '');

    const storage = getStorageAdapter();
    const downloadUrl = await storage.getSignedDownloadUrl('researchhub-storage', key, 10);

    res.json({ downloadUrl, file });
  } catch (err) {
    next(err);
  }
};

// DELETE /projects/:pid/experiments/:id/files/:fileId
const deleteFile = async (req, res, next) => {
  try {
    const { pid, id, fileId } = req.params;
    if (!uuidSchema.safeParse(pid).success || !uuidSchema.safeParse(id).success || !uuidSchema.safeParse(fileId).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    const fileRes = await query(
      `SELECT f.* FROM experiment_files f
       JOIN experiments e ON f.experiment_id = e.id
       WHERE f.id = $1 AND e.id = $2 AND e.project_id = $3`,
      [fileId, id, pid]
    );

    if (fileRes.rows.length === 0) {
      throw new NotFoundError('File attachment not found');
    }

    const file = fileRes.rows[0];
    const key = file.gcs_path.replace(/^gs:\/\/[^/]+\//, '');

    await query('DELETE FROM experiment_files WHERE id = $1', [fileId]);

    const storage = getStorageAdapter();
    await storage.deleteFile('researchhub-storage', key);

    logger.info({ fileId, experimentId: id }, 'Experiment file deleted');
    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// GET /experiments/:id/links or /projects/:pid/experiments/:id/links
const getExperimentLinks = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid experiment ID format (UUID expected)');
    }

    // Traceability links from activity_events, publication_links, etc.
    const eventsRes = await query(
      'SELECT id, action, entity_type, summary, created_at FROM activity_events WHERE entity_id = $1 ORDER BY created_at DESC LIMIT 20',
      [id]
    );

    const pubLinksRes = await query(
      'SELECT p.id as publication_id, p.title as publication_title, p.status FROM publication_links pl JOIN publications p ON pl.publication_id = p.id WHERE pl.entity_id = $1 AND pl.entity_type = $2',
      [id, 'experiment']
    );

    const links = [
      ...eventsRes.rows.map(e => ({ type: 'activity', id: e.id, label: e.summary || e.action, createdAt: e.created_at })),
      ...pubLinksRes.rows.map(p => ({ type: 'publication', id: p.publication_id, label: p.publication_title, status: p.status })),
    ];

    res.json({ links });
  } catch (err) {
    next(err);
  }
};

module.exports = {
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
};
