const express = require('express');
const {
  authenticateToken,
  requireRole,
} = require('@rh/shared');
const {
  register,
  login,
  getMe,
  getUsers,
  updateUserRole,
  updateUserRoleStatus,
} = require('../controllers/authController');

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/me', authenticateToken, getMe);
router.get('/users', authenticateToken, requireRole('admin'), getUsers);
router.patch('/users/:id/role', authenticateToken, requireRole('admin'), updateUserRole);
router.patch('/users/:id/status', authenticateToken, requireRole('admin'), updateUserRoleStatus);

module.exports = router;
