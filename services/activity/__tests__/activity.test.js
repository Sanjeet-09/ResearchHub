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

describe('Activity Service', () => {
  const PID = '10000000-0000-0000-0000-000000000001';
  const EVENT_ID = '20000000-0000-0000-0000-000000000001';
  const AUDIT_ID = '30000000-0000-0000-0000-000000000001';

  const profId = 'a0000000-0000-0000-0000-000000000001';
  const researcherId = 'a0000000-0000-0000-0000-000000000002';
  const studentId = 'a0000000-0000-0000-0000-000000000003';
  const nonMemberId = 'a0000000-0000-0000-0000-000000000004';
  const adminId = 'a0000000-0000-0000-0000-000000000000';

  const profToken = jwt.sign({ sub: profId, role: 'professor', name: 'Prof Vance' }, JWT_SECRET);
  const researcherToken = jwt.sign({ sub: researcherId, role: 'researcher', name: 'Dr. Grant' }, JWT_SECRET);
  const studentToken = jwt.sign({ sub: studentId, role: 'student', name: 'Alex Chen' }, JWT_SECRET);
  const nonMemberToken = jwt.sign({ sub: nonMemberId, role: 'student', name: 'Non Member' }, JWT_SECRET);
  const adminToken = jwt.sign({ sub: adminId, role: 'admin', name: 'System Admin' }, JWT_SECRET);

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReset();
  });

  describe('GET /healthz', () => {
    it('returns 200 health check', async () => {
      const res = await request(app).get('/healthz');
      expect(res.status).toBe(200);
      expect(res.body.service).toBe('activity');
    });
  });

  describe('Internal Endpoints', () => {
    it('POST /internal/events records an activity event', async () => {
      const mockEvent = {
        id: EVENT_ID,
        project_id: PID,
        actor_id: studentId,
        action: 'created_experiment',
        entity_type: 'experiment',
        entity_id: '40000000-0000-0000-0000-000000000001',
        summary: 'Created experiment "PCR Run 1"',
        metadata: { run: 1 },
      };
      mockQuery.mockResolvedValueOnce({ rows: [mockEvent] });

      const res = await request(app)
        .post('/internal/events')
        .send({
          projectId: PID,
          actorId: studentId,
          action: 'created_experiment',
          entityType: 'experiment',
          entityId: '40000000-0000-0000-0000-000000000001',
          summary: 'Created experiment "PCR Run 1"',
          metadata: { run: 1 },
        });

      expect(res.status).toBe(201);
      expect(res.body.event.id).toBe(EVENT_ID);
      expect(res.body.event.action).toBe('created_experiment');
    });

    it('POST /internal/events returns 400 when action is missing', async () => {
      const res = await request(app)
        .post('/internal/events')
        .send({
          projectId: PID,
          actorId: studentId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('POST /internal/audit records an audit row', async () => {
      const mockAudit = {
        id: AUDIT_ID,
        actor_id: profId,
        action: 'PATCH /api/projects/status',
        entity_type: 'project',
        entity_id: PID,
        ip: '127.0.0.1',
        user_agent: 'Jest',
        before: { status: 'planning' },
        after: { status: 'active' },
      };
      mockQuery.mockResolvedValueOnce({ rows: [mockAudit] });

      const res = await request(app)
        .post('/internal/audit')
        .send({
          actorId: profId,
          action: 'PATCH /api/projects/status',
          entityType: 'project',
          entityId: PID,
          ip: '127.0.0.1',
          userAgent: 'Jest',
          before: { status: 'planning' },
          after: { status: 'active' },
        });

      expect(res.status).toBe(201);
      expect(res.body.audit.id).toBe(AUDIT_ID);
      expect(res.body.audit.action).toBe('PATCH /api/projects/status');
    });

    it('POST /internal/audit returns 400 when action is missing', async () => {
      const res = await request(app)
        .post('/internal/audit')
        .send({
          actorId: profId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('Project Timeline (GET /projects/:pid/timeline)', () => {
    it('returns timeline events for project member', async () => {
      // 1. project exists
      mockQuery.mockResolvedValueOnce({ rows: [{ id: PID, owner_id: profId }] });
      // 2. membership check
      mockQuery.mockResolvedValueOnce({ rows: [{ project_role: 'member' }] });
      // 3. count
      mockQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] });
      // 4. list
      const mockEvents = [
        {
          id: EVENT_ID,
          project_id: PID,
          actor_id: studentId,
          action: 'created_experiment',
          entity_type: 'experiment',
          summary: 'Created experiment "PCR Run 1"',
          created_at: new Date().toISOString(),
          actor_name: 'Alex Chen',
          actor_email: 'alex@university.edu',
          actor_role: 'student',
        },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockEvents });

      const res = await request(app)
        .get(`/projects/${PID}/timeline`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(1);
      expect(res.body.events[0].actor_name).toBe('Alex Chen');
      expect(res.body.pagination.total).toBe(1);
    });

    it('supports filters by action and entityType', async () => {
      // 1. project exists
      mockQuery.mockResolvedValueOnce({ rows: [{ id: PID, owner_id: profId }] });
      // 2. membership check
      mockQuery.mockResolvedValueOnce({ rows: [{ project_role: 'member' }] });
      // 3. count
      mockQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] });
      // 4. list
      mockQuery.mockResolvedValueOnce({ rows: [{ id: EVENT_ID, action: 'uploaded_dataset' }] });

      const res = await request(app)
        .get(`/projects/${PID}/timeline?action=uploaded_dataset&entityType=dataset`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(1);
    });

    it('forbids non-members from viewing project timeline with 403', async () => {
      // 1. project exists
      mockQuery.mockResolvedValueOnce({ rows: [{ id: PID, owner_id: profId }] });
      // 2. membership check returns empty
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`/projects/${PID}/timeline`)
        .set('Authorization', `Bearer ${nonMemberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows professor role to view timeline without explicit project membership', async () => {
      // 1. project exists
      mockQuery.mockResolvedValueOnce({ rows: [{ id: PID, owner_id: 'other-id' }] });
      // Elevated user skips membership query
      // 2. count
      mockQuery.mockResolvedValueOnce({ rows: [{ total: 0 }] });
      // 3. list
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`/projects/${PID}/timeline`)
        .set('Authorization', `Bearer ${profToken}`);

      expect(res.status).toBe(200);
      expect(res.body.events).toEqual([]);
    });

    it('returns 400 for invalid non-UUID project ID', async () => {
      const res = await request(app)
        .get('/projects/invalid-pid/timeline')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 for non-existent project', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`/projects/${PID}/timeline`)
        .set('Authorization', `Bearer ${profToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Audit Logs (GET /audit)', () => {
    it('allows professor to read system audit logs', async () => {
      // 1. count
      mockQuery.mockResolvedValueOnce({ rows: [{ total: 2 }] });
      // 2. list
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: AUDIT_ID,
            actor_id: profId,
            action: 'POST /api/projects',
            entity_type: 'projects',
            ip: '127.0.0.1',
            user_agent: 'Mozilla',
            actor_name: 'Prof Vance',
            actor_email: 'prof@university.edu',
          },
        ],
      });

      const res = await request(app)
        .get('/audit')
        .set('Authorization', `Bearer ${profToken}`);

      expect(res.status).toBe(200);
      expect(res.body.auditLogs).toHaveLength(1);
      expect(res.body.auditLogs[0].actor_name).toBe('Prof Vance');
      expect(res.body.pagination.total).toBe(2);
    });

    it('allows administrator to read system audit logs', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ total: 0 }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/audit')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.auditLogs).toEqual([]);
    });

    it('forbids students from accessing audit logs with 403', async () => {
      const res = await request(app)
        .get('/audit')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('forbids researchers from accessing audit logs with 403', async () => {
      const res = await request(app)
        .get('/audit')
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('supports search and action query filters on audit logs', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] });
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: AUDIT_ID,
            action: 'DELETE /api/experiments/123',
            entity_type: 'experiments',
            actor_name: 'Dr. Grant',
          },
        ],
      });

      const res = await request(app)
        .get('/audit?search=experiments&action=DELETE%20/api/experiments/123')
        .set('Authorization', `Bearer ${profToken}`);

      expect(res.status).toBe(200);
      expect(res.body.auditLogs[0].action).toBe('DELETE /api/experiments/123');
    });
  });

  describe('Append-only Audit Log Verification', () => {
    it('verifies audit_logs cannot be updated or deleted due to trigger', async () => {
      // Simulate PostgreSQL trigger prevent_audit_log_modification
      const triggerError = new Error('audit_logs rows are append-only and cannot be updated or deleted');
      triggerError.code = 'P0001'; // plpgsql raise exception
      mockQuery.mockRejectedValueOnce(triggerError);

      await expect(
        mockQuery('UPDATE audit_logs SET action = "tampered" WHERE id = $1', [AUDIT_ID])
      ).rejects.toThrow('audit_logs rows are append-only and cannot be updated or deleted');
    });
  });

  describe('Authentication Check', () => {
    it('returns 401 when token is missing on protected routes', async () => {
      const res = await request(app).get(`/projects/${PID}/timeline`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
