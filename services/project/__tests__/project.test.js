const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('@rh/shared', () => {
  const original = jest.requireActual('@rh/shared');
  return {
    ...original,
    query: jest.fn(),
  };
});

const { query, JWT_SECRET } = require('@rh/shared');
const app = require('../src/app');

describe('Project Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validProjId = '10000000-1111-2222-3333-444444444444';
  const profUserId = '20000000-1111-2222-3333-444444444444';
  const researcherUserId = '30000000-1111-2222-3333-444444444444';
  const studentUserId = '40000000-1111-2222-3333-444444444444';

  const profToken = jwt.sign({ sub: profUserId, role: 'professor', name: 'Prof Oak' }, JWT_SECRET);
  const researcherToken = jwt.sign({ sub: researcherUserId, role: 'researcher', name: 'Dr. Banner' }, JWT_SECRET);
  const studentToken = jwt.sign({ sub: studentUserId, role: 'student', name: 'Peter Parker' }, JWT_SECRET);


  describe('GET /healthz', () => {
    it('should return 200 health check', async () => {
      const res = await request(app).get('/healthz');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok', service: 'project-service' });
    });
  });

  describe('POST /projects', () => {
    it('should reject project creation by student with 403', async () => {
      const res = await request(app)
        .post('/projects')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ title: 'Quantum Computing Lab' });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Students are not allowed to create projects');
    });

    it('should allow researcher to create project and assign creator as lead', async () => {
      const fakeProject = {
        id: validProjId,
        title: 'Genome Mapping',
        description: 'Genetics research',
        status: 'planning',
        owner_id: researcherUserId,
        created_at: new Date().toISOString(),
      };
      // Insert project
      query.mockResolvedValueOnce({ rows: [fakeProject] });
      // Insert member
      query.mockResolvedValueOnce({ rows: [{ project_id: validProjId, user_id: researcherUserId, project_role: 'lead' }] });

      const res = await request(app)
        .post('/projects')
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({ title: 'Genome Mapping', description: 'Genetics research' });

      expect(res.status).toBe(201);
      expect(res.body.project.id).toBe(validProjId);
      expect(query).toHaveBeenCalledTimes(2);
    });
  });

  describe('GET /projects/:id', () => {
    it('should return 400 when an invalid non-UUID project ID is passed', async () => {
      const res = await request(app)
        .get('/projects/invalid-proj-id-123')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Invalid project ID format');
    });

    it('should forbid non-members from viewing project', async () => {
      // Member check query returns empty
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`/projects/${validProjId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('not a member of this project');
    });

    it('should return project details with members and milestones for member', async () => {
      // Member check query
      query.mockResolvedValueOnce({ rows: [{ project_role: 'member' }] });
      // Project fetch
      query.mockResolvedValueOnce({
        rows: [{ id: validProjId, title: 'Genome Mapping', status: 'planning', owner_name: 'Dr. Banner' }],
      });
      // Members fetch
      query.mockResolvedValueOnce({
        rows: [
          { user_id: researcherUserId, full_name: 'Dr. Banner', project_role: 'lead' },
          { user_id: studentUserId, full_name: 'Peter Parker', project_role: 'member' },
        ],
      });
      // Milestones fetch
      const validMilestoneId = '50000000-1111-2222-3333-444444444444';
      query.mockResolvedValueOnce({
        rows: [{ id: validMilestoneId, title: 'Phase 1 Complete', is_done: false }],
      });

      const res = await request(app)
        .get(`/projects/${validProjId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.project.title).toBe('Genome Mapping');
      expect(res.body.project.members).toHaveLength(2);
      expect(res.body.project.milestones).toHaveLength(1);
    });
  });

  describe('PATCH /projects/:id/status', () => {
    it('should allow lead or professor to update project status', async () => {
      // updateProjectStatus query
      query.mockResolvedValueOnce({
        rows: [{ id: validProjId, status: 'active' }],
      });

      const res = await request(app)
        .patch(`/projects/${validProjId}/status`)
        .set('Authorization', `Bearer ${profToken}`)
        .send({ status: 'active' });

      expect(res.status).toBe(200);
      expect(res.body.project.status).toBe('active');
    });
  });

  describe('POST & DELETE /projects/:id/members', () => {
    it('should allow lead or professor to add a member', async () => {
      const targetMemberId = '11111111-2222-3333-4444-555555555555';
      // 1. addMember user check query
      query.mockResolvedValueOnce({ rows: [{ id: targetMemberId }] });
      // 2. addMember insert query
      query.mockResolvedValueOnce({
        rows: [{ project_id: validProjId, user_id: targetMemberId, project_role: 'member' }],
      });

      const res = await request(app)
        .post(`/projects/${validProjId}/members`)
        .set('Authorization', `Bearer ${profToken}`)
        .send({ userId: targetMemberId, projectRole: 'member' });

      expect(res.status).toBe(201);
      expect(res.body.member.project_role).toBe('member');
    });
  });

});
