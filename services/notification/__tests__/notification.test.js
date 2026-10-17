const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockQuery = jest.fn();

jest.mock('@rh/shared', () => {
  const original = jest.requireActual('@rh/shared');
  return {
    ...original,
    query: mockQuery,
  };
});

jest.mock('@rh/shared/src/db', () => ({
  query: mockQuery,
  pool: {},
}));

const { JWT_SECRET } = require('@rh/shared');
const app = require('../src/app');

describe('Notification Service', () => {
  const NOTIF_ID = '10000000-0000-0000-0000-000000000001';
  const userId = 'a0000000-0000-0000-0000-000000000003';
  const userToken = jwt.sign({ sub: userId, role: 'student', name: 'Alex Chen' }, JWT_SECRET);

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReset();
  });

  describe('GET /healthz', () => {
    it('returns 200 health check', async () => {
      const res = await request(app).get('/healthz');
      expect(res.status).toBe(200);
      expect(res.body.service).toBe('notification');
    });
  });

  describe('POST /internal/notify', () => {
    it('creates a single notification', async () => {
      const mockNotif = {
        id: NOTIF_ID,
        user_id: userId,
        type: 'reservation_confirmed',
        title: 'Reservation Confirmed',
        body: 'SEM-500 booking confirmed',
        link: '/equipment',
        is_read: false,
      };
      mockQuery.mockResolvedValueOnce({ rows: [mockNotif] });

      const res = await request(app)
        .post('/internal/notify')
        .send({
          userId,
          type: 'reservation_confirmed',
          title: 'Reservation Confirmed',
          body: 'SEM-500 booking confirmed',
          link: '/equipment',
        });

      expect(res.status).toBe(201);
      expect(res.body.notifications).toHaveLength(1);
      expect(res.body.notifications[0].title).toBe('Reservation Confirmed');
    });

    it('creates batch notifications for multiple userIds', async () => {
      const u1 = 'a0000000-0000-0000-0000-000000000001';
      const u2 = 'a0000000-0000-0000-0000-000000000002';

      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'n1', user_id: u1 }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'n2', user_id: u2 }] });

      const res = await request(app)
        .post('/internal/notify')
        .send({
          userIds: [u1, u2],
          type: 'dataset_updated',
          title: 'New Dataset Version',
          body: 'Version v2 uploaded',
        });

      expect(res.status).toBe(201);
      expect(res.body.notifications).toHaveLength(2);
    });

    it('returns 400 when neither userId nor userIds is provided', async () => {
      const res = await request(app)
        .post('/internal/notify')
        .send({
          type: 'system',
          title: 'Alert',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('User Endpoints', () => {
    it('GET /notifications returns user notifications and unread count', async () => {
      // 1. unread count
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 3 }] });
      // 2. total count
      mockQuery.mockResolvedValueOnce({ rows: [{ total: 5 }] });
      // 3. list
      const mockList = [
        {
          id: NOTIF_ID,
          user_id: userId,
          type: 'project_added',
          title: 'Added to Project',
          body: 'You are now a member',
          is_read: false,
          created_at: new Date().toISOString(),
        },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockList });

      const res = await request(app)
        .get('/notifications')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(1);
      expect(res.body.unreadCount).toBe(3);
      expect(res.body.pagination.total).toBe(5);
    });

    it('GET /notifications?unreadOnly=true filters by is_read = false', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ id: NOTIF_ID, is_read: false }] });

      const res = await request(app)
        .get('/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(1);
    });

    it('PATCH /notifications/:id/read marks notification as read', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: NOTIF_ID, user_id: userId, is_read: true }],
      });

      const res = await request(app)
        .patch(`/notifications/${NOTIF_ID}/read`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.notification.is_read).toBe(true);
    });

    it('PATCH /notifications/:id/read returns 404 for non-existent notification', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .patch(`/notifications/${NOTIF_ID}/read`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('PATCH /notifications/:id/read returns 400 for invalid non-UUID ID', async () => {
      const res = await request(app)
        .patch('/notifications/invalid-id/read')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /notifications/read-all marks all unread notifications as read', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: NOTIF_ID }, { id: '20000000-0000-0000-0000-000000000002' }],
      });

      const res = await request(app)
        .post('/notifications/read-all')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.updatedCount).toBe(2);
      expect(res.body.message).toContain('marked as read');
    });

    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/notifications');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
