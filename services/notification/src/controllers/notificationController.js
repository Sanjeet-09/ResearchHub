const { z } = require('zod');
const { query, logger, ValidationError, NotFoundError } = require('@rh/shared');

const createNotificationSchema = z.object({
  userId: z.string().uuid().optional().nullable(),
  userIds: z.array(z.string().uuid()).optional().nullable(),
  type: z.string().min(1).max(50),
  title: z.string().min(1).max(255),
  body: z.string().optional().nullable(),
  link: z.string().optional().nullable(),
});

// POST /internal/notify
const recordNotification = async (req, res, next) => {
  try {
    const parsed = createNotificationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { userId, userIds, type, title, body, link } = parsed.data;

    const targets = [];
    if (userId) targets.push(userId);
    if (Array.isArray(userIds)) {
      userIds.forEach((id) => {
        if (!targets.includes(id)) targets.push(id);
      });
    }

    if (targets.length === 0) {
      throw new ValidationError('At least one userId or userIds must be provided');
    }

    const createdNotifications = [];
    for (const uid of targets) {
      const result = await query(
        `INSERT INTO notifications (user_id, type, title, body, link)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [uid, type, title, body || null, link || null]
      );
      createdNotifications.push(result.rows[0]);
    }

    logger.debug({ count: createdNotifications.length, type }, 'Notifications created');
    res.status(201).json({ notifications: createdNotifications });
  } catch (err) {
    next(err);
  }
};

// GET /notifications
const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { unreadOnly, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const where = ['user_id = $1'];
    const params = [userId];

    if (unreadOnly === 'true' || unreadOnly === '1') {
      where.push('is_read = FALSE');
    }

    const whereClause = where.join(' AND ');

    // Total unread count for user
    const unreadCountRes = await query(
      'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [userId]
    );
    const unreadCount = unreadCountRes.rows[0]?.count || 0;

    // Filtered total count
    const totalCountRes = await query(
      `SELECT COUNT(*)::int AS total FROM notifications WHERE ${whereClause}`,
      params
    );
    const total = totalCountRes.rows[0]?.total || 0;

    // Fetch notifications
    const listRes = await query(
      `SELECT * FROM notifications
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limitNum, offset]
    );

    res.json({
      notifications: listRes.rows,
      unreadCount,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /notifications/:id/read
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
      throw new ValidationError('Valid notification UUID required');
    }

    const result = await query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Notification not found');
    }

    res.json({ notification: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// POST /notifications/read-all
const markAllAsRead = async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE user_id = $1 AND is_read = FALSE
       RETURNING id`,
      [req.user.id]
    );

    res.json({
      updatedCount: result.rows.length,
      message: 'All notifications marked as read',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  recordNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
};
