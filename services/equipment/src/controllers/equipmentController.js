const { z } = require('zod');
const {
  query,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  logger,
  emitNotification,
  emitActivityEvent,
} = require('@rh/shared');

const uuidSchema = z.string().uuid('Invalid UUID format');

const createEquipmentSchema = z.object({
  name: z.string().min(1, 'Equipment name is required').max(255),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

const updateEquipmentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const createReservationSchema = z.object({
  equipmentId: z.string().uuid('Invalid equipment ID'),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Valid start time ISO string required',
  }),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Valid end time ISO string required',
  }),
  projectId: z.string().uuid().optional().nullable(),
});

// ─── Equipment Catalogue CRUD ────────────────────────────────────────────────

// GET /equipment
const getEquipment = async (req, res, next) => {
  try {
    const { isActive, search } = req.query;
    const params = [];
    let whereClauses = [];

    if (isActive !== undefined) {
      params.push(isActive === 'true' || isActive === true);
      whereClauses.push(`is_active = $${params.length}`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      whereClauses.push(`(name ILIKE $${params.length} OR location ILIKE $${params.length})`);
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const result = await query(
      `SELECT id, name, description, location, is_active
       FROM equipment
       ${whereSQL}
       ORDER BY name ASC`,
      params
    );

    res.json({ equipment: result.rows });
  } catch (err) {
    next(err);
  }
};

// GET /equipment/:id
const getEquipmentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid equipment ID format');
    }

    const result = await query(
      `SELECT id, name, description, location, is_active
       FROM equipment
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Equipment not found');
    }

    res.json({ equipment: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// POST /equipment (Professor / Admin only)
const createEquipment = async (req, res, next) => {
  try {
    const parsed = createEquipmentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { name, description, location, isActive } = parsed.data;
    const result = await query(
      `INSERT INTO equipment (name, description, location, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, description || null, location || null, isActive]
    );

    const created = result.rows[0];
    logger.info({ equipmentId: created.id, name: created.name }, 'Equipment created');
    res.status(201).json({ equipment: created });
  } catch (err) {
    next(err);
  }
};

// PATCH /equipment/:id (Professor / Admin only)
const updateEquipment = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid equipment ID format');
    }

    const parsed = updateEquipmentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const existing = await query('SELECT * FROM equipment WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new NotFoundError('Equipment not found');
    }

    const current = existing.rows[0];
    const {
      name = current.name,
      description = current.description,
      location = current.location,
      isActive = current.is_active,
    } = parsed.data;

    const result = await query(
      `UPDATE equipment
       SET name = $1, description = $2, location = $3, is_active = $4
       WHERE id = $5
       RETURNING *`,
      [name, description, location, isActive, id]
    );

    logger.info({ equipmentId: id }, 'Equipment updated');
    res.json({ equipment: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// DELETE /equipment/:id (Professor / Admin only)
const deleteEquipment = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid equipment ID format');
    }

    const existing = await query('SELECT id FROM equipment WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new NotFoundError('Equipment not found');
    }

    await query('DELETE FROM equipment WHERE id = $1', [id]);
    logger.info({ equipmentId: id }, 'Equipment deleted');

    res.json({ message: 'Equipment deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── Weekly Calendar & Availability ──────────────────────────────────────────

// GET /equipment/:id/calendar?from=&to=
const getCalendar = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid equipment ID format');
    }

    let { from, to } = req.query;

    // Default to current week (Monday 00:00 to Sunday 23:59:59) if omitted
    if (!from || !to) {
      const now = new Date();
      const day = now.getDay();
      const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diffToMonday));
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      from = from || monday.toISOString();
      to = to || sunday.toISOString();
    }

    const result = await query(
      `SELECT
         r.id,
         r.equipment_id,
         r.user_id,
         r.project_id,
         r.start_time,
         r.end_time,
         r.status,
         u.full_name AS user_name,
         u.email AS user_email,
         p.title AS project_title
       FROM reservations r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN projects p ON r.project_id = p.id
       WHERE r.equipment_id = $1
         AND r.status = 'booked'
         AND r.end_time > $2
         AND r.start_time < $3
       ORDER BY r.start_time ASC`,
      [id, from, to]
    );

    res.json({
      equipmentId: id,
      from,
      to,
      reservations: result.rows,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Reservations CRUD ───────────────────────────────────────────────────────

// POST /reservations
const createReservation = async (req, res, next) => {
  try {
    const parsed = createReservationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { equipmentId, startTime, endTime, projectId } = parsed.data;

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) {
      throw new ValidationError('End time must be after start time');
    }

    const now = new Date();
    // Allow a 2-minute buffer for request latency / slight clock drift
    if (end <= now || start < new Date(now.getTime() - 2 * 60 * 1000)) {
      throw new ValidationError('Cannot book a reservation in the past. Please select a future time slot.');
    }

    // Check equipment exists and is active
    const eqRes = await query('SELECT id, name, is_active FROM equipment WHERE id = $1', [equipmentId]);
    if (eqRes.rows.length === 0) {
      throw new NotFoundError('Equipment not found');
    }

    if (!eqRes.rows[0].is_active) {
      throw new ValidationError('Equipment is currently inactive or under maintenance');
    }

    // Explicit check for overlapping bookings for clean error messaging
    const overlapRes = await query(
      `SELECT id, start_time, end_time FROM reservations
       WHERE equipment_id = $1
         AND status = 'booked'
         AND tstzrange(start_time, end_time) && tstzrange($2::timestamptz, $3::timestamptz)`,
      [equipmentId, start.toISOString(), end.toISOString()]
    );

    if (overlapRes.rows.length > 0) {
      throw new ConflictError(
        'This equipment is already booked for the selected time window. Please choose another time.'
      );
    }

    try {
      const dbRes = await query(
        `INSERT INTO reservations (equipment_id, user_id, project_id, start_time, end_time, status)
         VALUES ($1, $2, $3, $4, $5, 'booked')
         RETURNING *`,
        [equipmentId, req.user.id, projectId || null, start.toISOString(), end.toISOString()]
      );

      const reservation = dbRes.rows[0];
      logger.info({ reservationId: reservation.id, equipmentId, userId: req.user.id }, 'Reservation created');

      emitNotification({
        userId: req.user.id,
        type: 'reservation_confirmed',
        title: 'Reservation Confirmed',
        body: `Your reservation for "${eqRes.rows[0].name}" has been confirmed.`,
        link: '/equipment',
      });

      if (projectId) {
        emitActivityEvent({
          projectId,
          actorId: req.user.id,
          action: 'reserved_equipment',
          entityType: 'equipment',
          entityId: equipmentId,
          summary: `Reserved equipment "${eqRes.rows[0].name}"`,
          metadata: { reservationId: reservation.id, startTime: start.toISOString(), endTime: end.toISOString() },
        });
      }

      res.status(201).json({ reservation });
    } catch (insertErr) {
      // Catch exclusion constraint error (23P01) from PostgreSQL
      if (insertErr.code === '23P01' || (insertErr.message && insertErr.message.includes('exclusion'))) {
        throw new ConflictError(
          'This equipment is already booked for the selected time window. Please choose another time.'
        );
      }
      throw insertErr;
    }
  } catch (err) {
    next(err);
  }
};

// GET /reservations/mine
const getMyReservations = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         r.id,
         r.equipment_id,
         r.user_id,
         r.project_id,
         r.start_time,
         r.end_time,
         r.status,
         e.name AS equipment_name,
         e.location AS equipment_location,
         p.title AS project_title
       FROM reservations r
       JOIN equipment e ON r.equipment_id = e.id
       LEFT JOIN projects p ON r.project_id = p.id
       WHERE r.user_id = $1
       ORDER BY r.start_time DESC`,
      [req.user.id]
    );

    res.json({ reservations: result.rows });
  } catch (err) {
    next(err);
  }
};

// GET /reservations/history
const getReservationHistory = async (req, res, next) => {
  try {
    const { equipmentId, projectId, status, page = 1, limit = 50 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const params = [];
    const whereClauses = [];

    if (equipmentId) {
      params.push(equipmentId);
      whereClauses.push(`r.equipment_id = $${params.length}`);
    }

    if (projectId) {
      params.push(projectId);
      whereClauses.push(`r.project_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      whereClauses.push(`r.status = $${params.length}`);
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    params.push(parseInt(limit), offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    const result = await query(
      `SELECT
         r.id,
         r.equipment_id,
         r.user_id,
         r.project_id,
         r.start_time,
         r.end_time,
         r.status,
         e.name AS equipment_name,
         e.location AS equipment_location,
         u.full_name AS user_name,
         u.email AS user_email,
         p.title AS project_title
       FROM reservations r
       JOIN equipment e ON r.equipment_id = e.id
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN projects p ON r.project_id = p.id
       ${whereSQL}
       ORDER BY r.start_time DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    const countRes = await query(
      `SELECT COUNT(*) AS total FROM reservations r ${whereSQL}`,
      params.slice(0, whereClauses.length)
    );

    res.json({
      reservations: result.rows,
      total: parseInt(countRes.rows[0]?.total || 0),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /reservations/:id/cancel
const cancelReservation = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      throw new ValidationError('Invalid reservation ID format');
    }

    const existing = await query('SELECT * FROM reservations WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new NotFoundError('Reservation not found');
    }

    const reservation = existing.rows[0];

    // Only owner of reservation OR Professor/Admin can cancel
    const isOwner = req.user.id === reservation.user_id;
    const isProfOrAdmin = req.user.role === 'professor' || req.user.role === 'admin';

    if (!isOwner && !isProfOrAdmin) {
      throw new ForbiddenError('You can only cancel your own reservations');
    }

    const updated = await query(
      `UPDATE reservations
       SET status = 'cancelled'
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    logger.info({ reservationId: id, cancelledBy: req.user.id }, 'Reservation cancelled');

    emitNotification({
      userId: reservation.user_id,
      type: 'reservation_cancelled',
      title: 'Reservation Cancelled',
      body: 'Your laboratory reservation has been cancelled.',
      link: '/equipment',
    });

    if (reservation.project_id) {
      emitActivityEvent({
        projectId: reservation.project_id,
        actorId: req.user.id,
        action: 'cancelled_equipment_reservation',
        entityType: 'equipment',
        entityId: reservation.equipment_id,
        summary: 'Cancelled equipment reservation',
        metadata: { reservationId: id },
      });
    }

    res.json({
      message: 'Reservation cancelled successfully',
      reservation: updated.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
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
};
