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
} = require('../controllers/authController');

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/me', authenticateToken, getMe);
router.get('/users', authenticateToken, getUsers);
router.patch('/users/:id/role', authenticateToken, requireRole('professor'), updateUserRole);

module.exports = router;
