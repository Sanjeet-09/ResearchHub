const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const {
  query,
  JWT_SECRET,
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  logger,
} = require('@rh/shared');

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Valid email address is required').toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').trim().optional(),
  full_name: z.string().min(2, 'Full name must be at least 2 characters').trim().optional(),
}).refine(data => data.fullName || data.full_name, {
  message: 'Full name is required',
  path: ['fullName'],
});

const loginSchema = z.object({
  email: z.string().email('Valid email address is required').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

const roleSchema = z.object({
  role: z.enum(['professor', 'researcher', 'student'], {
    errorMap: () => ({ message: "Role must be 'professor', 'researcher', or 'student'" }),
  }),
});

/**
 * Register a new user with default 'student' role
 */
const register = async (req, res, next) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid input data';
      return next(new ValidationError(firstError, parseResult.error.errors));
    }

    const { email, password } = parseResult.data;
    const fullName = parseResult.data.fullName || parseResult.data.full_name;

    // Check if user with this email already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return next(new ConflictError('A user with this email address already exists'));
    }

    // Hash password with bcrypt cost 12
    const passwordHash = await bcrypt.hash(password, 12);

    // Default role is 'student' per specification
    const insertResult = await query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, 'student')
       RETURNING id, email, full_name, role, created_at, last_seen_at`,
      [email, passwordHash, fullName]
    );

    const user = insertResult.rows[0];

    // Issue JWT with 8 hours expiry
    const token = jwt.sign(
      { sub: user.id, role: user.role, name: user.full_name },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    logger.info({ userId: user.id, email: user.email }, 'User registered successfully');

    res.status(201).json({
      user,
      token,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Authenticate existing user
 */
const login = async (req, res, next) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid credentials format';
      return next(new ValidationError(firstError, parseResult.error.errors));
    }

    const { email, password } = parseResult.data;

    const result = await query(
      `SELECT id, email, password_hash, full_name, role, created_at, last_seen_at
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return next(new UnauthorizedError('No account found with this email. If this is your first time, please register first.', 'USER_NOT_FOUND'));
    }

    const user = result.rows[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return next(new UnauthorizedError('Incorrect password. Please verify your credentials and try again.', 'INVALID_PASSWORD'));
    }

    // Update last_seen_at
    await query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [user.id]);
    delete user.password_hash;

    const token = jwt.sign(
      { sub: user.id, role: user.role, name: user.full_name },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    logger.info({ userId: user.id, role: user.role }, 'User logged in successfully');

    res.json({
      user,
      token,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Return current authenticated user profile
 */
const getMe = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT id, email, full_name, role, created_at, last_seen_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return next(new NotFoundError('User profile not found'));
    }

    // Update last_seen_at
    await query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [userId]);

    res.json({
      user: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Search and list users
 */
const getUsers = async (req, res, next) => {
  try {
    const { q, role } = req.query;
    let sql = 'SELECT id, email, full_name, role, created_at, last_seen_at FROM users WHERE 1=1';
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (full_name ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }

    if (role) {
      params.push(role);
      sql += ` AND role = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC LIMIT 50';

    const result = await query(sql, params);
    res.json({
      users: result.rows,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update user role (Professor only)
 */
const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;

    const parseResult = roleSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid role';
      return next(new ValidationError(firstError, parseResult.error.errors));
    }

    const { role } = parseResult.data;

    const result = await query(
      `UPDATE users
       SET role = $1
       WHERE id = $2
       RETURNING id, email, full_name, role, created_at, last_seen_at`,
      [role, id]
    );

    if (result.rows.length === 0) {
      return next(new NotFoundError('Target user not found'));
    }

    logger.info({ targetUserId: id, newRole: role, updatedBy: req.user.id }, 'User role updated');

    res.json({
      user: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  getMe,
  getUsers,
  updateUserRole,
};
