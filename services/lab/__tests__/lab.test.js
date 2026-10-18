'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockQuery = jest.fn();
const mockClient = {
  query: mockQuery,
  release: jest.fn(),
};
const mockPool = {
  query: mockQuery,
  connect: jest.fn().mockResolvedValue(mockClient),
};

const mockDriver = {
  create: jest.fn().mockResolvedValue({
    containerName: 'lab-12345678',
    port: 8901,
    url: 'http://localhost:8901',
  }),
  deleteContainer: jest.fn().mockResolvedValue(true),
  status: jest.fn().mockResolvedValue('running'),
  list: jest.fn().mockResolvedValue([]),
  waitForJupyter: jest.fn().mockResolvedValue(true),
  checkpoint: jest.fn().mockResolvedValue(true),
  areAllKernelsIdle: jest.fn().mockResolvedValue(false),
  ensureWorkspaceDir: jest.fn().mockReturnValue('/tmp/workspace'),
  getWorkspacePath: jest.fn().mockReturnValue('/tmp/workspace'),
  workspaceExists: jest.fn().mockReturnValue(true),
  deleteWorkspace: jest.fn().mockReturnValue(true),
};

jest.mock('@rh/shared', () => {
  const original = jest.requireActual('@rh/shared');
  return {
    ...original,
    pool: mockPool,
    query: mockQuery,
    emitActivityEvent: jest.fn(),
    emitNotification: jest.fn(),
  };
});

jest.mock('../src/drivers', () => ({
  getDriver: () => mockDriver,
}));

const { JWT_SECRET } = require('@rh/shared');
const app = require('../src/app');

describe('Lab Service (Phase 9 — Testing Environment & Pause/Resume/Stop)', () => {
  const PROJ_ID = '11111111-1111-1111-1111-111111111111';
  const SESSION_ID = '22222222-2222-2222-2222-222222222222';
  const PROFILE_CPU_ID = 'b0000000-0000-0000-0000-000000000001';
  const PROFILE_GPU_ID = 'b0000000-0000-0000-0000-000000000004';

  const profId = 'a0000000-0000-0000-0000-000000000001';
  const researcherId = 'a0000000-0000-0000-0000-000000000002';
  const studentId = 'a0000000-0000-0000-0000-000000000003';
  const otherStudentId = 'a0000000-0000-0000-0000-000000000004';

  const profToken = jwt.sign({ sub: profId, role: 'professor', name: 'Prof Vance' }, JWT_SECRET);
  const researcherToken = jwt.sign({ sub: researcherId, role: 'researcher', name: 'Dr. Grant' }, JWT_SECRET);
  const studentToken = jwt.sign({ sub: studentId, role: 'student', name: 'Alex Chen' }, JWT_SECRET);
  const otherStudentToken = jwt.sign({ sub: otherStudentId, role: 'student', name: 'Other Student' }, JWT_SECRET);

  const sampleProfiles = [
    { id: PROFILE_CPU_ID, key: 'basic-cpu', name: 'Basic', category: 'general', cpu: '1 vCPU', memory_gb: 2, gpu_type: null, gpu_count: 0, is_active: true, sort_order: 1, max_hours: 2, est_cost_per_hour: 0.05 },
    { id: 'b0000000-0000-0000-0000-000000000002', key: 'standard-cpu', name: 'Standard', category: 'general', cpu: '2 vCPU', memory_gb: 8, gpu_type: null, gpu_count: 0, is_active: true, sort_order: 2, max_hours: 2, est_cost_per_hour: 0.10 },
    { id: 'b0000000-0000-0000-0000-000000000003', key: 'highmem-cpu', name: 'High-Memory Data', category: 'general', cpu: '4 vCPU', memory_gb: 16, gpu_type: null, gpu_count: 0, is_active: true, sort_order: 3, max_hours: 2, est_cost_per_hour: 0.20 },
    { id: PROFILE_GPU_ID, key: 'ml-gpu', name: 'AI/ML — GPU', category: 'ai_ml', cpu: '4 vCPU', memory_gb: 16, gpu_type: 'NVIDIA L4', gpu_count: 1, is_active: false, sort_order: 4, max_hours: 1, est_cost_per_hour: 0.70 },
    { id: 'b0000000-0000-0000-0000-000000000005', key: 'dl-gpu-large', name: 'AI/ML — Deep Learning / LLM', category: 'ai_ml', cpu: '8 vCPU', memory_gb: 32, gpu_type: 'NVIDIA L4', gpu_count: 1, is_active: false, sort_order: 5, max_hours: 1, est_cost_per_hour: 1.20 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReset();
    process.env.ENABLE_GPU_LABS = 'false';
    process.env.MAX_CONCURRENT_LABS = '2';
    process.env.LAB_MONTHLY_BUDGET_USD = '8';
  });

  // 1. Healthcheck
  describe('GET /healthz', () => {
    it('returns 200 healthcheck with driver info', async () => {
      const res = await request(app).get('/healthz');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('lab');
      expect(res.body.driver).toBe('local');
    });
  });

  // 2. Profiles endpoint
  describe('GET /lab/profiles', () => {
    it('returns the 5 configurations with GPU cards marked available on request when disabled', async () => {
      mockQuery.mockResolvedValueOnce({ rows: sampleProfiles });

      const res = await request(app)
        .get('/lab/profiles')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.profiles).toHaveLength(5);

      const basic = res.body.profiles.find((p) => p.key === 'basic-cpu');
      expect(basic.available).toBe(true);

      const gpu = res.body.profiles.find((p) => p.key === 'ml-gpu');
      expect(gpu.available).toBe(false);
      expect(gpu.unavailableReason).toContain('Available on request');
    });

    it('requires authentication to fetch profiles', async () => {
      const res = await request(app).get('/lab/profiles');
      expect(res.status).toBe(401);
    });
  });

  // 3. Create Session
  describe('POST /lab/sessions', () => {
    it('rejects missing required parameters with 400', async () => {
      const res = await request(app)
        .post('/lab/sessions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ projectId: PROJ_ID });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects non-members with 403', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // member query

      const res = await request(app)
        .post('/lab/sessions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ projectId: PROJ_ID, profileKey: 'basic-cpu', name: 'My Session' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects GPU session when ENABLE_GPU_LABS is false', async () => {
      process.env.ENABLE_GPU_LABS = 'false';
      mockQuery
        .mockResolvedValueOnce({ rows: [{ project_role: 'member', allow_student_gpu: false }] }) // membership
        .mockResolvedValueOnce({ rows: [sampleProfiles[3]] }); // profile ml-gpu

      const res = await request(app)
        .post('/lab/sessions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ projectId: PROJ_ID, profileKey: 'ml-gpu', name: 'GPU Run' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('GPU_DISABLED');
    });

    it('rejects student for GPU session when project allow_student_gpu is false', async () => {
      process.env.ENABLE_GPU_LABS = 'true';
      const activeGpuProfile = { ...sampleProfiles[3], is_active: true };

      mockQuery
        .mockResolvedValueOnce({ rows: [{ project_role: 'member', allow_student_gpu: false }] }) // membership
        .mockResolvedValueOnce({ rows: [activeGpuProfile] }) // profile
        .mockResolvedValueOnce({ rows: [{ allow_student_gpu: false }] }); // allow_student_gpu check

      const res = await request(app)
        .post('/lab/sessions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ projectId: PROJ_ID, profileKey: 'ml-gpu', name: 'GPU Run' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects a second active session for the same user with 409', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ project_role: 'member', allow_student_gpu: false }] }) // membership
        .mockResolvedValueOnce({ rows: [sampleProfiles[0]] }) // profile
        .mockResolvedValueOnce({ rows: [{ id: 'active-session-id' }] }); // active user session exists

      const res = await request(app)
        .post('/lab/sessions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ projectId: PROJ_ID, profileKey: 'basic-cpu', name: 'Second Session' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SESSION_LIMIT');
    });

    it('rejects session when platform concurrent limit MAX_CONCURRENT_LABS is reached', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ project_role: 'member', allow_student_gpu: false }] }) // membership
        .mockResolvedValueOnce({ rows: [sampleProfiles[0]] }) // profile
        .mockResolvedValueOnce({ rows: [] }) // active user session = none
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }); // totalActive count = 2 (max)

      const res = await request(app)
        .post('/lab/sessions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ projectId: PROJ_ID, profileKey: 'basic-cpu', name: 'Exceed Max' });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('CONCURRENT_LAB_LIMIT');
    });

    it('successfully creates session and transitions to provisioning (202 Accepted)', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ project_role: 'member', allow_student_gpu: false }] }) // membership
        .mockResolvedValueOnce({ rows: [sampleProfiles[0]] }) // profile
        .mockResolvedValueOnce({ rows: [] }) // active user session = none
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // totalActive count = 0
        .mockResolvedValueOnce({ rows: [{ month_cost: '1.20' }] }) // budget check
        .mockResolvedValueOnce({ rows: [] }) // insert lab_sessions
        .mockResolvedValueOnce({ rows: [] }) // insert lab_session_events
        .mockResolvedValueOnce({ rows: [] }) // _provisionSession update
        .mockResolvedValueOnce({ rows: [] }); // _provisionSession insert event

      const res = await request(app)
        .post('/lab/sessions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ projectId: PROJ_ID, profileKey: 'basic-cpu', name: 'Data Analysis Notebook' });

      expect(res.status).toBe(202);
      expect(res.body.session).toBeDefined();
      expect(res.body.session.state).toBe('provisioning');
      expect(res.body.session.name).toBe('Data Analysis Notebook');
    });
  });

  // 4. List and Get Sessions
  describe('GET /lab/sessions & /lab/sessions/:id', () => {
    it('lists user sessions without exposing jupyter_token_enc', async () => {
      const mockSessions = [
        {
          id: SESSION_ID,
          name: 'My Lab',
          state: 'running',
          user_id: studentId,
          profile_name: 'Basic',
          profile_key: 'basic-cpu',
          jupyter_token_enc: 'secret_encrypted_token',
        },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockSessions });

      const res = await request(app)
        .get('/lab/sessions')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.sessions).toHaveLength(1);
      expect(res.body.sessions[0].jupyter_token_enc).toBeUndefined();
    });

    it('returns 404 for nonexistent session', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`/lab/sessions/${SESSION_ID}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(404);
    });

    it('hides url from non-owner project members', async () => {
      const mockSession = {
        id: SESSION_ID,
        name: 'Alex Lab',
        state: 'running',
        user_id: studentId,
        project_id: PROJ_ID,
        url: 'http://localhost:8901',
        jupyter_token_enc: 'secret_token',
      };
      mockQuery
        .mockResolvedValueOnce({ rows: [mockSession] }) // get session
        .mockResolvedValueOnce({ rows: [{ 1: 1 }] }); // membership check for other student

      const res = await request(app)
        .get(`/lab/sessions/${SESSION_ID}`)
        .set('Authorization', `Bearer ${otherStudentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.session.name).toBe('Alex Lab');
      expect(res.body.session.url).toBeUndefined();
      expect(res.body.session.jupyter_token_enc).toBeUndefined();
    });
  });

  // 5. Pause Session
  describe('POST /lab/sessions/:id/pause', () => {
    it('rejects non-owner with 403', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: SESSION_ID, user_id: studentId, state: 'running' }],
      });

      const res = await request(app)
        .post(`/lab/sessions/${SESSION_ID}/pause`)
        .set('Authorization', `Bearer ${otherStudentToken}`);

      expect(res.status).toBe(403);
    });

    it('rejects pause if session is not running with 409', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: SESSION_ID, user_id: studentId, state: 'paused' }],
      });

      const res = await request(app)
        .post(`/lab/sessions/${SESSION_ID}/pause`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATE');
    });

    it('initiates pause and returns 202 pausing', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              id: SESSION_ID,
              user_id: studentId,
              state: 'running',
              project_id: PROJ_ID,
              started_at: new Date(Date.now() - 60000).toISOString(),
              est_cost_per_hour: '0.05',
              total_runtime_seconds: 0,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // update state to pausing
        .mockResolvedValueOnce({ rows: [] }); // insert pausing event

      const res = await request(app)
        .post(`/lab/sessions/${SESSION_ID}/pause`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(202);
      expect(res.body.session.state).toBe('pausing');
    });
  });

  // 6. Resume Session
  describe('POST /lab/sessions/:id/resume', () => {
    it('rejects resume if session is not paused with 409', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: SESSION_ID, user_id: studentId, state: 'running' }],
      });

      const res = await request(app)
        .post(`/lab/sessions/${SESSION_ID}/resume`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATE');
    });

    it('initiates resume and returns 202 resuming', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              id: SESSION_ID,
              user_id: studentId,
              state: 'paused',
              project_id: PROJ_ID,
              profile_key: 'basic-cpu',
              workspace_prefix: 'workspaces/u/s',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // check active sessions = none
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // totalActive count
        .mockResolvedValueOnce({ rows: [] }) // update state to resuming
        .mockResolvedValueOnce({ rows: [] }); // insert event

      const res = await request(app)
        .post(`/lab/sessions/${SESSION_ID}/resume`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(202);
      expect(res.body.session.state).toBe('resuming');
    });
  });

  // 7. Stop Session
  describe('POST /lab/sessions/:id/stop', () => {
    it('rejects already stopped session with 409', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: SESSION_ID, user_id: studentId, state: 'stopped' }],
      });

      const res = await request(app)
        .post(`/lab/sessions/${SESSION_ID}/stop`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATE');
    });

    it('initiates stop and returns 202 stopping', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              id: SESSION_ID,
              user_id: studentId,
              state: 'running',
              project_id: PROJ_ID,
              total_runtime_seconds: 120,
              est_cost_per_hour: '0.05',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // update state to stopping
        .mockResolvedValueOnce({ rows: [] }); // insert event

      const res = await request(app)
        .post(`/lab/sessions/${SESSION_ID}/stop`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ exportNotebooks: true });

      expect(res.status).toBe(202);
      expect(res.body.session.state).toBe('stopping');
    });
  });

  // 8. Reconciler Endpoint
  describe('POST /internal/reconcile', () => {
    it('executes reconciler checks cleanly and returns status ok', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // running sessions
        .mockResolvedValueOnce({ rows: [] }) // paused sessions
        .mockResolvedValueOnce({ rows: [] }) // stuck sessions

      const res = await request(app).post('/internal/reconcile');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
