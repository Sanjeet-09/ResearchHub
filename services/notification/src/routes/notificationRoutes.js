const express = require('express');
const { authenticateToken } = require('@rh/shared');
const {
  recordNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
} = require('../controllers/notificationController');

const router = express.Router();

// Internal service endpoint (fire-and-forget from services)
router.post('/internal/notify', recordNotification);

// User notification endpoints
router.get('/notifications', authenticateToken, getNotifications);
router.patch('/notifications/:id/read', authenticateToken, markAsRead);
router.post('/notifications/read-all', authenticateToken, markAllAsRead);

module.exports = router;
