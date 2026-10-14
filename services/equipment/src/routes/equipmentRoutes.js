const express = require('express');
const {
  authenticateToken,
  requireRole,
} = require('@rh/shared');

const {
  getEquipment,
  getEquipmentById,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  getCalendar,
  createReservation,
  getMyReservations,
  getReservationHistory,
  cancelReservation,
} = require('../controllers/equipmentController');

const router = express.Router();

router.use(authenticateToken);

// ── Equipment Catalogue (CRUD) ───────────────────────────────────────────────
router.get('/equipment', getEquipment);
router.get('/equipment/:id', getEquipmentById);
router.post('/equipment', requireRole('professor'), createEquipment);
router.patch('/equipment/:id', requireRole('professor'), updateEquipment);
router.delete('/equipment/:id', requireRole('professor'), deleteEquipment);

// ── Weekly Calendar & Availability ───────────────────────────────────────────
router.get('/equipment/:id/calendar', getCalendar);

// ── Reservations (Booking, My Reservations, History, Cancel) ─────────────────
router.post('/reservations', createReservation);
router.get('/reservations/mine', getMyReservations);
router.get('/reservations/history', getReservationHistory);
router.patch('/reservations/:id/cancel', cancelReservation);
router.delete('/reservations/:id', cancelReservation);

module.exports = router;
