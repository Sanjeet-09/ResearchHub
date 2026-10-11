const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock @rh/shared database query
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
const query = mockQuery;
const app = require('../src/app');

describe('Experiment Service', () => {
  const testProjectId = '10000000-0000-0000-0000-000000000001';
  const testExperimentId = '20000000-0000-0000-0000-000000000001';
  const testFileId = '30000000-0000-0000-0000-000000000001';

  const memberUserId = '40000000-0000-0000-0000-000000000001';
  const viewerUserId = '50000000-0000-0000-0000-000000000002';
  const nonMemberUserId = '60000000-0000-0000-0000-000000000003';

  const memberToken = jwt.sign({ sub: memberUserId, role: 'student', name: 'Member Student' }, JWT_SECRET);
  const viewerToken = jwt.sign({ sub: viewerUserId, role: 'student', name: 'Viewer Student' }, JWT_SECRET);
  const nonMemberToken = jwt.sign({ sub: nonMemberUserId, role: 'student', name: 'Non Member' }, JWT_SECRET);

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockReset();
  });

  describe('GET /healthz', () => {
    it('should return 200 health check', async () => {
      const res = await request(app).get('/healthz');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok', service: 'experiment-service' });
    });
  });

  describe('GET /projects/:pid/experiments', () => {
    it('should forbid non-members from viewing experiments', async () => {
      query.mockResolvedValueOnce({ rows: [] }); // project_members -> not found

      const res = await request(app)
        .get(`/projects/${testProjectId}/experiments`)
        .set('Authorization', `Bearer ${nonMemberToken}`);

      expect(res.status).toBe(403);
    });

    it('should return experiment list for project member or viewer', async () => {
      query.mockResolvedValueOnce({ rows: [{ project_role: 'viewer' }] });
      query.mockResolvedValueOnce({
        rows: [
          {
            id: testExperimentId,
            project_id: testProjectId,
            title: 'Neural Network Benchmark',
            status: 'planned',
          },
        ],
      });

      const res = await request(app)
        .get(`/projects/${testProjectId}/experiments`)
        .set('Authorization', `Bearer ${viewerToken}`);

      if (res.status !== 200) console.log('DEBUG TEST 2:', res.status, res.body);

      expect(res.status).toBe(200);
      expect(res.body.experiments).toHaveLength(1);
      expect(res.body.experiments[0].title).toBe('Neural Network Benchmark');
    });
  });

  describe('POST /projects/:pid/experiments', () => {
    it('should forbid viewer role from creating experiments', async () => {
      query.mockResolvedValueOnce({ rows: [{ project_role: 'viewer' }] });

      const res = await request(app)
        .post(`/projects/${testProjectId}/experiments`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ title: 'Forbidden Experiment' });

      expect(res.status).toBe(403);
    });

    it('should allow member to create experiment', async () => {
      query.mockResolvedValueOnce({ rows: [{ project_role: 'member' }] });
      const newExp = {
        id: testExperimentId,
        project_id: testProjectId,
        title: 'Quantum Model Test',
        hypothesis: 'Speedup expected',
        notes: '# Notes',
        results: '# Results',
        status: 'planned',
        created_by: memberUserId,
      };
      query.mockResolvedValueOnce({ rows: [newExp] });

      const res = await request(app)
        .post(`/projects/${testProjectId}/experiments`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Quantum Model Test',
          hypothesis: 'Speedup expected',
          notes: '# Notes',
          results: '# Results',
          status: 'planned',
        });

      expect(res.status).toBe(201);
      expect(res.body.experiment.title).toBe('Quantum Model Test');
    });
  });

  describe('GET /projects/:pid/experiments/:id', () => {
    it('should return experiment details and files for member', async () => {
      query.mockResolvedValueOnce({ rows: [{ project_role: 'member' }] });
      query.mockResolvedValueOnce({
        rows: [{ id: testExperimentId, project_id: testProjectId, title: 'Quantum Model Test' }],
      });
      query.mockResolvedValueOnce({
        rows: [{ id: testFileId, experiment_id: testExperimentId, file_name: 'data.csv' }],
      });

      const res = await request(app)
        .get(`/projects/${testProjectId}/experiments/${testExperimentId}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.experiment.id).toBe(testExperimentId);
      expect(res.body.files).toHaveLength(1);
    });
  });

  describe('PATCH /projects/:pid/experiments/:id', () => {
    it('should update experiment fields and status', async () => {
      query.mockResolvedValueOnce({ rows: [{ project_role: 'member' }] });
      query.mockResolvedValueOnce({
        rows: [{ id: testExperimentId, title: 'Old Title', status: 'planned' }],
      });
      query.mockResolvedValueOnce({
        rows: [{ id: testExperimentId, title: 'Updated Title', status: 'running' }],
      });

      const res = await request(app)
        .patch(`/projects/${testProjectId}/experiments/${testExperimentId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: 'Updated Title', status: 'running' });

      expect(res.status).toBe(200);
      expect(res.body.experiment.status).toBe('running');
    });
  });

  describe('DELETE /projects/:pid/experiments/:id', () => {
    it('should delete experiment for member', async () => {
      query.mockResolvedValueOnce({ rows: [{ project_role: 'member' }] });
      query.mockResolvedValueOnce({ rows: [{ id: testExperimentId }] }); // existing check
      query.mockResolvedValueOnce({ rows: [] }); // delete query

      const res = await request(app)
        .delete(`/projects/${testProjectId}/experiments/${testExperimentId}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted successfully');
    });
  });

  describe('File Upload Flow', () => {
    it('POST /upload-url should return signed upload URL', async () => {
      query.mockResolvedValueOnce({ rows: [{ project_role: 'member' }] });
      query.mockResolvedValueOnce({ rows: [{ id: testExperimentId }] });

      const res = await request(app)
        .post(`/projects/${testProjectId}/experiments/${testExperimentId}/files/upload-url`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ fileName: 'dataset.csv', mimeType: 'text/csv' });

      expect(res.status).toBe(200);
      expect(res.body.uploadUrl).toBeDefined();
      expect(res.body.gcsPath).toContain('researchhub-storage');
    });

    it('POST /confirm should record file metadata in database', async () => {
      query.mockResolvedValueOnce({ rows: [{ project_role: 'member' }] });
      query.mockResolvedValueOnce({ rows: [{ id: testExperimentId }] });
      const createdFile = {
        id: testFileId,
        experiment_id: testExperimentId,
        file_name: 'dataset.csv',
        gcs_path: `gs://researchhub-storage/datasets/${testProjectId}/experiments/${testExperimentId}/dataset.csv`,
        mime_type: 'text/csv',
        size_bytes: 1024,
      };
      query.mockResolvedValueOnce({ rows: [createdFile] });

      const res = await request(app)
        .post(`/projects/${testProjectId}/experiments/${testExperimentId}/files/confirm`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          fileName: 'dataset.csv',
          gcsPath: createdFile.gcs_path,
          mimeType: 'text/csv',
          sizeBytes: 1024,
        });

      expect(res.status).toBe(201);
      expect(res.body.file.file_name).toBe('dataset.csv');
    });

    it('GET /download should return signed download URL', async () => {
      query.mockResolvedValueOnce({ rows: [{ project_role: 'member' }] });
      const fileRecord = {
        id: testFileId,
        experiment_id: testExperimentId,
        file_name: 'dataset.csv',
        gcs_path: `gs://researchhub-storage/datasets/${testProjectId}/experiments/${testExperimentId}/dataset.csv`,
      };
      query.mockResolvedValueOnce({ rows: [fileRecord] });

      const res = await request(app)
        .get(`/projects/${testProjectId}/experiments/${testExperimentId}/files/${testFileId}/download`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.downloadUrl).toBeDefined();
    });

    it('DELETE /files/:fileId should remove file record', async () => {
      query.mockResolvedValueOnce({ rows: [{ project_role: 'member' }] });
      const fileRecord = {
        id: testFileId,
        experiment_id: testExperimentId,
        file_name: 'dataset.csv',
        gcs_path: `gs://researchhub-storage/datasets/${testProjectId}/experiments/${testExperimentId}/dataset.csv`,
      };
      query.mockResolvedValueOnce({ rows: [fileRecord] });
      query.mockResolvedValueOnce({ rows: [] }); // delete query

      const res = await request(app)
        .delete(`/projects/${testProjectId}/experiments/${testExperimentId}/files/${testFileId}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted successfully');
    });
  });

  describe('GET /experiments/:id/links', () => {
    it('should return entity links for experiment', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 'event-1', action: 'created', entity_type: 'experiment', summary: 'Experiment created', created_at: new Date().toISOString() }],
      });
      query.mockResolvedValueOnce({ rows: [] }); // publication_links

      const res = await request(app)
        .get(`/experiments/${testExperimentId}/links`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.links).toBeDefined();
    });
  });
});
