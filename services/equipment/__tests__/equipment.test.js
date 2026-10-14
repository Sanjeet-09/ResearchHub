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

describe('Equipment Service', () => {
  const EQ_ID = '11111111-1111-1111-1111-111111111111';
  const RES_ID = '22222222-2222-2222-2222-222222222222';
  const PROJ_ID = '33333333-3333-3333-3333-333333333333';

  const profId = 'a0000000-0000-0000-0000-000000000001';
  const researcherId = 'a0000000-0000-0000-0000-000000000002';
  const studentId = 'a0000000-0000-0000-0000-000000000003';
  const otherStudentId = 'a0000000-0000-0000-0000-000000000004';

  const profToken = jwt.sign({ sub: profId, role: 'professor', name: 'Prof. Vance' }, JWT_SECRET);
  const researcherToken = jwt.sign({ sub: researcherId, role: 'researcher', name: 'Dr. Grant' }, JWT_SECRET);
  const studentToken = jwt.sign({ sub: studentId, role: 'student', name: 'Alex Chen' }, JWT_SECRET);
  const otherStudentToken = jwt.sign({ sub: otherStudentId, role: 'student', name: 'Other Student' }, JWT_SECRET);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Health check
  describe('GET /healthz', () => {
    it('returns 200 health check', async () => {
      const res = await request(app).get('/healthz');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('equipment-service');
    });
  });

  // 2. Equipment Catalogue CRUD
  describe('Equipment Catalogue', () => {
    it('GET /equipment returns list of equipment', async () => {
      const mockEquipment = [
        { id: EQ_ID, name: 'SEM-500 Microscope', description: 'Electron microscope', location: 'Lab 101', is_active: true },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockEquipment });

      const res = await request(app)
        .get('/equipment')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.equipment).toHaveLength(1);
      expect(res.body.equipment[0].name).toBe('SEM-500 Microscope');
    });

    it('POST /equipment allows professor to create equipment', async () => {
      const newEq = {
        id: EQ_ID,
        name: 'Confocal Microscope',
        description: 'Laser scanning',
        location: 'Room 204',
        is_active: true,
      };
      mockQuery.mockResolvedValueOnce({ rows: [newEq] });

      const res = await request(app)
        .post('/equipment')
        .set('Authorization', `Bearer ${profToken}`)
        .send({
          name: 'Confocal Microscope',
          description: 'Laser scanning',
          location: 'Room 204',
        });

      expect(res.status).toBe(201);
      expect(res.body.equipment.name).toBe('Confocal Microscope');
    });

    it('POST /equipment forbids student from creating equipment', async () => {
      const res = await request(app)
        .post('/equipment')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ name: 'Unauthorized Equipment' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('POST /equipment forbids researcher from creating equipment', async () => {
      const res = await request(app)
        .post('/equipment')
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({ name: 'Unauthorized Equipment' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('POST /equipment returns 400 when name is missing', async () => {
      const res = await request(app)
        .post('/equipment')
        .set('Authorization', `Bearer ${profToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('GET /equipment/:id returns equipment details', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: EQ_ID, name: 'SEM-500', is_active: true }],
      });

      const res = await request(app)
        .get(`/equipment/${EQ_ID}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.equipment.id).toBe(EQ_ID);
    });

    it('GET /equipment/:id returns 404 for non-existent equipment', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`/equipment/${EQ_ID}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('PATCH /equipment/:id allows professor to update equipment', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: EQ_ID, name: 'Old Name', is_active: true }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ id: EQ_ID, name: 'Updated Name', is_active: false }] });

      const res = await request(app)
        .patch(`/equipment/${EQ_ID}`)
        .set('Authorization', `Bearer ${profToken}`)
        .send({ name: 'Updated Name', isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.equipment.name).toBe('Updated Name');
      expect(res.body.equipment.is_active).toBe(false);
    });

    it('PATCH /equipment/:id forbids student from updating equipment', async () => {
      const res = await request(app)
        .patch(`/equipment/${EQ_ID}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(403);
    });

    it('DELETE /equipment/:id allows professor to delete equipment', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: EQ_ID }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .delete(`/equipment/${EQ_ID}`)
        .set('Authorization', `Bearer ${profToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted successfully');
    });

    it('DELETE /equipment/:id forbids student from deleting equipment', async () => {
      const res = await request(app)
        .delete(`/equipment/${EQ_ID}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });

  // 3. Weekly Calendar
  describe('Weekly Calendar', () => {
    it('GET /equipment/:id/calendar returns booked reservations', async () => {
      const mockCalendarRows = [
        {
          id: RES_ID,
          equipment_id: EQ_ID,
          start_time: '2026-10-15T09:00:00.000Z',
          end_time: '2026-10-15T11:00:00.000Z',
          status: 'booked',
          user_name: 'Alex Chen',
          user_email: 'student@university.edu',
          project_title: 'Bio Project',
        },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockCalendarRows });

      const res = await request(app)
        .get(`/equipment/${EQ_ID}/calendar?from=2026-10-12T00:00:00.000Z&to=2026-10-18T23:59:59.000Z`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.equipmentId).toBe(EQ_ID);
      expect(res.body.reservations).toHaveLength(1);
      expect(res.body.reservations[0].user_name).toBe('Alex Chen');
    });
  });

  // 4. Reservations & Overlap Prevention (409 Conflict)
  describe('Reservations', () => {
    it('POST /reservations creates a valid booking for student or researcher', async () => {
      // 1. check equipment exists and is active
      mockQuery.mockResolvedValueOnce({ rows: [{ id: EQ_ID, name: 'SEM-500', is_active: true }] });
      // 2. check overlap (none)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // 3. insert reservation
      const newRes = {
        id: RES_ID,
        equipment_id: EQ_ID,
        user_id: studentId,
        project_id: PROJ_ID,
        start_time: '2026-10-15T10:00:00.000Z',
        end_time: '2026-10-15T12:00:00.000Z',
        status: 'booked',
      };
      mockQuery.mockResolvedValueOnce({ rows: [newRes] });

      const res = await request(app)
        .post('/reservations')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          equipmentId: EQ_ID,
          startTime: '2026-10-15T10:00:00.000Z',
          endTime: '2026-10-15T12:00:00.000Z',
          projectId: PROJ_ID,
        });

      expect(res.status).toBe(201);
      expect(res.body.reservation.id).toBe(RES_ID);
      expect(res.body.reservation.status).toBe('booked');
    });

    it('POST /reservations returns 409 Conflict when time slot overlaps with an existing booking', async () => {
      // 1. equipment active
      mockQuery.mockResolvedValueOnce({ rows: [{ id: EQ_ID, name: 'SEM-500', is_active: true }] });
      // 2. overlap found!
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'existing-res-id', start_time: '2026-10-15T10:00:00.000Z', end_time: '2026-10-15T12:00:00.000Z' }],
      });

      const res = await request(app)
        .post('/reservations')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          equipmentId: EQ_ID,
          startTime: '2026-10-15T11:00:00.000Z',
          endTime: '2026-10-15T13:00:00.000Z',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('already booked for the selected time window');
    });

    it('POST /reservations catches PostgreSQL exclusion constraint 23P01 and returns 409 Conflict', async () => {
      // 1. equipment active
      mockQuery.mockResolvedValueOnce({ rows: [{ id: EQ_ID, name: 'SEM-500', is_active: true }] });
      // 2. overlap check race condition simulated (passed app check)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // 3. insert throws 23P01 exclusion violation
      const exclusionError = new Error('conflicting key value violates exclusion constraint');
      exclusionError.code = '23P01';
      mockQuery.mockRejectedValueOnce(exclusionError);

      const res = await request(app)
        .post('/reservations')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          equipmentId: EQ_ID,
          startTime: '2026-10-15T10:00:00.000Z',
          endTime: '2026-10-15T12:00:00.000Z',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('already booked');
    });

    it('POST /reservations returns 400 when end time is before or equal to start time', async () => {
      const res = await request(app)
        .post('/reservations')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          equipmentId: EQ_ID,
          startTime: '2026-10-15T12:00:00.000Z',
          endTime: '2026-10-15T10:00:00.000Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('End time must be after start time');
    });

    it('POST /reservations returns 400 when equipment is inactive', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: EQ_ID, name: 'SEM-500', is_active: false }] });

      const res = await request(app)
        .post('/reservations')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          equipmentId: EQ_ID,
          startTime: '2026-10-15T10:00:00.000Z',
          endTime: '2026-10-15T12:00:00.000Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('inactive or under maintenance');
    });

    it('GET /reservations/mine returns current user reservations', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: RES_ID,
            equipment_id: EQ_ID,
            user_id: studentId,
            start_time: '2026-10-15T10:00:00.000Z',
            end_time: '2026-10-15T12:00:00.000Z',
            status: 'booked',
            equipment_name: 'SEM-500',
            equipment_location: 'Lab 101',
          },
        ],
      });

      const res = await request(app)
        .get('/reservations/mine')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.reservations).toHaveLength(1);
      expect(res.body.reservations[0].equipment_name).toBe('SEM-500');
    });

    it('GET /reservations/history returns booking history with pagination', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: RES_ID,
            equipment_name: 'SEM-500',
            user_name: 'Alex Chen',
            status: 'booked',
          },
        ],
      });
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '1' }] });

      const res = await request(app)
        .get('/reservations/history?page=1&limit=10')
        .set('Authorization', `Bearer ${profToken}`);

      expect(res.status).toBe(200);
      expect(res.body.reservations).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('PATCH /reservations/:id/cancel allows owner to cancel booking', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: RES_ID, user_id: studentId, status: 'booked' }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: RES_ID, user_id: studentId, status: 'cancelled' }],
      });

      const res = await request(app)
        .patch(`/reservations/${RES_ID}/cancel`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('cancelled successfully');
      expect(res.body.reservation.status).toBe('cancelled');
    });

    it('PATCH /reservations/:id/cancel forbids non-owner student from cancelling', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: RES_ID, user_id: studentId, status: 'booked' }],
      });

      const res = await request(app)
        .patch(`/reservations/${RES_ID}/cancel`)
        .set('Authorization', `Bearer ${otherStudentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('PATCH /reservations/:id/cancel allows professor to cancel any booking', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: RES_ID, user_id: studentId, status: 'booked' }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: RES_ID, user_id: studentId, status: 'cancelled' }],
      });

      const res = await request(app)
        .patch(`/reservations/${RES_ID}/cancel`)
        .set('Authorization', `Bearer ${profToken}`);

      expect(res.status).toBe(200);
      expect(res.body.reservation.status).toBe('cancelled');
    });
  });

  // 5. Auth validation
  describe('Authentication and Validation', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/equipment');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 400 for invalid non-UUID id', async () => {
      const res = await request(app)
        .get('/equipment/not-a-uuid')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
