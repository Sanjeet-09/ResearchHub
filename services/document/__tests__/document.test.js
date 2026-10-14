const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock @rh/shared database query and storage adapter
const mockQuery = jest.fn();
const mockGetSignedUploadUrl = jest.fn();
const mockGetSignedDownloadUrl = jest.fn();
const mockDeleteFile = jest.fn();

jest.mock('@rh/shared', () => {
  const original = jest.requireActual('@rh/shared');
  return {
    ...original,
    query: mockQuery,
    getStorageAdapter: () => ({
      getSignedUploadUrl: mockGetSignedUploadUrl,
      getSignedDownloadUrl: mockGetSignedDownloadUrl,
      deleteFile: mockDeleteFile,
    }),
  };
});

jest.mock('@rh/shared/src/db', () => ({
  query: mockQuery,
  pool: {},
}));

const { JWT_SECRET } = require('@rh/shared');
const app = require('../src/app');

describe('Document Service', () => {
  const PID = '10000000-0000-0000-0000-000000000001';
  const DOC_ID = '20000000-0000-0000-0000-000000000001';

  const leadUserId = '40000000-0000-0000-0000-000000000001';
  const memberUserId = '50000000-0000-0000-0000-000000000002';
  const viewerUserId = '60000000-0000-0000-0000-000000000003';
  const nonMemberUserId = '70000000-0000-0000-0000-000000000004';

  const leadToken = jwt.sign({ sub: leadUserId, role: 'student', name: 'Lead User' }, JWT_SECRET);
  const memberToken = jwt.sign({ sub: memberUserId, role: 'student', name: 'Member User' }, JWT_SECRET);
  const viewerToken = jwt.sign({ sub: viewerUserId, role: 'student', name: 'Viewer User' }, JWT_SECRET);
  const nonMemberToken = jwt.sign({ sub: nonMemberUserId, role: 'student', name: 'NonMember User' }, JWT_SECRET);
  const profToken = jwt.sign({ sub: leadUserId, role: 'professor', name: 'Prof User' }, JWT_SECRET);

  const memberRow = { project_role: 'member' };
  const viewerRow = { project_role: 'viewer' };
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
      expect(res.body).toMatchObject({ status: 'ok', service: 'document-service' });
    });
  });

  // ── GET /projects/:pid/documents ─────────────────────────────────────────────
  describe('GET /projects/:pid/documents', () => {
    it('forbids non-members from viewing documents', async () => {
      mockQuery.mockResolvedValueOnce(nonMemberRes);

      const res = await request(app)
        .get(`/projects/${PID}/documents`)
        .set('Authorization', `Bearer ${nonMemberToken}`);

      expect(res.status).toBe(403);
    });

    it('returns document list for viewer', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [viewerRow] }) // requireProjectRole
        .mockResolvedValueOnce({ rows: [{ id: DOC_ID, title: 'Paper 1', doc_type: 'paper' }] }) // list
        .mockResolvedValueOnce({ rows: [{ total: '1' }] }); // count

      const res = await request(app)
        .get(`/projects/${PID}/documents`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.documents).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('filters by docType and search query', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [viewerRow] })
        .mockResolvedValueOnce({ rows: [{ id: DOC_ID, title: 'AI Research', doc_type: 'report' }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });

      const res = await request(app)
        .get(`/projects/${PID}/documents?docType=report&search=AI`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.documents[0].doc_type).toBe('report');
    });
  });

  // ── POST /projects/:pid/documents/upload-url ────────────────────────────────
  describe('POST /projects/:pid/documents/upload-url', () => {
    it('returns signed upload URL for member', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [memberRow] });
      mockGetSignedUploadUrl.mockResolvedValueOnce({
        uploadUrl: 'http://storage-test/upload/docs',
        gcsPath: 'gs://researchhub-storage/documents/sample.pdf',
      });

      const res = await request(app)
        .post(`/projects/${PID}/documents/upload-url`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          fileName: 'sample.pdf',
          mimeType: 'application/pdf',
          docType: 'pdf',
        });

      expect(res.status).toBe(200);
      expect(res.body.uploadUrl).toBe('http://storage-test/upload/docs');
      expect(res.body.key).toContain('documents/');
    });

    it('forbids viewer from requesting upload URL', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [viewerRow] });

      const res = await request(app)
        .post(`/projects/${PID}/documents/upload-url`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ fileName: 'file.pdf' });

      expect(res.status).toBe(403);
    });

    it('returns 400 when fileName is missing', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [memberRow] });

      const res = await request(app)
        .post(`/projects/${PID}/documents/upload-url`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ── POST /projects/:pid/documents ────────────────────────────────────────────
  describe('POST /projects/:pid/documents', () => {
    it('creates a new document record for member', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [memberRow] }) // requireProjectRole
        .mockResolvedValueOnce({
          rows: [{
            id: DOC_ID,
            project_id: PID,
            title: 'Neural Nets Overview',
            doc_type: 'paper',
            gcs_path: 'gs://researchhub-storage/documents/p.pdf',
            size_bytes: '1024',
          }],
        }); // insert

      const res = await request(app)
        .post(`/projects/${PID}/documents`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Neural Nets Overview',
          docType: 'paper',
          gcsPath: 'gs://researchhub-storage/documents/p.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          fileName: 'p.pdf',
        });

      expect(res.status).toBe(201);
      expect(res.body.document.id).toBe(DOC_ID);
      expect(res.body.document.title).toBe('Neural Nets Overview');
    });

    it('returns 403 for viewer trying to create document', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [viewerRow] });

      const res = await request(app)
        .post(`/projects/${PID}/documents`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          title: 'Paper',
          gcsPath: 'gs://storage/doc.pdf',
          fileName: 'doc.pdf',
        });

      expect(res.status).toBe(403);
    });
  });

  // ── GET /projects/:pid/documents/:id ─────────────────────────────────────────
  describe('GET /projects/:pid/documents/:id', () => {
    it('returns document details for viewer', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [viewerRow] })
        .mockResolvedValueOnce({
          rows: [{ id: DOC_ID, project_id: PID, title: 'My Report', doc_type: 'report' }],
        });

      const res = await request(app)
        .get(`/projects/${PID}/documents/${DOC_ID}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.document.id).toBe(DOC_ID);
    });

    it('returns 404 for unknown document', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [viewerRow] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`/projects/${PID}/documents/${DOC_ID}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /projects/:pid/documents/:id ───────────────────────────────────────
  describe('PATCH /projects/:pid/documents/:id', () => {
    it('updates title and doc_type for member', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [memberRow] })
        .mockResolvedValueOnce({ rows: [{ id: DOC_ID, project_id: PID, title: 'Old Title', doc_type: 'note' }] }) // select
        .mockResolvedValueOnce({ rows: [{ id: DOC_ID, project_id: PID, title: 'New Title', doc_type: 'report' }] }); // update

      const res = await request(app)
        .patch(`/projects/${PID}/documents/${DOC_ID}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: 'New Title', docType: 'report' });

      expect(res.status).toBe(200);
      expect(res.body.document.title).toBe('New Title');
    });

    it('forbids viewer from updating document', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [viewerRow] });

      const res = await request(app)
        .patch(`/projects/${PID}/documents/${DOC_ID}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ title: 'New Title' });

      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /projects/:pid/documents/:id ──────────────────────────────────────
  describe('DELETE /projects/:pid/documents/:id', () => {
    it('deletes document and storage file for member', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [memberRow] })
        .mockResolvedValueOnce({ rows: [{ id: DOC_ID, project_id: PID, gcs_path: 'gs://bucket/documents/p.pdf' }] })
        .mockResolvedValueOnce({ rows: [] }); // delete

      mockDeleteFile.mockResolvedValueOnce(true);

      const res = await request(app)
        .delete(`/projects/${PID}/documents/${DOC_ID}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');
      expect(mockDeleteFile).toHaveBeenCalled();
    });

    it('forbids viewer from deleting document', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [viewerRow] });

      const res = await request(app)
        .delete(`/projects/${PID}/documents/${DOC_ID}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ── GET /projects/:pid/documents/:id/download ────────────────────────────────
  describe('GET /projects/:pid/documents/:id/download', () => {
    it('returns signed download URL for viewer', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [viewerRow] })
        .mockResolvedValueOnce({ rows: [{ id: DOC_ID, project_id: PID, gcs_path: 'gs://bucket/documents/file.pdf' }] });

      mockGetSignedDownloadUrl.mockResolvedValueOnce('http://storage-test/download/doc');

      const res = await request(app)
        .get(`/projects/${PID}/documents/${DOC_ID}/download`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.downloadUrl).toBe('http://storage-test/download/doc');
    });

    it('returns 404 if document does not exist', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [viewerRow] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`/projects/${PID}/documents/${DOC_ID}/download`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ── GET /projects/:pid/documents/search ─────────────────────────────────────
  describe('GET /projects/:pid/documents/search', () => {
    it('returns search results matching query', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [viewerRow] })
        .mockResolvedValueOnce({ rows: [{ id: DOC_ID, title: 'Attention is All You Need' }] });

      const res = await request(app)
        .get(`/projects/${PID}/documents/search?q=Attention`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.documents).toHaveLength(1);
    });

    it('returns empty array if q query parameter is blank', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [viewerRow] });

      const res = await request(app)
        .get(`/projects/${PID}/documents/search?q=   `)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.documents).toEqual([]);
    });
  });

  // ── Auth & Validation ────────────────────────────────────────────────────────
  describe('Authentication & Validation', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get(`/projects/${PID}/documents`);
      expect(res.status).toBe(401);
    });

    it('returns 400 for non-UUID parameter', async () => {
      const res = await request(app)
        .get('/projects/not-a-valid-uuid/documents')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(400);
    });

    it('allows professor role to bypass project role restrictions', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: DOC_ID, title: 'Prof Document' }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });

      const res = await request(app)
        .get(`/projects/${PID}/documents`)
        .set('Authorization', `Bearer ${profToken}`);

      expect(res.status).toBe(200);
    });
  });
});
