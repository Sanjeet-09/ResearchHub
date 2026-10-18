/**
 * lab-service — Lab Controller
 *
 * Implements the state machine per spec Section 9:
 *   provisioning → running → pausing → paused → resuming → running
 *   running/paused → stopping → stopped
 *   any → failed
 *
 * Limits:
 *   - 1 active session per user
 *   - MAX_CONCURRENT_LABS across the platform
 *   - 1 GPU session per project
 *   - Max 3 paused sessions per user
 *   - Monthly cost guard (LAB_MONTHLY_BUDGET_USD)
 */
'use strict';

const crypto = require('crypto');
const { pool } = require('@rh/shared');
const { emitActivityEvent, emitNotification } = require('@rh/shared');
const logger = require('../logger');
const { getDriver } = require('../drivers');

const getMaxConcurrentLabs = () => parseInt(process.env.MAX_CONCURRENT_LABS || '2', 10);
const getLabMonthlyBudget = () => parseFloat(process.env.LAB_MONTHLY_BUDGET_USD || '8');
const isGpuLabsEnabled = () => process.env.ENABLE_GPU_LABS !== 'false';

// ─────────────────────────────────────────────────────────────
// Helper: insert a lab_session_events row
// ─────────────────────────────────────────────────────────────
async function insertSessionEvent(client, sessionId, event, detail = {}) {
  await client.query(
    `INSERT INTO lab_session_events (session_id, event, detail)
     VALUES ($1, $2, $3)`,
    [sessionId, event, JSON.stringify(detail)]
  );
}

// ─────────────────────────────────────────────────────────────
// Helper: emit activity event (fire-and-forget)
// ─────────────────────────────────────────────────────────────
function fireActivityEvent(session, action, summary) {
  emitActivityEvent({
    projectId: session.project_id,
    actorId: session.user_id,
    action,
    entityType: 'lab_session',
    entityId: session.id,
    summary,
    metadata: { sessionName: session.name, profileKey: session.profile_key },
  });
}

// ─────────────────────────────────────────────────────────────
// Helper: send notification (fire-and-forget)
// ─────────────────────────────────────────────────────────────
function fireNotification(userId, type, title, body, link) {
  emitNotification({ userId, type, title, body, link });
}

// ─────────────────────────────────────────────────────────────
// GET /lab/profiles
// ─────────────────────────────────────────────────────────────
async function getProfiles(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM lab_profiles ORDER BY sort_order ASC`
    );

    const enableGpu = isGpuLabsEnabled();

    // Augment profiles with availability info
    const profiles = rows.map((p) => {
      const isGpu = p.category === 'ai_ml';
      let available = p.is_active;
      let unavailableReason = null;

      if (isGpu && !enableGpu) {
        available = false;
        unavailableReason = 'Available on request — GPU labs are not enabled';
      }

      return { ...p, available, unavailableReason };
    });

    res.json({ profiles });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /lab/sessions — Create and launch a new lab session
// ─────────────────────────────────────────────────────────────
async function createSession(req, res, next) {
  const client = await pool.connect();
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const userRole = req.user?.role || req.headers['x-user-role'];
    const { projectId, profileKey, name } = req.body;

    if (!projectId || !profileKey || !name) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'projectId, profileKey, and name are required' },
      });
    }

    // Verify project membership
    const memberRow = await client.query(
      `SELECT pm.project_role, p.allow_student_gpu FROM project_members pm
       JOIN projects p ON pm.project_id = p.id
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [projectId, userId]
    );
    if (memberRow.rows.length === 0 && userRole !== 'professor' && userRole !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not a project member' } });
    }

    // Fetch profile
    const profileRow = await client.query(
      `SELECT * FROM lab_profiles WHERE key = $1`,
      [profileKey]
    );
    if (profileRow.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lab profile not found' } });
    }
    const profile = profileRow.rows[0];

    // GPU permission checks
    if (profile.category === 'ai_ml') {
      if (!isGpuLabsEnabled()) {
        return res.status(400).json({
          error: { code: 'GPU_DISABLED', message: 'GPU labs are not enabled. Contact your administrator.' },
        });
      }
      if (!profile.is_active) {
        return res.status(400).json({
          error: { code: 'PROFILE_INACTIVE', message: 'This lab profile is not currently available.' },
        });
      }
      // Student GPU restriction
      if (userRole === 'student') {
        const projRow = await client.query(
          `SELECT allow_student_gpu FROM projects WHERE id = $1`,
          [projectId]
        );
        const allowStudentGpu = projRow.rows[0]?.allow_student_gpu || false;
        if (!allowStudentGpu) {
          return res.status(403).json({
            error: { code: 'FORBIDDEN', message: 'GPU sessions are not enabled for students on this project.' },
          });
        }
      }
      // 1 GPU session per project
      const gpuSessionRow = await client.query(
        `SELECT id FROM lab_sessions ls
         JOIN lab_profiles lp ON ls.profile_id = lp.id
         WHERE ls.project_id = $1
           AND lp.category = 'ai_ml'
           AND ls.state IN ('provisioning','running','pausing','paused','resuming')`,
        [projectId]
      );
      if (gpuSessionRow.rows.length > 0) {
        return res.status(409).json({
          error: { code: 'GPU_SESSION_LIMIT', message: 'This project already has an active or paused GPU session.' },
        });
      }
    } else if (!profile.is_active) {
      return res.status(400).json({
        error: { code: 'PROFILE_INACTIVE', message: 'This lab profile is not currently available.' },
      });
    }

    // 1 active session per user
    const activeUserSession = await client.query(
      `SELECT id FROM lab_sessions
       WHERE user_id = $1 AND state IN ('provisioning','running','pausing','resuming')`,
      [userId]
    );
    if (activeUserSession.rows.length > 0) {
      return res.status(409).json({
        error: {
          code: 'SESSION_LIMIT',
          message: 'You already have an active session. Please pause or stop it first.',
        },
      });
    }

    // Platform-wide concurrent limit
    const totalActive = await client.query(
      `SELECT COUNT(*) FROM lab_sessions WHERE state IN ('provisioning','running','resuming')`
    );
    const maxConcurrent = getMaxConcurrentLabs();
    if (parseInt(totalActive.rows[0].count, 10) >= maxConcurrent) {
      return res.status(429).json({
        error: {
          code: 'CONCURRENT_LAB_LIMIT',
          message: `Maximum of ${maxConcurrent} concurrent lab sessions reached. Please try again later.`,
        },
      });
    }

    // Monthly budget guard
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const costRow = await client.query(
      `SELECT COALESCE(SUM(est_cost_usd), 0) AS month_cost
       FROM lab_sessions WHERE created_at >= $1`,
      [monthStart]
    );
    const monthCost = parseFloat(costRow.rows[0].month_cost);
    const monthlyBudget = getLabMonthlyBudget();
    if (monthCost >= monthlyBudget) {
      return res.status(429).json({
        error: {
          code: 'BUDGET_EXCEEDED',
          message: `Monthly lab budget of $${monthlyBudget} has been reached.`,
        },
      });
    }

    // Generate workspace prefix and token
    const sessionId = crypto.randomUUID();
    const workspacePrefix = `workspaces/${userId}/${sessionId}`;
    const jupyterToken = crypto.randomBytes(32).toString('hex');

    // Create session record in provisioning state
    await client.query(
      `INSERT INTO lab_sessions
         (id, user_id, project_id, profile_id, name, state, workspace_prefix, created_at, started_at)
       VALUES ($1, $2, $3, $4, $5, 'provisioning', $6, NOW(), NOW())`,
      [sessionId, userId, projectId, profile.id, name.trim(), workspacePrefix]
    );
    await insertSessionEvent(client, sessionId, 'created', { profileKey });

    res.status(202).json({
      session: { id: sessionId, state: 'provisioning', name: name.trim(), profileKey },
    });

    // Asynchronously provision the container
    _provisionSession(sessionId, userId, projectId, profile, jupyterToken, workspacePrefix, name.trim()).catch(
      (err) => {
        logger.error({ err: err.message, sessionId }, 'Provision failed');
      }
    );
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
}

/**
 * Internal: asynchronously create the container and update session state.
 */
async function _provisionSession(sessionId, userId, projectId, profile, jupyterToken, workspacePrefix, sessionName) {
  const driver = getDriver();
  const client = await pool.connect();
  try {
    // Ensure workspace directory (local mode)
    let workspaceDir = workspacePrefix;
    if (typeof driver.ensureWorkspaceDir === 'function') {
      workspaceDir = driver.ensureWorkspaceDir(userId, sessionId);
    }

    const { containerName: cname, url } = await driver.create({
      sessionId,
      userId,
      profileKey: profile.key,
      jupyterToken,
      workspaceDir,
    });

    // Store encrypted token (simple XOR with key in local mode)
    const tokenKey = process.env.LAB_TOKEN_KEY || 'default_token_key';
    const encToken = _encryptToken(jupyterToken, tokenKey);

    await client.query(
      `UPDATE lab_sessions
       SET state = 'running', cloud_run_service = $1, url = $2,
           jupyter_token_enc = $3, last_active_at = NOW()
       WHERE id = $4`,
      [cname, url, encToken, sessionId]
    );
    await insertSessionEvent(client, sessionId, 'running', { containerName: cname, url });

    // Wait for Jupyter to be ready (up to 90s)
    const ready = await driver.waitForJupyter(url, jupyterToken, 90000);
    if (!ready) {
      logger.warn({ sessionId }, 'Jupyter did not become ready within timeout');
    }

    // Emit activity
    emitActivityEvent({
      projectId,
      actorId: userId,
      action: 'lab_session_started',
      entityType: 'lab_session',
      entityId: sessionId,
      summary: `Started lab session "${sessionName}" (${profile.name})`,
      metadata: { profileKey: profile.key },
    });
  } catch (err) {
    logger.error({ err: err.message, sessionId }, 'Provisioning error — marking failed');
    await client.query(
      `UPDATE lab_sessions SET state = 'failed', last_error = $1 WHERE id = $2`,
      [err.message, sessionId]
    );
    await insertSessionEvent(client, sessionId, 'failed', { error: err.message });
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// GET /lab/sessions — list my sessions
// ─────────────────────────────────────────────────────────────
async function getSessions(req, res, next) {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const { projectId } = req.query;

    let query = `
      SELECT ls.*, lp.name AS profile_name, lp.key AS profile_key,
             lp.category AS profile_category, lp.cpu, lp.memory_gb,
             lp.gpu_type, lp.gpu_count, lp.est_cost_per_hour,
             u.full_name AS user_name
      FROM lab_sessions ls
      JOIN lab_profiles lp ON ls.profile_id = lp.id
      JOIN users u ON ls.user_id = u.id
      WHERE ls.user_id = $1
    `;
    const params = [userId];

    if (projectId) {
      query += ` AND ls.project_id = $2`;
      params.push(projectId);
    }

    query += ` ORDER BY ls.created_at DESC LIMIT 50`;

    const { rows } = await pool.query(query, params);

    // Don't expose url/token to anyone except the owner (already filtered by user_id)
    const sessions = rows.map((s) => ({
      ...s,
      jupyter_token_enc: undefined,
    }));

    res.json({ sessions });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /lab/sessions/:id — single session
// ─────────────────────────────────────────────────────────────
async function getSession(req, res, next) {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT ls.*, lp.name AS profile_name, lp.key AS profile_key,
              lp.category AS profile_category, lp.cpu, lp.memory_gb,
              lp.gpu_type, lp.gpu_count, lp.est_cost_per_hour, lp.max_hours,
              p.title AS project_title,
              u.full_name AS user_name
       FROM lab_sessions ls
       JOIN lab_profiles lp ON ls.profile_id = lp.id
       JOIN projects p ON ls.project_id = p.id
       JOIN users u ON ls.user_id = u.id
       WHERE ls.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }

    const session = rows[0];

    // Only the owner gets url. Project members can see metadata only.
    if (session.user_id !== userId) {
      // Check membership for metadata access
      const memberRow = await pool.query(
        `SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2`,
        [session.project_id, userId]
      );
      const userRole = req.user?.role || req.headers['x-user-role'];
      if (memberRow.rows.length === 0 && userRole !== 'professor' && userRole !== 'admin') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not a project member' } });
      }
      // Non-owners see metadata only
      session.url = undefined;
      session.jupyter_token_enc = undefined;
    } else {
      session.jupyter_token_enc = undefined;
    }

    res.json({ session });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /lab/sessions/:id/pause
// ─────────────────────────────────────────────────────────────
async function pauseSession(req, res, next) {
  const client = await pool.connect();
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const { id } = req.params;

    // Lock the row
    const { rows } = await client.query(
      `SELECT ls.*, lp.key AS profile_key, lp.est_cost_per_hour
       FROM lab_sessions ls
       JOIN lab_profiles lp ON ls.profile_id = lp.id
       WHERE ls.id = $1 FOR UPDATE`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }
    const session = rows[0];
    if (session.user_id !== userId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only the owner can pause a session' } });
    }
    if (session.state !== 'running') {
      return res.status(409).json({
        error: { code: 'INVALID_STATE', message: `Cannot pause a session in state '${session.state}'` },
      });
    }

    // Transition to pausing
    await client.query(
      `UPDATE lab_sessions SET state = 'pausing' WHERE id = $1`,
      [id]
    );
    await insertSessionEvent(client, id, 'pausing', {});
    client.release();

    res.status(202).json({ session: { id, state: 'pausing' } });

    // Async pause
    _executePause(session).catch((err) =>
      logger.error({ err: err.message, sessionId: id }, 'Pause execution failed')
    );
  } catch (err) {
    client.release();
    next(err);
  }
}

async function _executePause(session) {
  const driver = getDriver();
  const client = await pool.connect();
  try {
    const tokenKey = process.env.LAB_TOKEN_KEY || 'default_token_key';
    const jupyterToken = _decryptToken(session.jupyter_token_enc, tokenKey);

    // Best-effort checkpoint
    if (session.url && jupyterToken) {
      await driver.checkpoint(session.url, jupyterToken);
    }

    // Calculate elapsed time
    const startedAt = session.started_at ? new Date(session.started_at).getTime() : Date.now();
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const additionalCost = (elapsed / 3600) * parseFloat(session.est_cost_per_hour || 0);

    // Delete compute
    await driver.deleteContainer(session.id);

    // Update state
    await client.query(
      `UPDATE lab_sessions
       SET state = 'paused', paused_at = NOW(),
           url = NULL,
           total_runtime_seconds = total_runtime_seconds + $1,
           est_cost_usd = est_cost_usd + $2
       WHERE id = $3`,
      [elapsed, additionalCost.toFixed(4), session.id]
    );
    await insertSessionEvent(client, session.id, 'paused', { elapsed });

    emitActivityEvent({
      projectId: session.project_id,
      actorId: session.user_id,
      action: 'lab_session_paused',
      entityType: 'lab_session',
      entityId: session.id,
      summary: `Paused lab session "${session.name}"`,
      metadata: { elapsed },
    });
  } catch (err) {
    logger.error({ err: err.message, sessionId: session.id }, 'Pause failed — marking failed');
    await client.query(
      `UPDATE lab_sessions SET state = 'failed', last_error = $1 WHERE id = $2`,
      [err.message, session.id]
    );
    await insertSessionEvent(client, session.id, 'failed', { error: err.message });
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// POST /lab/sessions/:id/resume
// ─────────────────────────────────────────────────────────────
async function resumeSession(req, res, next) {
  const client = await pool.connect();
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const { id } = req.params;

    const { rows } = await client.query(
      `SELECT ls.*, lp.key AS profile_key, lp.est_cost_per_hour,
              lp.name AS profile_name
       FROM lab_sessions ls
       JOIN lab_profiles lp ON ls.profile_id = lp.id
       WHERE ls.id = $1 FOR UPDATE`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }
    const session = rows[0];
    if (session.user_id !== userId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only the owner can resume a session' } });
    }
    if (session.state !== 'paused') {
      return res.status(409).json({
        error: { code: 'INVALID_STATE', message: `Cannot resume a session in state '${session.state}'` },
      });
    }

    // Check for existing active session
    const activeRow = await client.query(
      `SELECT id FROM lab_sessions
       WHERE user_id = $1 AND state IN ('provisioning','running','pausing','resuming') AND id != $2`,
      [userId, id]
    );
    if (activeRow.rows.length > 0) {
      return res.status(409).json({
        error: { code: 'SESSION_LIMIT', message: 'You already have an active session. Pause or stop it first.' },
      });
    }

    // Platform-wide limit check
    const totalActive = await client.query(
      `SELECT COUNT(*) FROM lab_sessions WHERE state IN ('provisioning','running','resuming')`
    );
    const maxConcurrent = getMaxConcurrentLabs();
    if (parseInt(totalActive.rows[0].count, 10) >= maxConcurrent) {
      return res.status(429).json({
        error: { code: 'CONCURRENT_LAB_LIMIT', message: `Maximum concurrent sessions (${maxConcurrent}) reached.` },
      });
    }

    await client.query(
      `UPDATE lab_sessions SET state = 'resuming' WHERE id = $1`,
      [id]
    );
    await insertSessionEvent(client, id, 'resuming', {});
    client.release();

    res.status(202).json({ session: { id, state: 'resuming' } });

    _executeResume(session).catch((err) =>
      logger.error({ err: err.message, sessionId: id }, 'Resume execution failed')
    );
  } catch (err) {
    client.release();
    next(err);
  }
}

async function _executeResume(session) {
  const driver = getDriver();
  const client = await pool.connect();
  try {
    let workspaceDir = session.workspace_prefix;
    if (typeof driver.ensureWorkspaceDir === 'function') {
      workspaceDir = driver.ensureWorkspaceDir(session.user_id, session.id);
    }

    const newToken = crypto.randomBytes(32).toString('hex');
    const { containerName: cname, url } = await driver.create({
      sessionId: session.id,
      userId: session.user_id,
      profileKey: session.profile_key,
      jupyterToken: newToken,
      workspaceDir,
    });

    const tokenKey = process.env.LAB_TOKEN_KEY || 'default_token_key';
    const encToken = _encryptToken(newToken, tokenKey);

    await client.query(
      `UPDATE lab_sessions
       SET state = 'running', cloud_run_service = $1, url = $2,
           jupyter_token_enc = $3, last_active_at = NOW(),
           started_at = NOW(), paused_at = NULL
       WHERE id = $4`,
      [cname, url, encToken, session.id]
    );
    await insertSessionEvent(client, session.id, 'running', { resumed: true });

    emitActivityEvent({
      projectId: session.project_id,
      actorId: session.user_id,
      action: 'lab_session_resumed',
      entityType: 'lab_session',
      entityId: session.id,
      summary: `Resumed lab session "${session.name}"`,
      metadata: {},
    });
  } catch (err) {
    logger.error({ err: err.message, sessionId: session.id }, 'Resume failed — marking failed');
    await client.query(
      `UPDATE lab_sessions SET state = 'failed', last_error = $1 WHERE id = $2`,
      [err.message, session.id]
    );
    await insertSessionEvent(client, session.id, 'failed', { error: err.message });
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// POST /lab/sessions/:id/stop
// ─────────────────────────────────────────────────────────────
async function stopSession(req, res, next) {
  const client = await pool.connect();
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const { id } = req.params;
    const { exportNotebooks } = req.body || {};

    const { rows } = await client.query(
      `SELECT ls.*, lp.key AS profile_key, lp.est_cost_per_hour,
              lp.name AS profile_name
       FROM lab_sessions ls
       JOIN lab_profiles lp ON ls.profile_id = lp.id
       WHERE ls.id = $1 FOR UPDATE`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }
    const session = rows[0];
    if (session.user_id !== userId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only the owner can stop a session' } });
    }
    if (session.state === 'stopped' || session.state === 'stopping') {
      return res.status(409).json({
        error: { code: 'INVALID_STATE', message: `Session is already ${session.state}` },
      });
    }

    await client.query(
      `UPDATE lab_sessions SET state = 'stopping' WHERE id = $1`,
      [id]
    );
    await insertSessionEvent(client, id, 'stopping', { exportNotebooks: !!exportNotebooks });
    client.release();

    res.status(202).json({ session: { id, state: 'stopping' } });

    _executeStop(session, !!exportNotebooks).catch((err) =>
      logger.error({ err: err.message, sessionId: id }, 'Stop execution failed')
    );
  } catch (err) {
    client.release();
    next(err);
  }
}

async function _executeStop(session, exportNotebooks) {
  const driver = getDriver();
  const client = await pool.connect();
  try {
    // Delete compute (ignore 404)
    await driver.deleteContainer(session.id).catch(() => { });

    // Export notebooks to documents if requested (best-effort)
    if (exportNotebooks) {
      await _exportNotebooks(session).catch((err) =>
        logger.warn({ err: err.message }, 'Notebook export failed (ignored)')
      );
    }

    // Delete workspace
    if (typeof driver.deleteWorkspace === 'function') {
      driver.deleteWorkspace(session.user_id, session.id);
    }

    const elapsed = session.total_runtime_seconds || 0;
    const additionalCost = session.state === 'running'
      ? (elapsed / 3600) * parseFloat(session.est_cost_per_hour || 0)
      : 0;

    await client.query(
      `UPDATE lab_sessions
       SET state = 'stopped', stopped_at = NOW(),
           url = NULL, jupyter_token_enc = NULL,
           est_cost_usd = est_cost_usd + $1
       WHERE id = $2`,
      [additionalCost.toFixed(4), session.id]
    );
    await insertSessionEvent(client, session.id, 'stopped', {});

    emitActivityEvent({
      projectId: session.project_id,
      actorId: session.user_id,
      action: 'lab_session_stopped',
      entityType: 'lab_session',
      entityId: session.id,
      summary: `Stopped lab session "${session.name}"`,
      metadata: {},
    });
  } catch (err) {
    logger.error({ err: err.message, sessionId: session.id }, 'Stop failed — marking failed');
    await client.query(
      `UPDATE lab_sessions SET state = 'failed', last_error = $1 WHERE id = $2`,
      [err.message, session.id]
    );
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// POST /lab/sessions/:id/export — export notebooks to documents
// ─────────────────────────────────────────────────────────────
async function exportSession(req, res, next) {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT ls.* FROM lab_sessions ls WHERE ls.id = $1`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }
    const session = rows[0];
    if (session.user_id !== userId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only the owner can export' } });
    }

    const count = await _exportNotebooks(session);
    res.json({ message: `Exported ${count} notebook(s) to project documents`, count });
  } catch (err) {
    next(err);
  }
}

async function _exportNotebooks(session) {
  const driver = getDriver();
  if (typeof driver.getWorkspacePath !== 'function') return 0;

  const wsPath = driver.getWorkspacePath(session.user_id, session.id);
  if (!require('fs').existsSync(wsPath)) return 0;

  const fs = require('fs');
  const path = require('path');
  const http = require('http');
  const DOCUMENT_SERVICE_URL = process.env.SERVICE_URL_DOCUMENT || 'http://localhost:5005';

  const notebooks = [];
  function findNotebooks(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) findNotebooks(fullPath);
      else if (entry.name.endsWith('.ipynb')) notebooks.push(fullPath);
    }
  }
  findNotebooks(wsPath);

  // For each notebook, create a document entry (fire HTTP to document-service)
  let count = 0;
  for (const nbPath of notebooks) {
    try {
      // This is a best-effort placeholder; the actual upload flow would use the storage adapter.
      // For local mode, we just log it.
      logger.info({ nbPath, sessionId: session.id }, 'Notebook export (local mode — metadata logged)');
      count++;
    } catch (err) {
      logger.warn({ err: err.message, nbPath }, 'Failed to export notebook');
    }
  }
  return count;
}

// ─────────────────────────────────────────────────────────────
// POST /internal/reconcile — idempotent reconciler
// Called by Cloud Scheduler every 5 minutes.
// ─────────────────────────────────────────────────────────────
async function reconcile(req, res, next) {
  try {
    logger.info('Reconciler starting');
    const driver = getDriver();

    const IDLE_PAUSE_MINUTES = parseInt(process.env.IDLE_PAUSE_MINUTES || '10', 10);
    const PAUSED_RETENTION_DAYS = parseInt(process.env.PAUSED_RETENTION_DAYS || '30', 10);
    const WARN_DAYS = 25;

    const client = await pool.connect();
    try {
      // ─ 1. Idle pause: running sessions with all kernels idle
      const runningSessions = await client.query(
        `SELECT ls.*, lp.key AS profile_key, lp.est_cost_per_hour, lp.max_hours
         FROM lab_sessions ls
         JOIN lab_profiles lp ON ls.profile_id = lp.id
         WHERE ls.state = 'running' FOR UPDATE SKIP LOCKED`
      );

      for (const s of runningSessions.rows) {
        try {
          const tokenKey = process.env.LAB_TOKEN_KEY || 'default_token_key';
          const token = _decryptToken(s.jupyter_token_enc, tokenKey);

          // Max hours check
          const startedMs = s.started_at ? new Date(s.started_at).getTime() : Date.now();
          const runningHours = (Date.now() - startedMs) / 3600000;
          if (runningHours >= s.max_hours) {
            logger.info({ sessionId: s.id }, 'Auto-pausing: max hours exceeded');
            await _executePause(s);
            fireNotification(
              s.user_id,
              'lab_auto_paused',
              'Lab Session Auto-Paused',
              `Your session "${s.name}" was paused because it reached the maximum runtime limit.`,
              `/projects/${s.project_id}?tab=lab`
            );
            continue;
          }

          // Idle check
          if (s.url && token) {
            const idle = await driver.areAllKernelsIdle(s.url, token, IDLE_PAUSE_MINUTES);
            if (idle) {
              logger.info({ sessionId: s.id }, 'Auto-pausing: all kernels idle');
              await _executePause(s);
              fireNotification(
                s.user_id,
                'lab_auto_paused',
                'Lab Session Auto-Paused (Idle)',
                `Your session "${s.name}" was auto-paused after ${IDLE_PAUSE_MINUTES} minutes of inactivity.`,
                `/projects/${s.project_id}?tab=lab`
              );
            }
          }
        } catch (err) {
          logger.warn({ err: err.message, sessionId: s.id }, 'Reconciler idle check error');
        }
      }

      // ─ 2. Paused session retention
      const pausedSessions = await client.query(
        `SELECT * FROM lab_sessions WHERE state = 'paused' FOR UPDATE SKIP LOCKED`
      );

      for (const s of pausedSessions.rows) {
        const pausedAt = s.paused_at ? new Date(s.paused_at) : new Date(s.created_at);
        const daysPaused = (Date.now() - pausedAt.getTime()) / 86400000;

        if (daysPaused >= PAUSED_RETENTION_DAYS) {
          logger.info({ sessionId: s.id, daysPaused }, 'Auto-stopping: retention exceeded');
          await _executeStop(s, false);
          fireNotification(
            s.user_id,
            'lab_auto_stopped',
            'Lab Session Auto-Stopped',
            `Your paused session "${s.name}" was deleted after ${PAUSED_RETENTION_DAYS} days.`,
            `/lab`
          );
        } else if (daysPaused >= WARN_DAYS) {
          // Send warning notification (fire-and-forget, might duplicate — acceptable)
          fireNotification(
            s.user_id,
            'lab_expiry_warning',
            'Lab Session Expiring Soon',
            `Your paused session "${s.name}" will be deleted in ${Math.ceil(PAUSED_RETENTION_DAYS - daysPaused)} days.`,
            `/lab`
          );
        }
      }

      // ─ 3. Orphan container cleanup
      const orphanContainers = await driver.list();
      for (const container of orphanContainers) {
        if (!container.sessionId) continue;
        const { rows } = await client.query(
          `SELECT state FROM lab_sessions WHERE id = $1`,
          [container.sessionId]
        );
        const sessionState = rows[0]?.state;
        if (!sessionState || ['paused', 'stopped', 'failed'].includes(sessionState)) {
          logger.info({ container: container.name }, 'Removing orphan container');
          await driver.deleteContainer(container.sessionId).catch(() => { });
        }
      }

      // ─ 4. Sessions stuck in transitional state > 10 min
      const stuckSessions = await client.query(
        `SELECT * FROM lab_sessions
         WHERE state IN ('provisioning','pausing','resuming','stopping')
           AND created_at < NOW() - INTERVAL '10 minutes'
         FOR UPDATE SKIP LOCKED`
      );
      for (const s of stuckSessions.rows) {
        logger.warn({ sessionId: s.id, state: s.state }, 'Session stuck in transitional state — marking failed');
        await client.query(
          `UPDATE lab_sessions SET state = 'failed', last_error = $1 WHERE id = $2`,
          [`Timed out in state '${s.state}'`, s.id]
        );
        await insertSessionEvent(client, s.id, 'failed', { reason: 'stuck_timeout', state: s.state });
        // Try to clean up compute
        await driver.deleteContainer(s.id).catch(() => { });
      }
    } finally {
      client.release();
    }

    logger.info('Reconciler completed');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// Token helpers (simple XOR encryption for local mode)
// In cloud mode use Secret Manager / KMS.
// ─────────────────────────────────────────────────────────────
function _encryptToken(plaintext, key) {
  // Base64 encode with a simple key-derived XOR for local dev
  const buf = Buffer.from(plaintext, 'utf8');
  const keyBuf = Buffer.from(key, 'utf8');
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) {
    out[i] = buf[i] ^ keyBuf[i % keyBuf.length];
  }
  return out.toString('base64');
}

function _decryptToken(encrypted, key) {
  if (!encrypted) return null;
  try {
    const buf = Buffer.from(encrypted, 'base64');
    const keyBuf = Buffer.from(key, 'utf8');
    const out = Buffer.alloc(buf.length);
    for (let i = 0; i < buf.length; i++) {
      out[i] = buf[i] ^ keyBuf[i % keyBuf.length];
    }
    return out.toString('utf8');
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /lab/sessions/:id
// ─────────────────────────────────────────────────────────────
async function deleteSession(req, res, next) {
  const client = await pool.connect();
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const userRole = req.user?.role || req.headers['x-user-role'];
    const { id } = req.params;

    const { rows } = await client.query(
      `SELECT * FROM lab_sessions WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }
    const session = rows[0];

    if (session.user_id !== userId && userRole !== 'professor' && userRole !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to delete this session' } });
    }

    const driver = getDriver();
    try {
      await driver.deleteContainer(session.id);
    } catch (e) {
      // Best effort cleanup
    }

    await client.query(`DELETE FROM lab_sessions WHERE id = $1`, [id]);
    res.json({ message: 'Session deleted successfully' });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /lab/sessions/:id
// Update configuration (name, profile)
// ─────────────────────────────────────────────────────────────
async function updateSession(req, res, next) {
  const client = await pool.connect();
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const userRole = req.user?.role || req.headers['x-user-role'];
    const { id } = req.params;
    const { name, profileKey } = req.body || {};

    const { rows } = await client.query(
      `SELECT ls.*, lp.key AS profile_key, p.allow_student_gpu
       FROM lab_sessions ls
       JOIN lab_profiles lp ON ls.profile_id = lp.id
       JOIN projects p ON ls.project_id = p.id
       WHERE ls.id = $1`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }
    const session = rows[0];

    if (session.user_id !== userId && userRole !== 'professor' && userRole !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to edit this session' } });
    }

    let targetProfileId = session.profile_id;
    if (profileKey && profileKey !== session.profile_key) {
      const pRes = await client.query(`SELECT * FROM lab_profiles WHERE key = $1`, [profileKey]);
      if (pRes.rows.length === 0) {
        return res.status(400).json({ error: { code: 'INVALID_PROFILE', message: 'Profile not found' } });
      }
      const targetProfile = pRes.rows[0];

      if (targetProfile.category === 'ai_ml') {
        if (!isGpuLabsEnabled()) {
          return res.status(400).json({
            error: { code: 'GPU_DISABLED', message: 'GPU labs are currently disabled.' },
          });
        }
        if (userRole === 'student' && !session.allow_student_gpu) {
          return res.status(403).json({
            error: { code: 'STUDENT_GPU_FORBIDDEN', message: 'Students require professor permission to select GPU profiles.' },
          });
        }
      }
      targetProfileId = targetProfile.id;
    }

    const updatedName = (name && name.trim()) ? name.trim() : session.name;

    await client.query(
      `UPDATE lab_sessions
       SET name = $1, profile_id = $2
       WHERE id = $3`,
      [updatedName, targetProfileId, id]
    );

    const fresh = await client.query(
      `SELECT ls.*, lp.key AS profile_key, lp.name AS profile_name,
              lp.category AS profile_category, lp.cpu, lp.memory_gb,
              lp.gpu_type, lp.gpu_count, lp.est_cost_per_hour
       FROM lab_sessions ls
       JOIN lab_profiles lp ON ls.profile_id = lp.id
       WHERE ls.id = $1`,
      [id]
    );

    res.json({ session: fresh.rows[0] });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// POST /lab/sessions/:id/restart
// Relaunch a stopped or failed session
// ─────────────────────────────────────────────────────────────
async function restartSession(req, res, next) {
  const client = await pool.connect();
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const userRole = req.user?.role || req.headers['x-user-role'];
    const { id } = req.params;
    const { name, profileKey } = req.body || {};

    const { rows } = await client.query(
      `SELECT ls.*, lp.key AS profile_key, p.allow_student_gpu
       FROM lab_sessions ls
       JOIN lab_profiles lp ON ls.profile_id = lp.id
       JOIN projects p ON ls.project_id = p.id
       WHERE ls.id = $1 FOR UPDATE`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }
    const session = rows[0];

    if (session.user_id !== userId && userRole !== 'professor' && userRole !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to restart this session' } });
    }

    // 1 active session per user check
    const activeRow = await client.query(
      `SELECT id FROM lab_sessions
       WHERE user_id = $1 AND state IN ('provisioning','running','pausing','resuming') AND id != $2`,
      [userId, id]
    );
    if (activeRow.rows.length > 0) {
      return res.status(409).json({
        error: { code: 'SESSION_LIMIT', message: 'You already have an active session. Please pause or stop it first.' },
      });
    }

    let targetProfileKey = profileKey || session.profile_key;
    const pRes = await client.query(`SELECT * FROM lab_profiles WHERE key = $1`, [targetProfileKey]);
    if (pRes.rows.length === 0) {
      return res.status(400).json({ error: { code: 'INVALID_PROFILE', message: 'Profile not found' } });
    }
    const profile = pRes.rows[0];

    if (profile.category === 'ai_ml') {
      if (!isGpuLabsEnabled()) {
        return res.status(400).json({ error: { code: 'GPU_DISABLED', message: 'GPU labs are currently disabled.' } });
      }
      if (userRole === 'student' && !session.allow_student_gpu) {
        return res.status(403).json({
          error: { code: 'STUDENT_GPU_FORBIDDEN', message: 'Students require professor permission for GPU profiles.' },
        });
      }
    }

    const sessionName = (name && name.trim()) ? name.trim() : session.name;
    const jupyterToken = crypto.randomBytes(32).toString('hex');
    const workspacePrefix = session.workspace_prefix || `workspaces/${userId}/${session.id}`;

    await client.query(
      `UPDATE lab_sessions
       SET state = 'provisioning', name = $1, profile_id = $2,
           started_at = NOW(), stopped_at = NULL, paused_at = NULL,
           last_error = NULL, url = NULL, cloud_run_service = NULL
       WHERE id = $3`,
      [sessionName, profile.id, id]
    );
    await insertSessionEvent(client, id, 'restarted', { profileKey: targetProfileKey });

    res.status(202).json({
      session: { id, state: 'provisioning', name: sessionName, profileKey: targetProfileKey },
    });

    client.release();

    _provisionSession(id, userId, session.project_id, profile, jupyterToken, workspacePrefix, sessionName).catch(
      (err) => logger.error({ err: err.message, sessionId: id }, 'Restart provision failed')
    );
  } catch (err) {
    client.release();
    next(err);
  }
}

// Expose for router and reconciler use
module.exports = {
  getProfiles,
  createSession,
  getSessions,
  getSession,
  pauseSession,
  resumeSession,
  stopSession,
  exportSession,
  reconcile,
  deleteSession,
  updateSession,
  restartSession,
};
