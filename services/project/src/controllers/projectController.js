const { z } = require('zod');
const {
  query,
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  logger,
} = require('@rh/shared');

const createProjectSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200).trim(),
  description: z.string().optional().default(''),
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'published']).optional().default('planning'),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  allowStudentGpu: z.boolean().optional().default(false),
});

const updateProjectSchema = createProjectSchema.partial();

const updateStatusSchema = z.object({
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'published'], {
    errorMap: () => ({ message: "Status must be 'planning', 'active', 'on_hold', 'completed', or 'published'" }),
  }),
});

const addMemberSchema = z.object({
  userId: z.string().uuid('Valid user ID required'),
  projectRole: z.enum(['lead', 'member', 'viewer'], {
    errorMap: () => ({ message: "Role must be 'lead', 'member', or 'viewer'" }),
  }).optional().default('member'),
});

const createMilestoneSchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  dueDate: z.string().optional().nullable(),
  isDone: z.boolean().optional().default(false),
});

const updateMilestoneSchema = createMilestoneSchema.partial();

/**
 * List projects accessible to user (or all if professor)
 */
const getProjects = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const isGlobalAdmin = req.user.role === 'admin' || req.user.role === 'professor';

    let sql;
    let params = [];

    if (isGlobalAdmin) {
      sql = `
        SELECT p.*, u.full_name as owner_name, u.email as owner_email,
               (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id)::int as member_count
        FROM projects p
        LEFT JOIN users u ON p.owner_id = u.id
        ORDER BY p.updated_at DESC
      `;
    } else {
      sql = `
        SELECT p.*, u.full_name as owner_name, u.email as owner_email,
               pm.project_role,
               (SELECT COUNT(*) FROM project_members pm2 WHERE pm2.project_id = p.id)::int as member_count
        FROM projects p
        INNER JOIN project_members pm ON p.id = pm.project_id
        LEFT JOIN users u ON p.owner_id = u.id
        WHERE pm.user_id = $1
        ORDER BY p.updated_at DESC
      `;
      params = [userId];
    }

    const result = await query(sql, params);
    res.json({ projects: result.rows });
  } catch (err) {
    next(err);
  }
};

/**
 * Get project details with members and milestones
 */
const getProjectById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate UUID parameters
    const uuidSchema = z.string().uuid();
    if (!uuidSchema.safeParse(id).success) {
      return next(new ValidationError('Invalid project ID format (UUID expected)'));
    }
    if (!uuidSchema.safeParse(userId).success) {
      return next(new ValidationError('Invalid user ID format (UUID expected)'));
    }

    const isGlobalAdmin = req.user.role === 'admin' || req.user.role === 'professor';

    // Verify membership unless admin or professor
    if (!isGlobalAdmin) {
      const memberCheck = await query(
        'SELECT project_role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [id, userId]
      );
      if (memberCheck.rows.length === 0) {
        return next(new ForbiddenError('You are not a member of this project'));
      }
    }

    // Fetch project
    const projectRes = await query(
      `SELECT p.*, u.full_name as owner_name, u.email as owner_email
       FROM projects p
       LEFT JOIN users u ON p.owner_id = u.id
       WHERE p.id = $1`,
      [id]
    );

    if (projectRes.rows.length === 0) {
      return next(new NotFoundError('Project not found'));
    }

    const project = projectRes.rows[0];

    // Fetch members
    const membersRes = await query(
      `SELECT pm.project_id, pm.user_id, pm.project_role, pm.joined_at,
              u.full_name, u.email, u.role as global_role
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1
       ORDER BY pm.joined_at ASC`,
      [id]
    );

    // Fetch milestones
    const milestonesRes = await query(
      `SELECT id, project_id, title, due_date, is_done
       FROM milestones
       WHERE project_id = $1
       ORDER BY due_date ASC NULLS LAST, title ASC`,
      [id]
    );

    res.json({
      project: {
        ...project,
        members: membersRes.rows,
        milestones: milestonesRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new project (Professors and Researchers only; Creator becomes 'lead')
 */
const createProject = async (req, res, next) => {
  try {
    if (req.user.role === 'student') {
      return next(new ForbiddenError('Students are not allowed to create projects'));
    }

    const parseResult = createProjectSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid input';
      return next(new ValidationError(firstError, parseResult.error.errors));
    }

    const { title, description, status, startDate, endDate, allowStudentGpu } = parseResult.data;
    const userId = req.user.id;

    const projectRes = await query(
      `INSERT INTO projects (title, description, status, start_date, end_date, allow_student_gpu, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [title, description, status, startDate || null, endDate || null, allowStudentGpu, userId]
    );

    const project = projectRes.rows[0];

    // Creator automatically becomes 'lead' in project_members
    await query(
      `INSERT INTO project_members (project_id, user_id, project_role)
       VALUES ($1, $2, 'lead')`,
      [project.id, userId]
    );

    logger.info({ projectId: project.id, ownerId: userId }, 'Project created successfully');

    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
};

/**
 * Update project details
 */
const updateProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const parseResult = updateProjectSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid input';
      return next(new ValidationError(firstError, parseResult.error.errors));
    }

    const fields = parseResult.data;
    const setClauses = [];
    const params = [id];

    if (fields.title !== undefined) {
      params.push(fields.title);
      setClauses.push(`title = $${params.length}`);
    }
    if (fields.description !== undefined) {
      params.push(fields.description);
      setClauses.push(`description = $${params.length}`);
    }
    if (fields.status !== undefined) {
      params.push(fields.status);
      setClauses.push(`status = $${params.length}`);
    }
    if (fields.startDate !== undefined) {
      params.push(fields.startDate || null);
      setClauses.push(`start_date = $${params.length}`);
    }
    if (fields.endDate !== undefined) {
      params.push(fields.endDate || null);
      setClauses.push(`end_date = $${params.length}`);
    }
    if (fields.allowStudentGpu !== undefined) {
      params.push(fields.allowStudentGpu);
      setClauses.push(`allow_student_gpu = $${params.length}`);
    }

    if (setClauses.length === 0) {
      return next(new ValidationError('No fields provided to update'));
    }

    setClauses.push('updated_at = NOW()');

    const sql = `UPDATE projects SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`;
    const result = await query(sql, params);

    if (result.rows.length === 0) {
      return next(new NotFoundError('Project not found'));
    }

    res.json({ project: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * Update project status
 */
const updateProjectStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const parseResult = updateStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid status';
      return next(new ValidationError(firstError, parseResult.error.errors));
    }

    const { status } = parseResult.data;

    const result = await query(
      `UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return next(new NotFoundError('Project not found'));
    }

    res.json({ project: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete project (Professor or Project Lead)
 */
const deleteProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM projects WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return next(new NotFoundError('Project not found'));
    }

    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * Add a member to a project
 */
const addMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const parseResult = addMemberSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid member input';
      return next(new ValidationError(firstError, parseResult.error.errors));
    }

    const { userId, projectRole } = parseResult.data;

    // Check if user exists
    const userCheck = await query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return next(new NotFoundError('Target user not found'));
    }

    const result = await query(
      `INSERT INTO project_members (project_id, user_id, project_role)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id) 
       DO UPDATE SET project_role = EXCLUDED.project_role
       RETURNING project_id, user_id, project_role, joined_at`,
      [id, userId, projectRole]
    );

    res.status(201).json({ member: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * Remove a member from a project
 */
const removeMember = async (req, res, next) => {
  try {
    const { id, userId } = req.params;

    const result = await query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 RETURNING user_id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return next(new NotFoundError('Member not found in this project'));
    }

    res.json({ message: 'Member removed successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * Milestone CRUD operations
 */
const createMilestone = async (req, res, next) => {
  try {
    const { id: projectId } = req.params;
    const parseResult = createMilestoneSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid milestone input';
      return next(new ValidationError(firstError, parseResult.error.errors));
    }

    const { title, dueDate, isDone } = parseResult.data;

    const result = await query(
      `INSERT INTO milestones (project_id, title, due_date, is_done)
       VALUES ($1, $2, $3, $4)
       RETURNING id, project_id, title, due_date, is_done`,
      [projectId, title, dueDate || null, isDone]
    );

    res.status(201).json({ milestone: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const updateMilestone = async (req, res, next) => {
  try {
    const { id: projectId, milestoneId } = req.params;
    const parseResult = updateMilestoneSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid milestone input';
      return next(new ValidationError(firstError, parseResult.error.errors));
    }

    const fields = parseResult.data;
    const setClauses = [];
    const params = [milestoneId, projectId];

    if (fields.title !== undefined) {
      params.push(fields.title);
      setClauses.push(`title = $${params.length}`);
    }
    if (fields.dueDate !== undefined) {
      params.push(fields.dueDate || null);
      setClauses.push(`due_date = $${params.length}`);
    }
    if (fields.isDone !== undefined) {
      params.push(fields.isDone);
      setClauses.push(`is_done = $${params.length}`);
    }

    if (setClauses.length === 0) {
      return next(new ValidationError('No fields to update'));
    }

    const sql = `UPDATE milestones SET ${setClauses.join(', ')} WHERE id = $1 AND project_id = $2 RETURNING *`;
    const result = await query(sql, params);

    if (result.rows.length === 0) {
      return next(new NotFoundError('Milestone not found'));
    }

    res.json({ milestone: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const deleteMilestone = async (req, res, next) => {
  try {
    const { id: projectId, milestoneId } = req.params;
    const result = await query(
      'DELETE FROM milestones WHERE id = $1 AND project_id = $2 RETURNING id',
      [milestoneId, projectId]
    );

    if (result.rows.length === 0) {
      return next(new NotFoundError('Milestone not found'));
    }

    res.json({ message: 'Milestone deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  updateProjectStatus,
  deleteProject,
  addMember,
  removeMember,
  createMilestone,
  updateMilestone,
  deleteMilestone,
};
