const { z } = require('zod');
const {
  query,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  logger,
  emitActivityEvent,
  emitNotification,
} = require('@rh/shared');

const uuidSchema = z.string().uuid();

const createPublicationSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  authors: z.string().optional().nullable(),
  venue: z.string().optional().nullable(),
  doi: z.string().optional().nullable(),
  status: z.enum(['draft', 'submitted', 'accepted', 'published']).optional().default('draft'),
  publishedOn: z.string().optional().nullable(),
});

const updatePublicationSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  authors: z.string().optional().nullable(),
  venue: z.string().optional().nullable(),
  doi: z.string().optional().nullable(),
  status: z.enum(['draft', 'submitted', 'accepted', 'published']).optional(),
  publishedOn: z.string().optional().nullable(),
});

const addLinkSchema = z.object({
  entityType: z.enum(['experiment', 'dataset', 'document']),
  entityId: z.string().uuid('Entity ID must be a valid UUID'),
});

// ─── Publication CRUD ────────────────────────────────────────────────────────

// GET /projects/:pid/publications
const getPublications = async (req, res, next) => {
  try {
    const { pid } = req.params;
    if (!uuidSchema.safeParse(pid).success) {
      throw new ValidationError('Invalid project ID format (UUID expected)');
    }

    const { page = 1, limit = 50 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const result = await query(
      `SELECT
         p.id,
         p.title,
         p.authors,
         p.venue,
         p.doi,
         p.status,
         p.published_on,
         p.project_id,
         u.id AS created_by_id,
         u.full_name AS created_by_name,
         u.email AS created_by_email,
         (SELECT COUNT(*) FROM publication_links pl WHERE pl.publication_id = p.id) AS link_count
       FROM publications p
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.project_id = $1
       ORDER BY p.published_on DESC NULLS LAST, p.title ASC
       LIMIT $2 OFFSET $3`,
      [pid, parseInt(limit), offset]
    );

    res.json({ publications: result.rows });
  } catch (err) {
    next(err);
  }
};

// POST /projects/:pid/publications
const createPublication = async (req, res, next) => {
  try {
    const { pid } = req.params;
    if (!uuidSchema.safeParse(pid).success) {
      throw new ValidationError('Invalid project ID format (UUID expected)');
    }

    const parsed = createPublicationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { title, authors, venue, doi, status, publishedOn } = parsed.data;

    const dbRes = await query(
      `INSERT INTO publications (project_id, title, authors, venue, doi, status, published_on, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [pid, title, authors || null, venue || null, doi || null, status, publishedOn || null, req.user.id]
    );

    const publication = dbRes.rows[0];
    logger.info({ publicationId: publication.id, projectId: pid }, 'Publication created');

    emitActivityEvent({
      projectId: pid,
      actorId: req.user.id,
      action: 'created_publication',
      entityType: 'publication',
      entityId: publication.id,
      summary: `Created publication "${publication.title}"`,
    });

    res.status(201).json({ publication });
  } catch (err) {
    next(err);
  }
};

// GET /projects/:pid/publications/:id
const getPublicationById = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (!uuidSchema.safeParse(pid).success || !uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    const result = await query(
      `SELECT
         p.*,
         u.full_name AS created_by_name,
         u.email AS created_by_email
       FROM publications p
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.id = $1 AND p.project_id = $2`,
      [id, pid]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Publication not found in this project');
    }

    // Fetch linked entities
    const linksRes = await query(
      'SELECT * FROM publication_links WHERE publication_id = $1',
      [id]
    );

    res.json({
      publication: result.rows[0],
      links: linksRes.rows,
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /projects/:pid/publications/:id
const updatePublication = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (!uuidSchema.safeParse(pid).success || !uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    const parsed = updatePublicationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const existing = await query(
      'SELECT * FROM publications WHERE id = $1 AND project_id = $2',
      [id, pid]
    );
    if (existing.rows.length === 0) {
      throw new NotFoundError('Publication not found in this project');
    }

    const current = existing.rows[0];
    const {
      title = current.title,
      authors = current.authors,
      venue = current.venue,
      doi = current.doi,
      status = current.status,
      publishedOn = current.published_on,
    } = parsed.data;

    const dbRes = await query(
      `UPDATE publications
       SET title = $1, authors = $2, venue = $3, doi = $4, status = $5, published_on = $6
       WHERE id = $7 AND project_id = $8
       RETURNING *`,
      [title, authors, venue, doi, status, publishedOn, id, pid]
    );

    logger.info({ publicationId: id }, 'Publication updated');

    if (status !== current.status && current.created_by) {
      emitNotification({
        userId: current.created_by,
        type: 'publication_status',
        title: 'Publication Status Changed',
        body: `Publication "${title}" status changed to ${status}.`,
        link: `/projects/${pid}?tab=publications`,
      });
    }

    emitActivityEvent({
      projectId: pid,
      actorId: req.user.id,
      action: 'updated_publication',
      entityType: 'publication',
      entityId: id,
      summary: `Updated publication "${title}"${status !== current.status ? ` (status: ${status})` : ''}`,
      metadata: { status, previousStatus: current.status },
    });

    res.json({ publication: dbRes.rows[0] });
  } catch (err) {
    next(err);
  }
};

// DELETE /projects/:pid/publications/:id
const deletePublication = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (!uuidSchema.safeParse(pid).success || !uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    const existing = await query(
      'SELECT * FROM publications WHERE id = $1 AND project_id = $2',
      [id, pid]
    );
    if (existing.rows.length === 0) {
      throw new NotFoundError('Publication not found in this project');
    }

    await query('DELETE FROM publications WHERE id = $1', [id]);
    logger.info({ publicationId: id }, 'Publication deleted');

    emitActivityEvent({
      projectId: pid,
      actorId: req.user.id,
      action: 'deleted_publication',
      entityType: 'publication',
      entityId: id,
      summary: `Deleted publication "${existing.rows[0].title}"`,
    });

    res.json({ message: 'Publication deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── Publication Links (Traceability) ────────────────────────────────────────

// ─── Publication Links (Traceability) ────────────────────────────────────────

// POST /projects/:pid/publications/:id/links or /publications/:id/links
const addLink = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }
    if (pid && !uuidSchema.safeParse(pid).success) {
      throw new ValidationError('Invalid project ID format (UUID expected)');
    }

    const parsed = addLinkSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    // Verify publication exists and belongs to project
    const pubRes = pid
      ? await query('SELECT id, project_id FROM publications WHERE id = $1 AND project_id = $2', [id, pid])
      : await query('SELECT id, project_id FROM publications WHERE id = $1', [id]);

    if (pubRes.rows.length === 0) {
      throw new NotFoundError(pid ? 'Publication not found in this project' : 'Publication not found');
    }

    const publication = pubRes.rows[0];
    const projectId = publication.project_id;

    if (!pid && req.user && req.user.role !== 'admin' && req.user.role !== 'professor') {
      const memberCheck = await query(
        'SELECT project_role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, req.user.id]
      );
      if (memberCheck.rows.length === 0 || memberCheck.rows[0].project_role === 'viewer') {
        throw new ForbiddenError('Requires member or lead role in this project');
      }
    }

    const { entityType, entityId } = parsed.data;

    // Verify the linked entity exists and belongs to the same project
    let entityCheck;
    if (entityType === 'experiment') {
      entityCheck = await query(
        'SELECT id FROM experiments WHERE id = $1 AND project_id = $2',
        [entityId, projectId]
      );
    } else if (entityType === 'dataset') {
      entityCheck = await query(
        'SELECT id FROM datasets WHERE id = $1 AND project_id = $2',
        [entityId, projectId]
      );
    } else if (entityType === 'document') {
      entityCheck = await query(
        'SELECT id FROM documents WHERE id = $1 AND project_id = $2',
        [entityId, projectId]
      );
    }

    if (!entityCheck || entityCheck.rows.length === 0) {
      throw new NotFoundError(`${entityType} not found in this project`);
    }

    // Insert link (upsert — ignore if already exists)
    await query(
      `INSERT INTO publication_links (publication_id, entity_type, entity_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (publication_id, entity_type, entity_id) DO NOTHING`,
      [id, entityType, entityId]
    );

    logger.info({ publicationId: id, entityType, entityId }, 'Publication link added');

    res.status(201).json({ message: 'Link added', link: { publicationId: id, entityType, entityId } });
  } catch (err) {
    next(err);
  }
};

// DELETE /projects/:pid/publications/:id/links or /publications/:id/links
const removeLink = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }
    if (pid && !uuidSchema.safeParse(pid).success) {
      throw new ValidationError('Invalid project ID format (UUID expected)');
    }

    const { entityType, entityId } = req.body;
    if (!entityType || !entityId) {
      throw new ValidationError('entityType and entityId are required');
    }

    const pubRes = pid
      ? await query('SELECT id, project_id FROM publications WHERE id = $1 AND project_id = $2', [id, pid])
      : await query('SELECT id, project_id FROM publications WHERE id = $1', [id]);

    if (pubRes.rows.length === 0) {
      throw new NotFoundError(pid ? 'Publication not found in this project' : 'Publication not found');
    }

    if (!pid && req.user && req.user.role !== 'admin' && req.user.role !== 'professor') {
      const memberCheck = await query(
        'SELECT project_role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [pubRes.rows[0].project_id, req.user.id]
      );
      if (memberCheck.rows.length === 0 || memberCheck.rows[0].project_role === 'viewer') {
        throw new ForbiddenError('Requires member or lead role in this project');
      }
    }

    await query(
      'DELETE FROM publication_links WHERE publication_id = $1 AND entity_type = $2 AND entity_id = $3',
      [id, entityType, entityId]
    );

    logger.info({ publicationId: id, entityType, entityId }, 'Publication link removed');
    res.json({ message: 'Link removed' });
  } catch (err) {
    next(err);
  }
};

// GET /projects/:pid/publications/:id/trace or /publications/:id/trace
// Returns full trace: all linked experiments, datasets, and documents with their details
const getTrace = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }
    if (pid && !uuidSchema.safeParse(pid).success) {
      throw new ValidationError('Invalid project ID format (UUID expected)');
    }

    // Verify publication exists and belongs to project
    const pubRes = pid
      ? await query(
          `SELECT p.*, u.full_name AS created_by_name
           FROM publications p
           LEFT JOIN users u ON p.created_by = u.id
           WHERE p.id = $1 AND p.project_id = $2`,
          [id, pid]
        )
      : await query(
          `SELECT p.*, u.full_name AS created_by_name
           FROM publications p
           LEFT JOIN users u ON p.created_by = u.id
           WHERE p.id = $1`,
          [id]
        );

    if (pubRes.rows.length === 0) {
      throw new NotFoundError(pid ? 'Publication not found in this project' : 'Publication not found');
    }

    const publication = pubRes.rows[0];

    if (!pid && req.user && req.user.role !== 'admin' && req.user.role !== 'professor') {
      const memberCheck = await query(
        'SELECT project_role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [publication.project_id, req.user.id]
      );
      if (memberCheck.rows.length === 0) {
        throw new ForbiddenError('You are not a member of this project');
      }
    }

    // Fetch all links
    const linksRes = await query(
      'SELECT * FROM publication_links WHERE publication_id = $1',
      [id]
    );

    const experiments = [];
    const datasets = [];
    const documents = [];

    for (const link of linksRes.rows) {
      if (link.entity_type === 'experiment') {
        const eRes = await query(
          `SELECT e.id, e.title, e.status, e.created_at, u.full_name AS created_by_name
           FROM experiments e
           LEFT JOIN users u ON e.created_by = u.id
           WHERE e.id = $1`,
          [link.entity_id]
        );
        if (eRes.rows.length > 0) experiments.push(eRes.rows[0]);
      } else if (link.entity_type === 'dataset') {
        const dRes = await query(
          `SELECT d.id, d.name AS title, d.created_at, u.full_name AS created_by_name,
                  (SELECT COUNT(*) FROM dataset_versions dv WHERE dv.dataset_id = d.id) AS version_count
           FROM datasets d
           LEFT JOIN users u ON d.created_by = u.id
           WHERE d.id = $1`,
          [link.entity_id]
        );
        if (dRes.rows.length > 0) datasets.push(dRes.rows[0]);
      } else if (link.entity_type === 'document') {
        const docRes = await query(
          `SELECT d.id, d.title, d.doc_type, d.size_bytes, d.created_at, u.full_name AS uploaded_by_name
           FROM documents d
           LEFT JOIN users u ON d.uploaded_by = u.id
           WHERE d.id = $1`,
          [link.entity_id]
        );
        if (docRes.rows.length > 0) documents.push(docRes.rows[0]);
      }
    }

    res.json({
      publication,
      trace: {
        experiments,
        datasets,
        documents,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPublications,
  createPublication,
  getPublicationById,
  updatePublication,
  deletePublication,
  addLink,
  removeLink,
  getTrace,
};
