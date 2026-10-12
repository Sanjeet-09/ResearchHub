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
const app = require('../src/app');

describe('Publication Service', () => {
  const PID = '10000000-0000-0000-0000-000000000001';
  const PUB_ID = '20000000-0000-0000-0000-000000000001';
  const EXP_ID = '30000000-0000-0000-0000-000000000001';
  const DS_ID = '40000000-0000-0000-0000-000000000001';
  const DOC_ID = '50000000-0000-0000-0000-000000000001';

  const leadUserId = '60000000-0000-0000-0000-000000000001';
  const memberUserId = '70000000-0000-0000-0000-000000000002';
  const viewerUserId = '80000000-0000-0000-0000-000000000003';
  const nonMemberUserId = '90000000-0000-0000-0000-000000000004';

  const leadToken = jwt.sign({ sub: leadUserId, role: 'student', name: 'Lead User' }, JWT_SECRET);
  const memberToken = jwt.sign({ sub: memberUserId, role: 'student', name: 'Member User' }, JWT_SECRET);
  const viewerToken = jwt.sign({ sub: viewerUserId, role: 'student', name: 'Viewer User' }, JWT_SECRET);
  const nonMemberToken = jwt.sign({ sub: nonMemberUserId, role: 'student', name: 'NonMember User' }, JWT_SECRET);
  const profToken = jwt.sign({ sub: leadUserId, role: 'professor', name: 'Prof User' }, JWT_SECRET);

  const leadRow = { project_role: 'lead' };
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
      expect(res.body).toMatchObject({ status: 'ok', service: 'publication-service' });
    });
  });

  // ── GET /projects/:pid/publications ─────────────────────────────────────────
  describe('GET /projects/:pid/publications', () => {
    it('forbids non-members from viewing publications', async () => {
      mockQuery.mockResolvedValueOnce(nonMemberRes);

      const res = await request(app)
        .get(`/projects/${PID}/publications`)
        .set('Authorization', `Bearer ${nonMemberToken}`);

      expect(res.status).toBe(403);
    });

    it('returns publication list for viewer with link counts', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [viewerRow] }) // requireProjectRole
        .mockResolvedValueOnce({
          rows: [
            {
              id: PUB_ID,
              title: 'Attention is All You Need',
              status: 'published',
              link_count: '3',
            },
          ],
        });

      const res = await request(app)
        .get(`/projects/${PID}/publications`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.publications).toHaveLength(1);
      expect(res.body.publications[0].link_count).toBe('3');
    });
  });

  // ── POST /projects/:pid/publications ────────────────────────────────────────
  describe('POST /projects/:pid/publications', () => {
    it('creates publication for member', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [memberRow] }) // requireProjectRole
        .mockResolvedValueOnce({
          rows: [
            {
              id: PUB_ID,
              project_id: PID,
              title: 'Novel Transformer Architecture',
              authors: 'Researcher A',
              venue: 'NeurIPS 2026',
              status: 'submitted',
            },
          ],
        });

      const res = await request(app)
        .post(`/projects/${PID}/publications`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Novel Transformer Architecture',
          authors: 'Researcher A',
          venue: 'NeurIPS 2026',
          status: 'submitted',
        });

      expect(res.status).toBe(201);
      expect(res.body.publication.id).toBe(PUB_ID);
      expect(res.body.publication.venue).toBe('NeurIPS 2026');
    });

    it('forbids viewer from creating publication', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [viewerRow] });

      const res = await request(app)
        .post(`/projects/${PID}/publications`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ title: 'Draft Paper' });

      expect(res.status).toBe(403);
    });

    it('returns 400 when title is missing', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [memberRow] });

      const res = await request(app)
        .post(`/projects/${PID}/publications`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ venue: 'ICLR' });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /projects/:pid/publications/:id ─────────────────────────────────────
  describe('GET /projects/:pid/publications/:id', () => {
    it('returns publication details and links for viewer', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [viewerRow] }) // requireProjectRole
        .mockResolvedValueOnce({
          rows: [{ id: PUB_ID, project_id: PID, title: 'Paper Detail' }],
        })
        .mockResolvedValueOnce({
          rows: [{ publication_id: PUB_ID, entity_type: 'experiment', entity_id: EXP_ID }],
        });

      const res = await request(app)
        .get(`/projects/${PID}/publications/${PUB_ID}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.publication.title).toBe('Paper Detail');
      expect(res.body.links).toHaveLength(1);
    });

    it('returns 404 for non-existent publication', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [viewerRow] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`/projects/${PID}/publications/${PUB_ID}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /projects/:pid/publications/:id ───────────────────────────────────
  describe('PATCH /projects/:pid/publications/:id', () => {
    it('updates publication metadata for member', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [memberRow] })
        .mockResolvedValueOnce({ rows: [{ id: PUB_ID, project_id: PID, title: 'Old Title', status: 'draft' }] })
        .mockResolvedValueOnce({ rows: [{ id: PUB_ID, project_id: PID, title: 'Updated Title', status: 'accepted' }] });

      const res = await request(app)
        .patch(`/projects/${PID}/publications/${PUB_ID}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: 'Updated Title', status: 'accepted' });

      expect(res.status).toBe(200);
      expect(res.body.publication.status).toBe('accepted');
    });

    it('forbids viewer from updating publication', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [viewerRow] });

      const res = await request(app)
        .patch(`/projects/${PID}/publications/${PUB_ID}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ title: 'Attempted Update' });

      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /projects/:pid/publications/:id ───────────────────────────────────
  describe('DELETE /projects/:pid/publications/:id', () => {
    it('allows lead to delete publication', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [leadRow] }) // requireProjectRole('lead')
        .mockResolvedValueOnce({ rows: [{ id: PUB_ID, project_id: PID }] }) // check exists
        .mockResolvedValueOnce({ rows: [] }); // delete

      const res = await request(app)
        .delete(`/projects/${PID}/publications/${PUB_ID}`)
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');
    });

    it('forbids regular member from deleting publication (lead required)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [memberRow] }); // requireProjectRole('lead') -> member fails

      const res = await request(app)
        .delete(`/projects/${PID}/publications/${PUB_ID}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ── POST /projects/:pid/publications/:id/links ──────────────────────────────
  describe('POST /projects/:pid/publications/:id/links (addLink)', () => {
    it('links an experiment to publication for member', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [memberRow] }) // requireProjectRole
        .mockResolvedValueOnce({ rows: [{ id: PUB_ID, project_id: PID }] }) // pub check
        .mockResolvedValueOnce({ rows: [{ id: EXP_ID }] }) // experiment check
        .mockResolvedValueOnce({ rows: [] }); // insert link

      const res = await request(app)
        .post(`/projects/${PID}/publications/${PUB_ID}/links`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          entityType: 'experiment',
          entityId: EXP_ID,
        });

      expect(res.status).toBe(201);
      expect(res.body.link.entityType).toBe('experiment');
    });

    it('links a dataset to publication via direct route /publications/:id/links', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: PUB_ID, project_id: PID }] }) // pub check
        .mockResolvedValueOnce({ rows: [memberRow] }) // member check on project
        .mockResolvedValueOnce({ rows: [{ id: DS_ID }] }) // dataset check in project
        .mockResolvedValueOnce({ rows: [] }); // insert link

      const res = await request(app)
        .post(`/publications/${PUB_ID}/links`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          entityType: 'dataset',
          entityId: DS_ID,
        });

      expect(res.status).toBe(201);
      expect(res.body.link.entityType).toBe('dataset');
    });

    it('returns 404 if linked entity does not belong to the project', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [memberRow] })
        .mockResolvedValueOnce({ rows: [{ id: PUB_ID, project_id: PID }] })
        .mockResolvedValueOnce({ rows: [] }); // entity not found in project

      const res = await request(app)
        .post(`/projects/${PID}/publications/${PUB_ID}/links`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          entityType: 'experiment',
          entityId: EXP_ID,
        });

      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid entityType', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [memberRow] });

      const res = await request(app)
        .post(`/projects/${PID}/publications/${PUB_ID}/links`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          entityType: 'invalid_type',
          entityId: EXP_ID,
        });

      expect(res.status).toBe(400);
    });
  });

  // ── DELETE /projects/:pid/publications/:id/links ────────────────────────────
  describe('DELETE /projects/:pid/publications/:id/links (removeLink)', () => {
    it('removes a link for member', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [memberRow] })
        .mockResolvedValueOnce({ rows: [{ id: PUB_ID, project_id: PID }] })
        .mockResolvedValueOnce({ rows: [] }); // delete link

      const res = await request(app)
        .delete(`/projects/${PID}/publications/${PUB_ID}/links`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          entityType: 'experiment',
          entityId: EXP_ID,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('removed');
    });
  });

  // ── GET /projects/:pid/publications/:id/trace ────────────────────────────────
  describe('GET /projects/:pid/publications/:id/trace (getTrace)', () => {
    it('returns full trace view with all linked experiments, datasets, and documents', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [viewerRow] }) // requireProjectRole
        .mockResolvedValueOnce({
          rows: [{ id: PUB_ID, project_id: PID, title: 'Traceable Paper' }],
        }) // pub check
        .mockResolvedValueOnce({
          rows: [
            { publication_id: PUB_ID, entity_type: 'experiment', entity_id: EXP_ID },
            { publication_id: PUB_ID, entity_type: 'dataset', entity_id: DS_ID },
            { publication_id: PUB_ID, entity_type: 'document', entity_id: DOC_ID },
          ],
        }) // links
        .mockResolvedValueOnce({
          rows: [{ id: EXP_ID, title: 'Experiment 1', status: 'completed' }],
        }) // exp query
        .mockResolvedValueOnce({
          rows: [{ id: DS_ID, title: 'Dataset Alpha', version_count: '2' }],
        }) // ds query
        .mockResolvedValueOnce({
          rows: [{ id: DOC_ID, title: 'Document A', doc_type: 'pdf', size_bytes: '5000' }],
        }); // doc query

      const res = await request(app)
        .get(`/projects/${PID}/publications/${PUB_ID}/trace`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.trace.experiments).toHaveLength(1);
      expect(res.body.trace.datasets).toHaveLength(1);
      expect(res.body.trace.documents).toHaveLength(1);
      expect(res.body.trace.experiments[0].title).toBe('Experiment 1');
      expect(res.body.trace.datasets[0].title).toBe('Dataset Alpha');
      expect(res.body.trace.documents[0].title).toBe('Document A');
    });

    it('works via direct /publications/:id/trace endpoint', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: PUB_ID, project_id: PID, title: 'Direct Trace Paper' }],
        }) // pub query
        .mockResolvedValueOnce({ rows: [viewerRow] }) // member check on project
        .mockResolvedValueOnce({ rows: [] }); // links query

      const res = await request(app)
        .get(`/publications/${PUB_ID}/trace`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.publication.title).toBe('Direct Trace Paper');
      expect(res.body.trace.experiments).toEqual([]);
    });

    it('forbids non-member on direct trace endpoint', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: PUB_ID, project_id: PID, title: 'Secret Paper' }],
        })
        .mockResolvedValueOnce(nonMemberRes); // not a member

      const res = await request(app)
        .get(`/publications/${PUB_ID}/trace`)
        .set('Authorization', `Bearer ${nonMemberToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ── Authentication & Validation ─────────────────────────────────────────────
  describe('Authentication & Validation', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get(`/projects/${PID}/publications`);
      expect(res.status).toBe(401);
    });

    it('returns 400 for non-UUID project id', async () => {
      const res = await request(app)
        .get('/projects/invalid-id/publications')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(400);
    });

    it('allows professor role to bypass project checks', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: PUB_ID, title: 'Prof Paper' }],
      });

      const res = await request(app)
        .get(`/projects/${PID}/publications`)
        .set('Authorization', `Bearer ${profToken}`);

      expect(res.status).toBe(200);
    });
  });
});
