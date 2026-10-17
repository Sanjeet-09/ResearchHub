const { z } = require('zod');
const { query, logger, ValidationError, ForbiddenError, NotFoundError } = require('@rh/shared');

const createEventSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  actorId: z.string().uuid().optional().nullable(),
  action: z.string().min(1).max(100),
  entityType: z.string().optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  summary: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
});

const createAuditSchema = z.object({
  actorId: z.string().uuid().optional().nullable(),
  action: z.string().min(1).max(100),
  entityType: z.string().optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  ip: z.string().optional().nullable(),
  userAgent: z.string().optional().nullable(),
  before: z.any().optional().nullable(),
  after: z.any().optional().nullable(),
});

// POST /internal/events
const recordEvent = async (req, res, next) => {
  try {
    const parsed = createEventSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { projectId, actorId, action, entityType, entityId, summary, metadata } = parsed.data;

    const result = await query(
      `INSERT INTO activity_events (project_id, actor_id, action, entity_type, entity_id, summary, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        projectId || null,
        actorId || null,
        action,
        entityType || null,
        entityId || null,
        summary || null,
        JSON.stringify(metadata || {}),
      ]
    );

    const event = result.rows[0];
    logger.debug({ eventId: event.id, action, projectId }, 'Activity event recorded');
    res.status(201).json({ event });
  } catch (err) {
    next(err);
  }
};

// POST /internal/audit
const recordAudit = async (req, res, next) => {
  try {
    const parsed = createAuditSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { actorId, action, entityType, entityId, ip, userAgent, before, after } = parsed.data;

    const result = await query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, ip, user_agent, before, after)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        actorId || null,
        action,
        entityType || null,
        entityId || null,
        ip || null,
        userAgent || null,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
      ]
    );

    const auditRow = result.rows[0];
    logger.debug({ auditId: auditRow.id, action, actorId }, 'Audit log recorded');
    res.status(201).json({ audit: auditRow });
  } catch (err) {
    next(err);
  }
};

// GET /projects/:pid/timeline
const getProjectTimeline = async (req, res, next) => {
  try {
    const { pid } = req.params;
    if (!pid || !/^[0-9a-fA-F-]{36}$/.test(pid)) {
      throw new ValidationError('Valid project UUID required');
    }

    // Check project exists
    const projCheck = await query('SELECT id, owner_id FROM projects WHERE id = $1', [pid]);
    if (projCheck.rows.length === 0) {
      throw new NotFoundError('Project not found');
    }

    // RBAC: Check user membership if not professor/admin
    const userRole = req.user?.role;
    const isElevated = userRole === 'professor' || userRole === 'admin';

    if (!isElevated) {
      const memberCheck = await query(
        'SELECT project_role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [pid, req.user.id]
      );
      if (memberCheck.rows.length === 0) {
        throw new ForbiddenError('You are not a member of this project');
      }
    }

    const { action, entityType, actorId, from, to, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const params = [pid];
    const where = ['ae.project_id = $1'];

    if (action) {
      params.push(action);
      where.push(`ae.action = $${params.length}`);
    }

    if (entityType) {
      params.push(entityType);
      where.push(`ae.entity_type = $${params.length}`);
    }

    if (actorId) {
      params.push(actorId);
      where.push(`ae.actor_id = $${params.length}`);
    }

    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) {
        params.push(fromDate.toISOString());
        where.push(`ae.created_at >= $${params.length}`);
      }
    }

    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) {
        params.push(toDate.toISOString());
        where.push(`ae.created_at <= $${params.length}`);
      }
    }

    const whereClause = where.join(' AND ');

    // Total count
    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM activity_events ae WHERE ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    // Fetch items with user details
    const listQuery = `
      SELECT
        ae.id,
        ae.project_id,
        ae.actor_id,
        ae.action,
        ae.entity_type,
        ae.entity_id,
        ae.summary,
        ae.metadata,
        ae.created_at,
        u.full_name AS actor_name,
        u.email AS actor_email,
        u.role AS actor_role
      FROM activity_events ae
      LEFT JOIN users u ON ae.actor_id = u.id
      WHERE ${whereClause}
      ORDER BY ae.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limitNum, offset);
    const listRes = await query(listQuery, params);

    res.json({
      events: listRes.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /audit (Professor or Admin only)
const getAuditLogs = async (req, res, next) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'professor' && userRole !== 'admin') {
      throw new ForbiddenError('Only professors or administrators can access system audit logs');
    }

    const { action, entityType, actorId, search, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const params = [];
    const where = [];

    if (action) {
      params.push(action);
      where.push(`al.action = $${params.length}`);
    }

    if (entityType) {
      params.push(entityType);
      where.push(`al.entity_type = $${params.length}`);
    }

    if (actorId) {
      params.push(actorId);
      where.push(`al.actor_id = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(`(al.action ILIKE $${params.length} OR al.entity_type ILIKE $${params.length} OR u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await query(
      `SELECT COUNT(*)::int AS total
       FROM audit_logs al
       LEFT JOIN users u ON al.actor_id = u.id
       ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const listQuery = `
      SELECT
        al.id,
        al.actor_id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.ip,
        al.user_agent,
        al.before,
        al.after,
        al.created_at,
        u.full_name AS actor_name,
        u.email AS actor_email,
        u.role AS actor_role
      FROM audit_logs al
      LEFT JOIN users u ON al.actor_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limitNum, offset);
    const listRes = await query(listQuery, params);

    res.json({
      auditLogs: listRes.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

const presenceHeartbeatSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  currentActivity: z.string().max(255).optional().nullable(),
  entityType: z.string().max(50).optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  currentEntityType: z.string().max(50).optional().nullable(),
  currentEntityId: z.string().uuid().optional().nullable(),
  labSessionId: z.string().uuid().optional().nullable(),
});

// POST /activity/presence/heartbeat or /presence/heartbeat
const recordPresenceHeartbeat = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const parsed = presenceHeartbeatSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const {
      projectId,
      currentActivity,
      entityType,
      entityId,
      currentEntityType,
      currentEntityId,
      labSessionId,
    } = parsed.data;

    const resolvedEntityType = entityType || currentEntityType || null;
    const resolvedEntityId = entityId || currentEntityId || null;

    // Check project exists if projectId is provided
    if (projectId) {
      const projCheck = await query('SELECT id FROM projects WHERE id = $1', [projectId]);
      if (projCheck.rows.length === 0) {
        throw new NotFoundError('Project not found');
      }
    }

    const result = await query(
      `INSERT INTO presence (user_id, project_id, status, current_activity, current_entity_type, current_entity_id, lab_session_id, last_heartbeat_at)
       VALUES ($1, $2, 'online', $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         project_id = EXCLUDED.project_id,
         status = 'online',
         current_activity = EXCLUDED.current_activity,
         current_entity_type = EXCLUDED.current_entity_type,
         current_entity_id = EXCLUDED.current_entity_id,
         lab_session_id = EXCLUDED.lab_session_id,
         last_heartbeat_at = NOW()
       RETURNING *`,
      [
        userId,
        projectId || null,
        currentActivity || null,
        resolvedEntityType,
        resolvedEntityId,
        labSessionId || null,
      ]
    );

    // Also update users.last_seen_at
    await query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [userId]);

    res.json({ presence: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// GET /projects/:pid/presence
const getProjectPresence = async (req, res, next) => {
  try {
    const { pid } = req.params;
    if (!pid || !/^[0-9a-fA-F-]{36}$/.test(pid)) {
      throw new ValidationError('Valid project UUID required');
    }

    // Check project exists
    const projCheck = await query('SELECT id, owner_id FROM projects WHERE id = $1', [pid]);
    if (projCheck.rows.length === 0) {
      throw new NotFoundError('Project not found');
    }

    // RBAC: Check user membership if not professor/admin
    const userRole = req.user?.role;
    const isElevated = userRole === 'professor' || userRole === 'admin';

    if (!isElevated) {
      const memberCheck = await query(
        'SELECT project_role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [pid, req.user.id]
      );
      if (memberCheck.rows.length === 0) {
        throw new ForbiddenError('You are not a member of this project');
      }
    }

    // Query all project members joined with presence and active lab session
    const membersQuery = `
      SELECT
        u.id AS user_id,
        u.full_name,
        u.email,
        u.role AS global_role,
        u.last_seen_at,
        pm.project_role,
        pm.joined_at,
        p.status AS raw_status,
        p.current_activity,
        p.current_entity_type,
        p.current_entity_id,
        p.last_heartbeat_at,
        p.lab_session_id,
        EXTRACT(EPOCH FROM (NOW() - p.last_heartbeat_at))::int AS seconds_since_heartbeat,
        ls.name AS lab_session_name,
        ls.state AS lab_session_state,
        ls.started_at AS lab_session_started_at,
        lp.name AS lab_profile_name
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      LEFT JOIN presence p ON p.user_id = u.id AND p.project_id = $1
      LEFT JOIN lab_sessions ls ON (
        (ls.id = p.lab_session_id OR (ls.user_id = u.id AND ls.project_id = $1))
        AND ls.state = 'running'
      )
      LEFT JOIN lab_profiles lp ON ls.profile_id = lp.id
      WHERE pm.project_id = $1
      ORDER BY
        CASE
          WHEN p.last_heartbeat_at IS NOT NULL AND EXTRACT(EPOCH FROM (NOW() - p.last_heartbeat_at)) < 120 THEN 0
          WHEN p.last_heartbeat_at IS NOT NULL AND EXTRACT(EPOCH FROM (NOW() - p.last_heartbeat_at)) < 600 THEN 1
          ELSE 2
        END,
        u.full_name ASC
    `;

    const membersRes = await query(membersQuery, [pid]);

    const members = membersRes.rows.map((row) => {
      const seconds = row.seconds_since_heartbeat;
      let status = 'offline';

      if (seconds !== null && seconds !== undefined) {
        if (seconds < 120) {
          status = 'online';
        } else if (seconds < 600) {
          status = 'idle';
        }
      }

      // Compute doingNow text
      let doingNow = 'Offline';
      if (status !== 'offline') {
        if (row.lab_session_state === 'running') {
          const startTime = row.lab_session_started_at ? new Date(row.lab_session_started_at).getTime() : Date.now();
          const elapsedMin = Math.max(1, Math.round((Date.now() - startTime) / 60000));
          const profile = row.lab_profile_name || 'Lab';
          doingNow = `Running ${profile} · ${elapsedMin} min`;
        } else if (row.current_activity) {
          doingNow = row.current_activity;
        } else {
          doingNow = status === 'online' ? 'Active in project' : 'Idle';
        }
      }

      return {
        userId: row.user_id,
        fullName: row.full_name,
        email: row.email,
        globalRole: row.global_role,
        projectRole: row.project_role,
        joinedAt: row.joined_at,
        status,
        doingNow,
        currentActivity: status !== 'offline' ? row.current_activity : null,
        currentEntityType: status !== 'offline' ? row.current_entity_type : null,
        currentEntityId: status !== 'offline' ? row.current_entity_id : null,
        lastHeartbeatAt: row.last_heartbeat_at,
        lastSeenAt: row.last_seen_at,
        secondsSinceHeartbeat: seconds,
        labSession: row.lab_session_state === 'running' ? {
          name: row.lab_session_name,
          profileName: row.lab_profile_name,
          startedAt: row.lab_session_started_at,
        } : null,
      };
    });

    res.json({ members });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  recordEvent,
  recordAudit,
  getProjectTimeline,
  getAuditLogs,
  recordPresenceHeartbeat,
  getProjectPresence,
};
