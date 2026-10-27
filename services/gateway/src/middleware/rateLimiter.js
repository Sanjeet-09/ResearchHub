const rateLimit = require('express-rate-limit');

const skipProxyAndTest = (req) => {
  if (process.env.NODE_ENV === 'test') return true;
  const url = req.originalUrl || req.url || '';
  return url.includes('/proxy');
};

// General rate limiter across all gateway requests
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 700, // Limit each IP to requests per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipProxyAndTest,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again after 15 minutes',
    },
  },
});

// Stricter rate limiter on authentication endpoints per Section 4
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit auth attempts to 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (process.env.NODE_ENV === 'test') return true;
    const url = req.originalUrl || req.url || '';
    return url.includes('/proxy');
  },
  message: {
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again after 15 minutes',
    },
  },
});

const apiLimiter = generalLimiter;

module.exports = {
  generalLimiter,
  apiLimiter,
  authLimiter,
};

