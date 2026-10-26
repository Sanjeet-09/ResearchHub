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
  venue_journal: z.string().optional().nullable(),
  doi: z.string().optional().nullable(),
  status: z.enum(['draft', 'submitted', 'accepted', 'published']).optional().default('draft'),
  publishedOn: z.string().optional().nullable(),
  published_on: z.string().optional().nullable(),
  publication_date: z.string().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
});

const updatePublicationSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  authors: z.string().optional().nullable(),
  venue: z.string().optional().nullable(),
  venue_journal: z.string().optional().nullable(),
  doi: z.string().optional().nullable(),
  status: z.enum(['draft', 'submitted', 'accepted', 'published']).optional(),
  publishedOn: z.string().optional().nullable(),
  published_on: z.string().optional().nullable(),
  publication_date: z.string().optional().nullable(),
});

const addLinkSchema = z.object({
  entityType: z.enum(['experiment', 'dataset', 'document']),
  entityId: z.string().uuid('Entity ID must be a valid UUID'),
});

function normalizePub(p) {
  if (!p) return p;
  const v = p.venue_journal || p.venue || null;
  const d = p.publication_date || p.published_on || null;
  return {
    ...p,
    venue: v,
    venue_journal: v,
    published_on: d,
    publication_date: d,
    created_at: p.created_at || (d ? `${d}T00:00:00.000Z` : new Date().toISOString()),
  };
}

// ─── Publication CRUD ────────────────────────────────────────────────────────

// GET /projects/:pid/publications or GET /publications
const getPublications = async (req, res, next) => {
  try {
    const { pid } = req.params;
    let queryText = `
      SELECT
         p.*,
         u.id AS created_by_id,
         u.full_name AS created_by_name,
         u.email AS created_by_email,
         (SELECT COUNT(*) FROM publication_links pl WHERE pl.publication_id = p.id) AS link_count
       FROM publications p
       LEFT JOIN users u ON p.created_by = u.id
    `;
    const params = [];
    if (pid) {
      if (!uuidSchema.safeParse(pid).success) {
        throw new ValidationError('Invalid project ID format (UUID expected)');
      }
      queryText += ' WHERE p.project_id = $1';
      params.push(pid);
    }

    const { page = 1, limit = 50 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const limitParams = [parseInt(limit), offset];

    let result;
    try {
      result = await query(
        queryText + ` ORDER BY p.published_on DESC NULLS LAST, p.title ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, ...limitParams]
      );
    } catch (_) {
      try {
        result = await query(
          queryText + ` ORDER BY p.publication_date DESC NULLS LAST, p.title ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, ...limitParams]
        );
      } catch (__) {
        result = await query(
          queryText + ` ORDER BY p.title ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, ...limitParams]
        );
      }
    }
    res.json({ publications: result.rows.map(normalizePub) });
  } catch (err) {
    next(err);
  }
};

// POST /projects/:pid/publications or POST /publications
const createPublication = async (req, res, next) => {
  try {
    const { pid } = req.params;
    const parsed = createPublicationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const {
      title,
      authors,
      venue,
      venue_journal,
      doi,
      status,
      publishedOn,
      published_on,
      publication_date,
      projectId,
      project_id,
    } = parsed.data;

    const finalProjectId = pid || projectId || project_id;
    if (!finalProjectId || !uuidSchema.safeParse(finalProjectId).success) {
      throw new ValidationError('Valid project ID format is required (UUID expected)');
    }

    const finalVenue = venue || venue_journal || null;
    const finalDate = publishedOn || published_on || publication_date || null;

    let dbRes;
    try {
      dbRes = await query(
        `INSERT INTO publications (project_id, title, authors, venue, venue_journal, doi, status, published_on, publication_date, created_by, created_at)
         VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $7, $8, NOW())
         RETURNING *`,
        [finalProjectId, title, authors || null, finalVenue, doi || null, status, finalDate, req.user?.id || null]
      );
    } catch (_) {
      try {
        dbRes = await query(
          `INSERT INTO publications (project_id, title, authors, venue, doi, status, published_on, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [finalProjectId, title, authors || null, finalVenue, doi || null, status, finalDate, req.user?.id || null]
        );
      } catch (__) {
        try {
          dbRes = await query(
            `INSERT INTO publications (project_id, title, authors, venue_journal, doi, status, publication_date, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [finalProjectId, title, authors || null, finalVenue, doi || null, status, finalDate, req.user?.id || null]
          );
        } catch (___) {
          dbRes = await query(
            `INSERT INTO publications (project_id, title, authors, doi, status, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [finalProjectId, title, authors || null, doi || null, status, req.user?.id || null]
          );
        }
      }
    }

    const publication = normalizePub(dbRes.rows[0]);
    logger.info({ publicationId: publication.id, projectId: finalProjectId }, 'Publication created');

    emitActivityEvent({
      projectId: finalProjectId,
      actorId: req.user?.id || null,
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

// GET /projects/:pid/publications/:id or GET /publications/:id
const getPublicationById = async (req, res, next) => {
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
         p.*,
         u.full_name AS created_by_name,
         u.email AS created_by_email
       FROM publications p
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.id = $1`;
    const params = [id];
    if (pid) {
      queryText += ' AND p.project_id = $2';
      params.push(pid);
    }

    const result = await query(queryText, params);

    if (result.rows.length === 0) {
      throw new NotFoundError(pid ? 'Publication not found in this project' : 'Publication not found');
    }

    // Fetch linked entities
    const linksRes = await query(
      'SELECT * FROM publication_links WHERE publication_id = $1',
      [id]
    );

    res.json({
      publication: normalizePub(result.rows[0]),
      links: linksRes.rows,
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /projects/:pid/publications/:id or PATCH /publications/:id
const updatePublication = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (pid && !uuidSchema.safeParse(pid).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }
    if (!uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    const parsed = updatePublicationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    let queryText = 'SELECT * FROM publications WHERE id = $1';
    const params = [id];
    if (pid) {
      queryText += ' AND project_id = $2';
      params.push(pid);
    }

    const existing = await query(queryText, params);
    if (existing.rows.length === 0) {
      throw new NotFoundError(pid ? 'Publication not found in this project' : 'Publication not found');
    }

    const current = existing.rows[0];
    const {
      title = current.title,
      authors = current.authors,
      venue,
      venue_journal,
      doi = current.doi,
      status = current.status,
      publishedOn,
      published_on,
      publication_date,
    } = parsed.data;

    const finalVenue = venue !== undefined ? venue : (venue_journal !== undefined ? venue_journal : current.venue);
    const finalDate = publishedOn !== undefined ? publishedOn : (published_on !== undefined ? published_on : (publication_date !== undefined ? publication_date : current.published_on));

    let dbRes;
    try {
      dbRes = await query(
        `UPDATE publications
         SET title = $1, authors = $2, venue = $3, venue_journal = $3, doi = $4, status = $5, published_on = $6, publication_date = $6
         WHERE id = $7
         RETURNING *`,
        [title, authors, finalVenue, doi, status, finalDate, id]
      );
    } catch (_) {
      try {
        dbRes = await query(
          `UPDATE publications
           SET title = $1, authors = $2, venue = $3, doi = $4, status = $5, published_on = $6
           WHERE id = $7
           RETURNING *`,
          [title, authors, finalVenue, doi, status, finalDate, id]
        );
      } catch (__) {
        try {
          dbRes = await query(
            `UPDATE publications
             SET title = $1, authors = $2, venue_journal = $3, doi = $4, status = $5, publication_date = $6
             WHERE id = $7
             RETURNING *`,
            [title, authors, finalVenue, doi, status, finalDate, id]
          );
        } catch (___) {
          dbRes = await query(
            `UPDATE publications
             SET title = $1, authors = $2, doi = $3, status = $4
             WHERE id = $5
             RETURNING *`,
            [title, authors, doi, status, id]
          );
        }
      }
    }

    logger.info({ publicationId: id }, 'Publication updated');

    const targetPid = pid || current.project_id;
    if (status !== current.status && current.created_by) {
      emitNotification({
        userId: current.created_by,
        type: 'publication_status',
        title: 'Publication Status Changed',
        body: `Publication "${title}" status changed to ${status}.`,
        link: `/projects/${targetPid}?tab=publications`,
      });
    }

    emitActivityEvent({
      projectId: targetPid,
      actorId: req.user?.id || null,
      action: 'updated_publication',
      entityType: 'publication',
      entityId: id,
      summary: `Updated publication "${title}"${status !== current.status ? ` (status: ${status})` : ''}`,
      metadata: { status, previousStatus: current.status },
    });

    res.json({ publication: normalizePub(dbRes.rows[0]) });
  } catch (err) {
    next(err);
  }
};

// DELETE /projects/:pid/publications/:id or DELETE /publications/:id
const deletePublication = async (req, res, next) => {
  try {
    const { pid, id } = req.params;
    if (pid && !uuidSchema.safeParse(pid).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }
    if (!uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid ID format (UUID expected)');
    }

    let queryText = 'SELECT * FROM publications WHERE id = $1';
    const params = [id];
    if (pid) {
      queryText += ' AND project_id = $2';
      params.push(pid);
    }

    const existing = await query(queryText, params);
    if (existing.rows.length === 0) {
      throw new NotFoundError(pid ? 'Publication not found in this project' : 'Publication not found');
    }

    await query('DELETE FROM publications WHERE id = $1', [id]);
    logger.info({ publicationId: id }, 'Publication deleted');

    emitActivityEvent({
      projectId: pid || existing.rows[0].project_id,
      actorId: req.user?.id || null,
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
