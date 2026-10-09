const jwt = require('jsonwebtoken');
const { UnauthorizedError, ForbiddenError } = require('./errors');
const { query } = require('./db');

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: JWT_SECRET environment variable is required in production');
}
const JWT_SECRET = process.env.JWT_SECRET || 'researchhub-dev-secret-change-in-production';

const roleHierarchy = {
  professor: 3,
  researcher: 2,
  student: 1,
};

const projectRoleHierarchy = {
  lead: 3,
  member: 2,
  viewer: 1,
};

const authenticateToken = (req, res, next) => {
  // 1. Check gateway forwarded headers
  const headerUserId = req.headers['x-user-id'];
  const headerUserRole = req.headers['x-user-role'];
  const headerUserName = req.headers['x-user-name'];

  if (headerUserId && headerUserRole) {
    req.user = {
      id: headerUserId,
      role: headerUserRole,
      name: headerUserName || '',
    };
    return next();
  }

  // 2. Check Authorization Bearer header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next(new UnauthorizedError('Authentication token missing'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.sub,
      role: decoded.role,
      name: decoded.name || '',
    };
    next();
  } catch (err) {
    return next(new UnauthorizedError('Invalid or expired token'));
  }
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('User unauthenticated'));
    }

    const userLevel = roleHierarchy[req.user.role] || 0;
    const requiredLevels = allowedRoles.map(r => roleHierarchy[r] || 99);
    const minRequiredLevel = Math.min(...requiredLevels);

    if (userLevel < minRequiredLevel && !allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError(`Requires one of the following roles: ${allowedRoles.join(', ')}`));
    }

    next();
  };
};

const requireProjectRole = (minProjectRole) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('User unauthenticated'));
    }

    const projectId = req.params.projectId || req.params.id || req.body.projectId;
    if (!projectId) {
      return next(new ForbiddenError('Project ID is required for access verification'));
    }

    // Professors bypass project role restrictions as system admins
    if (req.user.role === 'professor') {
      req.projectRole = 'lead';
      return next();
    }

    try {
      const res = await query(
        'SELECT project_role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, req.user.id]
      );

      if (res.rows.length === 0) {
        return next(new ForbiddenError('You are not a member of this project'));
      }

      const memberRole = res.rows[0].project_role;
      req.projectRole = memberRole;

      const userProjectLevel = projectRoleHierarchy[memberRole] || 0;
      const minRequiredLevel = projectRoleHierarchy[minProjectRole] || 99;

      if (userProjectLevel < minRequiredLevel) {
        return next(new ForbiddenError(`Minimum project role required: ${minProjectRole}`));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = {
  JWT_SECRET,
  authenticateToken,
  requireRole,
  requireProjectRole,
  roleHierarchy,
  projectRoleHierarchy,
};
