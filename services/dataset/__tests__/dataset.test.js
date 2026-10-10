const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock @rh/shared database query and storage adapter
const mockQuery = jest.fn();
const mockGetSignedUploadUrl = jest.fn();
const mockGetSignedDownloadUrl = jest.fn();

jest.mock('@rh/shared', () => {
  const original = jest.requireActual('@rh/shared');
  return {
    ...original,
    query: mockQuery,
    getStorageAdapter: () => ({
      getSignedUploadUrl: mockGetSignedUploadUrl,
      getSignedDownloadUrl: mockGetSignedDownloadUrl,
    }),
  };
});

jest.mock('@rh/shared/src/db', () => ({
  query: mockQuery,
  pool: {},
}));

const { JWT_SECRET } = require('@rh/shared');
const app = require('../src/app');

describe('Dataset Service', () => {
  // Deterministic test UUIDs (all valid UUID v4 format)
  const PID   = '10000000-0000-0000-0000-000000000001'; // project
  const DS_ID = '20000000-0000-0000-0000-000000000001'; // dataset
  const VER_ID= '30000000-0000-0000-0000-000000000001'; // version

  const leadUserId      = '40000000-0000-0000-0000-000000000001';
  const memberUserId    = '50000000-0000-0000-0000-000000000002';
  const viewerUserId    = '60000000-0000-0000-0000-000000000003';
  const nonMemberUserId = '70000000-0000-0000-0000-000000000004';

  const leadToken      = jwt.sign({ sub: leadUserId,      role: 'student', name: 'Lead User'      }, JWT_SECRET);
  const memberToken    = jwt.sign({ sub: memberUserId,    role: 'student', name: 'Member User'    }, JWT_SECRET);
  const viewerToken    = jwt.sign({ sub: viewerUserId,    role: 'student', name: 'Viewer User'    }, JWT_SECRET);
  const nonMemberToken = jwt.sign({ sub: nonMemberUserId, role: 'student', name: 'NonMember User' }, JWT_SECRET);
  const profToken      = jwt.sign({ sub: leadUserId,      role: 'professor', name: 'Prof User'    }, JWT_SECRET);

  // Helper: successful project_members row
  const memberRow    = { project_role: 'member' };
  const viewerRow    = { project_role: 'viewer' };
  const leadRow      = { project_role: 'lead' };
  const nonMemberRes = { rows: [] };

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReset();
  });

  // ── Health Check ────────────────────────────────────────────────────────────
  describe('GET /healthz', () => {
    it('returns 200 health check', async () => {
      const res = await request(app).get('/healthz');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'ok', service: 'dataset-service' });
    });
  });

  // ── GET /projects/:pid/datasets ─────────────────────────────────────────────
  describe('GET /projects/:pid/datasets', () => {
    it('forbids non-members', async () => {
      mockQuery.mockResolvedValueOnce(nonMemberRes); // project_members lookup

      const res = await request(app)
        .get(`/projects/${PID}/datasets`)
        .set('Authorization', `Bearer ${nonMemberToken}`);

      expect(res.status).toBe(403);
    });

    it('returns dataset list for viewer', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [viewerRow] })       // requireProjectRole
        .mockResolvedValueOnce({                             // SELECT datasets
          rows: [
            {
              id: DS_ID,
              name: 'Protein Binding Corpus',
              description: 'Core benchmark dataset',
              project_id: PID,
              created_at: new Date().toISOString(),
              created_by_name: 'Dr Smith',
              current_version_no: 3,
            },
          ],
        });

      const res = await request(app)
        .get(`/projects/${PID}/datasets`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('datasets');
      expect(res.body.datasets).toHaveLength(1);
      expect(res.body.datasets[0].name).toBe('Protein Binding Corpus');
    });

    it('rejects invalid project UUID with 400', async () => {
      const res = await request(app)
        .get('/projects/NOT-A-UUID/datasets')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(400);
    });
  });

  // ── POST /projects/:pid/datasets ────────────────────────────────────────────
  describe('POST /projects/:pid/datasets', () => {
    it('forbids viewers from creating datasets', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [viewerRow] }); // project_members

      const res = await request(app)
        .post(`/projects/${PID}/datasets`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'New Dataset' });

      expect(res.status).toBe(403);
    });

    it('creates a dataset for a member', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [memberRow] })   // requireProjectRole
        .mockResolvedValueOnce({                         // INSERT datasets
          rows: [{
            id: DS_ID,
            project_id: PID,
            name: 'Climate Model Output',
            description: null,
            created_by: memberUserId,
            created_at: new Date().toISOString(),
          }],
        });

      const res = await request(app)
        .post(`/projects/${PID}/datasets`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Climate Model Output' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('dataset');
      expect(res.body.dataset.name).toBe('Climate Model Output');
    });

    it('rejects missing name with 400', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [memberRow] }); // requireProjectRole

      const res = await request(app)
        .post(`/projects/${PID}/datasets`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ description: 'No name' });

      expect(res.status).toBe(400);
    });

    it('professor can create (bypasses project role check)', async () => {
      // Professors bypass project membership — requireProjectRole grants lead
      mockQuery
        .mockResolvedValueOnce({                         // INSERT datasets
          rows: [{
            id: DS_ID,
            project_id: PID,
            name: 'Prof Dataset',
            created_at: new Date().toISOString(),
          }],
        });

      const res = await request(app)
        .post(`/projects/${PID}/datasets`)
        .set('Authorization', `Bearer ${profToken}`)
        .send({ name: 'Prof Dataset' });

      expect(res.status).toBe(201);
    });
  });

  // ── GET /projects/:pid/datasets/:id ────────────────────────────────────────
  describe('GET /projects/:pid/datasets/:id', () => {
    it('returns dataset with version history for viewer', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [viewerRow] })   // requireProjectRole
        .mockResolvedValueOnce({                         // SELECT dataset
          rows: [{
            id: DS_ID,
            name: 'Genomic Sequences v3',
            description: 'Reference genome subset',
            project_id: PID,
            created_by_name: 'Dr Smith',
            created_at: new Date().toISOString(),
          }],
        })
        .mockResolvedValueOnce({                         // SELECT versions
          rows: [
            { id: VER_ID, version_no: 2, change_note: 'Updated labels', created_at: new Date().toISOString(), author_name: 'Dr Smith' },
            { id: 'a0000000-0000-0000-0000-000000000099', version_no: 1, change_note: 'Initial upload', created_at: new Date().toISOString(), author_name: 'Dr Smith' },
          ],
        });

      const res = await request(app)
        .get(`/projects/${PID}/datasets/${DS_ID}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('dataset');
      expect(res.body).toHaveProperty('versions');
      expect(res.body.versions).toHaveLength(2);
    });

    it('returns 404 for unknown dataset', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [viewerRow] })   // requireProjectRole
        .mockResolvedValueOnce({ rows: [] });            // SELECT dataset -> not found

      const res = await request(app)
        .get(`/projects/${PID}/datasets/${DS_ID}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /projects/:pid/datasets/:id ───────────────────────────────────────
  describe('PATCH /projects/:pid/datasets/:id', () => {
    it('updates dataset metadata', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [memberRow] })    // requireProjectRole
        .mockResolvedValueOnce({ rows: [{ id: DS_ID, name: 'Old Name' }] })  // existing
        .mockResolvedValueOnce({                          // UPDATE
          rows: [{ id: DS_ID, name: 'New Name', description: 'Updated desc' }],
        });

      const res = await request(app)
        .patch(`/projects/${PID}/datasets/${DS_ID}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'New Name', description: 'Updated desc' });

      expect(res.status).toBe(200);
      expect(res.body.dataset.name).toBe('New Name');
    });

    it('viewer cannot update', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [viewerRow] }); // requireProjectRole

      const res = await request(app)
        .patch(`/projects/${PID}/datasets/${DS_ID}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /projects/:pid/datasets/:id ──────────────────────────────────────
  describe('DELETE /projects/:pid/datasets/:id', () => {
    it('allows lead to delete', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [leadRow] })      // requireProjectRole
        .mockResolvedValueOnce({ rows: [{ id: DS_ID }] }) // existing
        .mockResolvedValueOnce({ rows: [] });              // DELETE

      const res = await request(app)
        .delete(`/projects/${PID}/datasets/${DS_ID}`)
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');
    });

    it('member cannot delete (requires lead)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [memberRow] }); // requireProjectRole -> member < lead

      const res = await request(app)
        .delete(`/projects/${PID}/datasets/${DS_ID}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ── POST /projects/:pid/datasets/:id/versions/upload-url ───────────────────
  describe('POST /projects/:pid/datasets/:id/versions/upload-url', () => {
    it('returns signed upload URL for member', async () => {
      mockGetSignedUploadUrl.mockResolvedValue({
        uploadUrl: 'http://localhost:5000/api/storage/upload?bucket=researchhub-storage&key=datasets/test/v1/file.csv',
        gcsPath: 'gs://researchhub-storage/datasets/test/v1/file.csv',
      });

      mockQuery
        .mockResolvedValueOnce({ rows: [memberRow] })   // requireProjectRole
        .mockResolvedValueOnce({ rows: [{ id: DS_ID, project_id: PID }] }) // dataset exists
        .mockResolvedValueOnce({ rows: [{ max_ver: 2 }] }); // version count

      const res = await request(app)
        .post(`/projects/${PID}/datasets/${DS_ID}/versions/upload-url`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ fileName: 'data.csv', mimeType: 'text/csv' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('uploadUrl');
      expect(res.body).toHaveProperty('gcsPath');
      expect(res.body.nextVersion).toBe(3);
    });

    it('rejects viewer from getting upload URL', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [viewerRow] }); // requireProjectRole

      const res = await request(app)
        .post(`/projects/${PID}/datasets/${DS_ID}/versions/upload-url`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ fileName: 'data.csv' });

      expect(res.status).toBe(403);
    });
  });

  // ── POST /projects/:pid/datasets/:id/versions ───────────────────────────────
  describe('POST /projects/:pid/datasets/:id/versions', () => {
    it('confirms a new version and updates current_version_id', async () => {
      const newVersionId = 'a1000000-0000-0000-0000-000000000001';

      mockQuery
        .mockResolvedValueOnce({ rows: [memberRow] })          // requireProjectRole
        .mockResolvedValueOnce({ rows: [{ id: DS_ID }] })     // dataset exists
        .mockResolvedValueOnce({ rows: [{ max_ver: 1 }] })    // version count
        .mockResolvedValueOnce({                               // INSERT version
          rows: [{
            id: newVersionId,
            dataset_id: DS_ID,
            version_no: 2,
            gcs_path: 'gs://researchhub-storage/datasets/test/v2/data.csv',
            size_bytes: 1024000,
            checksum_sha256: 'abc123',
            change_note: 'Added 500 new rows',
            created_at: new Date().toISOString(),
          }],
        })
        .mockResolvedValueOnce({ rows: [] });                  // UPDATE current_version_id

      const res = await request(app)
        .post(`/projects/${PID}/datasets/${DS_ID}/versions`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          gcsPath: 'gs://researchhub-storage/datasets/test/v2/data.csv',
          sizeBytes: 1024000,
          checksumSha256: 'abc123',
          changeNote: 'Added 500 new rows',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('version');
      expect(res.body.version.version_no).toBe(2);
      expect(res.body.version.change_note).toBe('Added 500 new rows');
    });

    it('returns 400 if checksumSha256 missing', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [memberRow] }); // requireProjectRole

      const res = await request(app)
        .post(`/projects/${PID}/datasets/${DS_ID}/versions`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ gcsPath: 'gs://bucket/key' }); // missing checksumSha256

      expect(res.status).toBe(400);
    });
  });

  // ── GET /projects/:pid/datasets/:id/versions ────────────────────────────────
  describe('GET /projects/:pid/datasets/:id/versions', () => {
    it('returns version history for viewer', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [viewerRow] })   // requireProjectRole
        .mockResolvedValueOnce({ rows: [{ id: DS_ID }] }) // dataset exists
        .mockResolvedValueOnce({                          // versions
          rows: [
            { id: VER_ID, version_no: 2, author_name: 'Dr Smith', created_at: new Date().toISOString() },
            { id: 'b0000000-0000-0000-0000-000000000001', version_no: 1, author_name: 'Dr Smith', created_at: new Date().toISOString() },
          ],
        });

      const res = await request(app)
        .get(`/projects/${PID}/datasets/${DS_ID}/versions`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.versions).toHaveLength(2);
    });
  });

  // ── GET /projects/:pid/datasets/:id/versions/:versionId/download ────────────
  describe('GET /projects/:pid/datasets/:id/versions/:versionId/download', () => {
    it('returns signed download URL for viewer', async () => {
      mockGetSignedDownloadUrl.mockResolvedValue(
        'http://localhost:5000/api/storage/download?bucket=researchhub-storage&key=datasets/test/v2/data.csv'
      );

      mockQuery
        .mockResolvedValueOnce({ rows: [viewerRow] })     // requireProjectRole
        .mockResolvedValueOnce({                           // version exists
          rows: [{
            id: VER_ID,
            dataset_id: DS_ID,
            gcs_path: 'gs://researchhub-storage/datasets/test/v2/data.csv',
            version_no: 2,
          }],
        });

      const res = await request(app)
        .get(`/projects/${PID}/datasets/${DS_ID}/versions/${VER_ID}/download`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('downloadUrl');
    });

    it('returns 404 for unknown version', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [viewerRow] })  // requireProjectRole
        .mockResolvedValueOnce({ rows: [] });           // version not found

      const res = await request(app)
        .get(`/projects/${PID}/datasets/${DS_ID}/versions/${VER_ID}/download`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ── POST /projects/:pid/datasets/:id/versions/:versionId/restore ────────────
  describe('POST /projects/:pid/datasets/:id/versions/:versionId/restore', () => {
    it('creates a new version from an old one without modifying the source', async () => {
      const restoredVersionId = 'c0000000-0000-0000-0000-000000000001';

      mockQuery
        .mockResolvedValueOnce({ rows: [memberRow] })        // requireProjectRole
        .mockResolvedValueOnce({ rows: [{ id: DS_ID }] })  // dataset exists
        .mockResolvedValueOnce({                             // source version
          rows: [{
            id: VER_ID,
            version_no: 1,
            gcs_path: 'gs://researchhub-storage/datasets/test/v1/data.csv',
            size_bytes: 512000,
            checksum_sha256: 'original-checksum-abc',
            metadata: {},
          }],
        })
        .mockResolvedValueOnce({ rows: [{ max_ver: 3 }] }) // max version
        .mockResolvedValueOnce({                             // INSERT restored version
          rows: [{
            id: restoredVersionId,
            dataset_id: DS_ID,
            version_no: 4,
            gcs_path: 'gs://researchhub-storage/datasets/test/v1/data.csv',
            change_note: 'Restored from v1',
            checksum_sha256: 'original-checksum-abc',
            created_at: new Date().toISOString(),
          }],
        })
        .mockResolvedValueOnce({ rows: [] });                // UPDATE current_version_id

      const res = await request(app)
        .post(`/projects/${PID}/datasets/${DS_ID}/versions/${VER_ID}/restore`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(201);
      expect(res.body.version.version_no).toBe(4);
      expect(res.body.version.change_note).toBe('Restored from v1');
      expect(res.body.version.checksum_sha256).toBe('original-checksum-abc');
    });

    it('viewer cannot restore', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [viewerRow] }); // requireProjectRole

      const res = await request(app)
        .post(`/projects/${PID}/datasets/${DS_ID}/versions/${VER_ID}/restore`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ── Authentication Guards ────────────────────────────────────────────────────
  describe('Authentication', () => {
    it('returns 401 when no token provided', async () => {
      const res = await request(app).get(`/projects/${PID}/datasets`);
      expect(res.status).toBe(401);
    });
  });
});
