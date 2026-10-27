const path = require('path');
const { z } = require('zod');
const {
  query,
  ValidationError,
  NotFoundError,
  logger,
  getStorageAdapter,
  emitActivityEvent,
  emitNotification,
} = require('@rh/shared');

const uuidSchema = z.string().uuid();

const createDatasetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional().nullable(),
});

const updateDatasetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
});

const confirmVersionSchema = z.object({
  gcsPath: z.string().min(1, 'GCS path is required'),
  sizeBytes: z.number().optional().default(0),
  checksumSha256: z.string().min(1, 'Checksum is required'),
  metadata: z.record(z.unknown()).optional().default({}),
  changeNote: z.string().optional().nullable(),
});

const uploadUrlSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  mimeType: z.string().optional().default('application/octet-stream'),
});

// Helper sanitization for file key
function pathSanitize(str) {
  return String(str).replace(/[^a-zA-Z0-9_.-]/g, '_');
}

// ─── Dataset CRUD ────────────────────────────────────────────────────────────

// GET /projects/:pid/datasets
const getDatasets = async (req, res, next) => {
  try {
    const { pid } = req.params;
    if (!uuidSchema.safeParse(pid).success) {
      throw new ValidationError('Invalid project ID format (UUID expected)');
    }

    const result = await query(
      `SELECT
         d.id,
         d.name,
         d.description,
         d.project_id,
         d.created_at,
         u.id AS created_by_id,
         u.full_name AS created_by_name,
         u.email AS created_by_email,
         dv.id AS current_version_id,
         dv.version_no AS current_version_no,
         dv.size_bytes AS current_size_bytes,
         dv.gcs_path AS current_gcs_path,
         dv.metadata AS current_metadata,
         dv.created_at AS current_version_created_at,
         vu.full_name AS current_version_author
       FROM datasets d
       LEFT JOIN users u ON d.created_by = u.id
       LEFT JOIN dataset_versions dv ON d.current_version_id = dv.id
       LEFT JOIN users vu ON dv.created_by = vu.id
       WHERE d.project_id = $1
       ORDER BY d.created_at DESC`,
      [pid]
    );

    const storage = getStorageAdapter();
    const datasets = await Promise.all(
      result.rows.map(async (row) => {
        let downloadUrl = null;
        let fileName = null;
        if (row.current_gcs_path) {
          const key = row.current_gcs_path.replace(/^gs:\/\/[^/]+\//, '');
          downloadUrl = await storage.getSignedDownloadUrl('researchhub-storage', key, 60);
          const rawName = row.current_metadata?.fileName || path.basename(key);
          fileName = rawName.replace(/^[^_]+_[^_]+_[^_]+_v\d+_/, '') || rawName;
        }
        if (!fileName) {
          fileName = row.name.endsWith('.csv')
            ? row.name
            : `${row.name.toLowerCase().replace(/[^a-z0-9_.-]/g, '_')}.csv`;
        }
        return {
          ...row,
          file_name: fileName,
          download_url: downloadUrl,
          file_url: downloadUrl,
        };
      })
    );

    res.json({ datasets });
  } catch (err) {
    next(err);
  }
};

// POST /projects/:pid/datasets
const createDataset = async (req, res, next) => {
  try {
    const { pid } = req.params;
    if (!uuidSchema.safeParse(pid).success) {
      throw new ValidationError('Invalid project ID format (UUID expected)');
    }

    const parsed = createDatasetSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { name, description } = parsed.data;

    const dbRes = await query(
      `INSERT INTO datasets (project_id, name, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [pid, name, description || null, req.user.id]
    );

    const dataset = dbRes.rows[0];

    // If file was attached during creation, create version 1 automatically
    const file = req.file || (req.files && req.files[0]);
    if (file && file.buffer) {
      try {
        const originalName = file.originalname || file.name || `${dataset.name}.csv`;
        const sanitized = pathSanitize(originalName);
        const sizeBytes = file.buffer.length || file.size || 0;
        const key = `datasets/${dataset.id}/v1/${sanitized}`;
        const storage = getStorageAdapter();
        const uploadResult = await storage.uploadFile(key, file.buffer, file.mimetype || 'application/octet-stream');
        const gcsPath = uploadResult?.path || (typeof uploadResult === 'string' ? uploadResult : String(uploadResult));
        const metadata = {
          originalFileName: originalName,
          fileName: originalName,
          mimeType: file.mimetype || 'application/octet-stream',
          sizeBytes,
        };
        const vRes = await query(
          `INSERT INTO dataset_versions
             (dataset_id, version_no, gcs_path, size_bytes, metadata, change_note, created_by)
           VALUES ($1, 1, $2, $3, $4, 'Initial version uploaded', $5)
           RETURNING *`,
          [dataset.id, gcsPath, sizeBytes, JSON.stringify(metadata), req.user.id]
        );
        await query('UPDATE datasets SET current_version_id = $1 WHERE id = $2', [vRes.rows[0].id, dataset.id]);
        dataset.current_version_id = vRes.rows[0].id;
      } catch (uploadErr) {
        logger.warn({ err: uploadErr.message, datasetId: dataset.id }, 'Initial dataset version file upload warning');
      }
    }

    logger.info({ datasetId: dataset.id, projectId: pid }, 'Dataset created');

    emitActivityEvent({
      projectId: pid,
      actorId: req.user.id,
      action: 'created_dataset',
      entityType: 'dataset',
      entityId: dataset.id,
      summary: `Created dataset "${dataset.name}"`,
    });

    res.status(201).json({ dataset });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
    }
    if (err.name === 'NotFoundError') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
    }
    next(err);
  }
};

// GET /projects/:pid/datasets/:id
const getDatasetById = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (!uuidSchema.safeParse(pid).success || !uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    const dsRes = await query(
      `SELECT
         d.*,
         u.full_name AS created_by_name,
         u.email AS created_by_email
       FROM datasets d
       LEFT JOIN users u ON d.created_by = u.id
       WHERE d.id = $1 AND d.project_id = $2`,
      [id, pid]
    );

    if (dsRes.rows.length === 0) {
      throw new NotFoundError('Dataset not found in this project');
    }

    // Fetch full version history
    const versionsRes = await query(
      `SELECT
         dv.*,
         u.full_name AS author_name,
         u.email AS author_email
       FROM dataset_versions dv
       LEFT JOIN users u ON dv.created_by = u.id
       WHERE dv.dataset_id = $1
       ORDER BY dv.version_no DESC`,
      [id]
    );

    res.json({
      dataset: dsRes.rows[0],
      versions: versionsRes.rows,
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /projects/:pid/datasets/:id
const updateDataset = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (!uuidSchema.safeParse(pid).success || !uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    const parsed = updateDatasetSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const existing = await query(
      'SELECT * FROM datasets WHERE id = $1 AND project_id = $2',
      [id, pid]
    );
    if (existing.rows.length === 0) {
      throw new NotFoundError('Dataset not found in this project');
    }

    const current = existing.rows[0];
    const {
      name = current.name,
      description = current.description,
    } = parsed.data;

    const dbRes = await query(
      `UPDATE datasets
       SET name = $1, description = $2
       WHERE id = $3 AND project_id = $4
       RETURNING *`,
      [name, description, id, pid]
    );

    logger.info({ datasetId: id }, 'Dataset updated');
    res.json({ dataset: dbRes.rows[0] });
  } catch (err) {
    next(err);
  }
};

// DELETE /projects/:pid/datasets/:id
const deleteDataset = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (!uuidSchema.safeParse(pid).success || !uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    const existing = await query(
      'SELECT * FROM datasets WHERE id = $1 AND project_id = $2',
      [id, pid]
    );
    if (existing.rows.length === 0) {
      throw new NotFoundError('Dataset not found in this project');
    }

    await query('DELETE FROM datasets WHERE id = $1', [id]);
    logger.info({ datasetId: id }, 'Dataset deleted');

    res.json({ message: 'Dataset deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── Version Control ─────────────────────────────────────────────────────────

// POST /projects/:pid/datasets/:id/versions/upload-url
const getVersionUploadUrl = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (!uuidSchema.safeParse(pid).success || !uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    const parsed = uploadUrlSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    // Verify dataset belongs to this project
    const dsRes = await query(
      'SELECT id, project_id FROM datasets WHERE id = $1 AND project_id = $2',
      [id, pid]
    );
    if (dsRes.rows.length === 0) {
      throw new NotFoundError('Dataset not found in this project');
    }

    // Calculate next version_no
    const versionCountRes = await query(
      'SELECT COALESCE(MAX(version_no), 0) AS max_ver FROM dataset_versions WHERE dataset_id = $1',
      [id]
    );
    const nextVersion = (versionCountRes.rows[0].max_ver || 0) + 1;

    const { fileName, mimeType } = parsed.data;
    const sanitizedFileName = pathSanitize(fileName);
    const key = `datasets/${id}/v${nextVersion}/${sanitizedFileName}`;

    const storage = getStorageAdapter();
    const signedData = await storage.getSignedUploadUrl(key, mimeType);

    res.json({
      uploadUrl: signedData.uploadUrl,
      gcsPath: signedData.gcsPath,
      key,
      nextVersion,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
    }
    if (err.name === 'NotFoundError') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
    }
    next(err);
  }
};

// POST /projects/:pid/datasets/:id/versions or POST /datasets/:id/versions
const createVersion = async (req, res, next) => {
  try {
    const pid = req.params.pid;
    const id = req.params.id;
    if (!uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid dataset ID format (UUID expected)');
    }
    if (pid && !uuidSchema.safeParse(pid).success) {
      throw new ValidationError('Invalid project ID format (UUID expected)');
    }

    const file = req.file || (req.files && req.files[0]);

    let parsedJson = null;
    if (!file) {
      const parsed = confirmVersionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors[0].message);
      }
      parsedJson = parsed.data;
    }

    let queryText = 'SELECT * FROM datasets WHERE id = $1';
    const params = [id];
    if (pid) {
      queryText += ' AND project_id = $2';
      params.push(pid);
    }
    const dsRes = await query(queryText, params);
    if (dsRes.rows.length === 0) {
      throw new NotFoundError('Dataset not found');
    }
    const dataset = dsRes.rows[0];
    const projectId = pid || dataset.project_id;

    // Auto-increment version_no atomically
    const versionCountRes = await query(
      'SELECT COALESCE(MAX(version_no), 0) AS max_ver FROM dataset_versions WHERE dataset_id = $1',
      [id]
    );
    const newVersionNo = (versionCountRes.rows[0].max_ver || 0) + 1;

    let gcsPath = null;
    let sizeBytes = 0;
    let checksumSha256 = null;
    let metadata = {};
    let changeNote = req.body?.change_note || req.body?.changeNote || null;

    if (file) {
      const originalName = file.originalname || file.name || 'dataset.bin';
      sizeBytes = (file.buffer && file.buffer.length) ? file.buffer.length : (file.size !== undefined ? file.size : 0);
      const sanitized = pathSanitize(originalName);
      // Key format: datasets/${datasetId}/v${versionNo}/${fileName}
      const key = `datasets/${id}/v${newVersionNo}/${sanitized}`;
      const storage = getStorageAdapter();
      try {
        const uploadResult = await storage.uploadFile(key, file.buffer, file.mimetype || 'application/octet-stream');
        gcsPath = uploadResult?.path || (typeof uploadResult === 'string' ? uploadResult : String(uploadResult));
      } catch (uploadErr) {
        logger.error({ err: uploadErr.message, datasetId: id }, 'Failed to upload dataset file to storage');
        return res.status(500).json({
          error: {
            code: 'STORAGE_UPLOAD_FAILED',
            message: `Failed to upload dataset to storage: ${uploadErr.message}`,
          },
        });
      }
      metadata = {
        originalFileName: originalName,
        fileName: originalName,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes,
      };
      if (req.body?.checksumSha256) {
        checksumSha256 = req.body.checksumSha256;
      }
    } else if (req.body?.gcsPath) {
      // JSON confirm payload fallback
      gcsPath = req.body.gcsPath;
      sizeBytes = req.body.sizeBytes || 0;
      checksumSha256 = req.body.checksumSha256 || null;
      metadata = req.body.metadata || {};
    } else {
      throw new ValidationError('No dataset file or storage path provided');
    }

    const versionRes = await query(
      `INSERT INTO dataset_versions
         (dataset_id, version_no, gcs_path, size_bytes, checksum_sha256, metadata, change_note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        newVersionNo,
        gcsPath,
        sizeBytes || 0,
        checksumSha256,
        JSON.stringify(metadata),
        changeNote || `Version v${newVersionNo} uploaded`,
        req.user?.id || null,
      ]
    );

    const version = versionRes.rows[0];

    // Update dataset's current_version_id pointer
    await query(
      'UPDATE datasets SET current_version_id = $1 WHERE id = $2',
      [version.id, id]
    );

    logger.info({ datasetId: id, versionId: version.id, versionNo: newVersionNo }, 'Dataset version created');

    emitActivityEvent({
      projectId,
      actorId: req.user?.id || null,
      action: 'version_uploaded',
      entityType: 'dataset',
      entityId: id,
      summary: `Uploaded version v${newVersionNo} for dataset "${dataset.name}"`,
      metadata: { versionNo: newVersionNo, sizeBytes },
    });

    if (dataset.created_by) {
      emitNotification({
        userId: dataset.created_by,
        type: 'dataset_version',
        title: 'New Dataset Version',
        body: `Version v${newVersionNo} uploaded for dataset "${dataset.name}".`,
        link: `/projects/${projectId}?tab=datasets`,
      });
    }

    const newVersion = {
      ...version,
      version_number: version.version_no,
      file_name: metadata?.originalFileName || (typeof metadata === 'string' ? JSON.parse(metadata).originalFileName : 'dataset.bin'),
      file_size: version.size_bytes,
    };

    res.status(201).json({ success: true, version: newVersion });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
    }
    if (err.name === 'NotFoundError') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
    }
    logger.error({ err: err.message, stack: err.stack }, 'Error in createVersion');
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
};

const confirmVersion = createVersion;

// GET /projects/:pid/datasets/:id/versions
const getVersionHistory = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (!uuidSchema.safeParse(pid).success || !uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    const dsRes = await query(
      'SELECT id FROM datasets WHERE id = $1 AND project_id = $2',
      [id, pid]
    );
    if (dsRes.rows.length === 0) {
      throw new NotFoundError('Dataset not found in this project');
    }

    const versionsRes = await query(
      `SELECT
         dv.*,
         u.full_name AS author_name,
         u.email AS author_email
       FROM dataset_versions dv
       LEFT JOIN users u ON dv.created_by = u.id
       WHERE dv.dataset_id = $1
       ORDER BY dv.version_no DESC`,
      [id]
    );

    res.json({ versions: versionsRes.rows });
  } catch (err) {
    next(err);
  }
};

// GET /projects/:pid/datasets/:id/versions/:versionId/download
const getVersionDownloadUrl = async (req, res, next) => {
  try {
    const { pid, id, versionId } = req.params;
    if (
      !uuidSchema.safeParse(pid).success ||
      !uuidSchema.safeParse(id).success ||
      !uuidSchema.safeParse(versionId).success
    ) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    // Verify dataset belongs to project, then find version
    const versionRes = await query(
      `SELECT dv.*
       FROM dataset_versions dv
       JOIN datasets d ON dv.dataset_id = d.id
       WHERE dv.id = $1 AND dv.dataset_id = $2 AND d.project_id = $3`,
      [versionId, id, pid]
    );

    if (versionRes.rows.length === 0) {
      throw new NotFoundError('Version not found for this dataset');
    }

    const version = versionRes.rows[0];
    const key = version.gcs_path.replace(/^gs:\/\/[^/]+\//, '');

    const storage = getStorageAdapter();
    const downloadUrl = await storage.getSignedDownloadUrl('researchhub-storage', key, 10);

    res.json({ downloadUrl, version });
  } catch (err) {
    next(err);
  }
};

// POST /projects/:pid/datasets/:id/versions/:versionId/restore
// Creates a new version from an old one (immutability preserved — old version unchanged)
const restoreVersion = async (req, res, next) => {
  try {
    const { pid, id, versionId } = req.params;
    if (
      !uuidSchema.safeParse(pid).success ||
      !uuidSchema.safeParse(id).success ||
      !uuidSchema.safeParse(versionId).success
    ) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    const dsRes = await query(
      'SELECT * FROM datasets WHERE id = $1 AND project_id = $2',
      [id, pid]
    );
    if (dsRes.rows.length === 0) {
      throw new NotFoundError('Dataset not found in this project');
    }

    const sourceVersionRes = await query(
      'SELECT * FROM dataset_versions WHERE id = $1 AND dataset_id = $2',
      [versionId, id]
    );
    if (sourceVersionRes.rows.length === 0) {
      throw new NotFoundError('Source version not found for this dataset');
    }

    const source = sourceVersionRes.rows[0];

    // Auto-increment version_no atomically
    const versionCountRes = await query(
      'SELECT COALESCE(MAX(version_no), 0) AS max_ver FROM dataset_versions WHERE dataset_id = $1',
      [id]
    );
    const newVersionNo = (versionCountRes.rows[0].max_ver || 0) + 1;

    const changeNote = `Restored from v${source.version_no}`;

    const newVersionRes = await query(
      `INSERT INTO dataset_versions
         (dataset_id, version_no, gcs_path, size_bytes, checksum_sha256, metadata, change_note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        newVersionNo,
        source.gcs_path,
        source.size_bytes,
        source.checksum_sha256,
        source.metadata,
        changeNote,
        req.user.id,
      ]
    );

    const newVersion = newVersionRes.rows[0];

    // Update current_version_id pointer
    await query(
      'UPDATE datasets SET current_version_id = $1 WHERE id = $2',
      [newVersion.id, id]
    );

    logger.info(
      { datasetId: id, newVersionId: newVersion.id, restoredFromVersionId: versionId },
      'Dataset version restored'
    );

    emitActivityEvent({
      projectId: pid,
      actorId: req.user.id,
      action: 'restored_dataset_version',
      entityType: 'dataset',
      entityId: id,
      summary: `Restored dataset "${dsRes.rows[0].name}" to v${newVersionNo} (from v${source.version_no})`,
      metadata: { newVersionNo, restoredFromVersionNo: source.version_no },
    });

    if (dsRes.rows[0]?.created_by) {
      emitNotification({
        userId: dsRes.rows[0].created_by,
        type: 'dataset_version',
        title: 'Dataset Version Restored',
        body: `Dataset "${dsRes.rows[0].name}" was restored to v${newVersionNo}.`,
        link: `/projects/${pid}?tab=datasets`,
      });
    }

    res.status(201).json({ version: newVersion });
  } catch (err) {
    next(err);
  }
};

module.exports = {
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
};
