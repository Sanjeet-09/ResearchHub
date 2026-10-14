const jwt = require('jsonwebtoken');
const { JWT_SECRET, UnauthorizedError } = require('@rh/shared');

const PUBLIC_PATHS = [
  '/healthz',
  '/auth/login',
  '/auth/register',
  '/api/auth/login',
  '/api/auth/register',
  '/storage/upload',
  '/storage/download',
  '/api/storage/upload',
  '/api/storage/download',
];

const gatewayAuthMiddleware = (req, res, next) => {
  // 1. Allow public endpoints without authentication
  const currentPath = req.path;
  const originalPath = req.originalUrl ? req.originalUrl.split('?')[0] : '';

  const isPublic = PUBLIC_PATHS.some(
    publicPath => currentPath === publicPath || originalPath === publicPath
  );

  if (isPublic) {
    return next();
  }

  // Allow pre-flight OPTIONS requests
  if (req.method === 'OPTIONS') {
    return next();
  }

  // 2. Check Authorization Bearer header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.sub,
      role: decoded.role,
      name: decoded.name || '',
    };

    // Forward trust headers to downstream microservices per spec Section 4
    req.headers['x-user-id'] = decoded.sub;
    req.headers['x-user-role'] = decoded.role;
    req.headers['x-user-name'] = encodeURIComponent(decoded.name || '');

    next();
  } catch (err) {
    return next(new UnauthorizedError('Invalid or expired authentication token'));
  }
};

module.exports = gatewayAuthMiddleware;
