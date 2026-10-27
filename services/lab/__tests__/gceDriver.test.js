'use strict';

const mockInsert = jest.fn();
const mockDelete = jest.fn();
const mockGet = jest.fn();
const mockList = jest.fn();
const mockStart = jest.fn();

jest.mock('@google-cloud/compute', () => {
  return {
    InstancesClient: jest.fn().mockImplementation(() => ({
      insert: mockInsert,
      delete: mockDelete,
      get: mockGet,
      list: mockList,
      start: mockStart,
    })),
    ZoneOperationsClient: jest.fn().mockImplementation(() => ({})),
  };
});

const gceDriver = require('../src/drivers/gceDriver');

describe('GCE Compute Engine On-Demand Driver', () => {
  const sessionId = '11111111-2222-3333-4444-555555555555';
  const userId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GCP_PROJECT_ID = 'test-gcp-project';
    process.env.GCP_ZONE = 'us-central1-a';
  });

  describe('Tier resolution & naming', () => {
    it('generates compliant GCE instance names', () => {
      const name = gceDriver.instanceName(sessionId);
      expect(name).toMatch(/^rh-lab-[a-z0-9]+$/);
      expect(name.length).toBeLessThanOrEqual(63);
    });

    it('maps basic-cpu to e2-medium with 2h timeout', () => {
      const tier = gceDriver.resolveTier('basic-cpu');
      expect(tier.machineType).toBe('e2-medium');
      expect(tier.isGpu).toBe(false);
      expect(tier.maxRuntimeSeconds).toBe(7200);
    });

    it('maps ml-gpu / ai-ml-gpu to n4-standard-4 as high-performance CPU without GPU quota', () => {
      const tier = gceDriver.resolveTier('ml-gpu');
      expect(tier.machineType).toBe('n4-standard-4');
      expect(tier.fallbackMachineType).toBe('n2-standard-4');
      expect(tier.isGpu).toBe(false);
      expect(tier.gpuCount).toBe(0);
      expect(tier.gpuType).toBeNull();
      expect(tier.diskSizeGb).toBe(50);

      const aiTier = gceDriver.resolveTier('ai-ml-gpu');
      expect(aiTier.machineType).toBe('n4-standard-4');
      expect(aiTier.fallbackMachineType).toBe('n2-standard-4');
      expect(aiTier.isGpu).toBe(false);
    });

    it('maps dl-gpu-large / ai-ml-deep-learning to n4-standard-8 as high-performance CPU without GPU quota', () => {
      const tier = gceDriver.resolveTier('dl-gpu-large');
      expect(tier.machineType).toBe('n4-standard-8');
      expect(tier.fallbackMachineType).toBe('n2-standard-8');
      expect(tier.isGpu).toBe(false);
      expect(tier.gpuCount).toBe(0);
      expect(tier.gpuType).toBeNull();
      expect(tier.diskSizeGb).toBe(100);

      const dlTier = gceDriver.resolveTier('ai-ml-deep-learning');
      expect(dlTier.machineType).toBe('n4-standard-8');
      expect(dlTier.fallbackMachineType).toBe('n2-standard-8');
      expect(dlTier.isGpu).toBe(false);
    });

    it('resolves correct disk type depending on machine family', () => {
      expect(gceDriver.resolveDiskType('n4-standard-4')).toBe('hyperdisk-balanced');
      expect(gceDriver.resolveDiskType('n4-standard-8')).toBe('hyperdisk-balanced');
      expect(gceDriver.resolveDiskType('c3-standard-4')).toBe('hyperdisk-balanced');
      expect(gceDriver.resolveDiskType('e2-medium')).toBe('pd-balanced');
      expect(gceDriver.resolveDiskType('n2-standard-4')).toBe('pd-balanced');
      expect(gceDriver.resolveDiskType(null)).toBe('pd-balanced');
    });
  });

  describe('Startup Script generation', () => {
    it('generates startup script containing self-termination watchdog and jupyter token', () => {
      const script = gceDriver.generateStartupScript({
        sessionId: 'test-session-123',
        jupyterToken: 'secret_jupyter_token_xyz',
        maxRuntimeSeconds: 3600,
        isGpu: false,
      });

      expect(script).toContain('sleep 3600');
      expect(script).toContain('secret_jupyter_token_xyz');
      expect(script).toContain('SESSION_ID="test-session-123"');
      expect(script).toContain('--ServerApp.base_url="/api/lab/sessions/test-session-123/proxy/"');
      expect(script).toContain('--ServerApp.default_url="/lab"');
      expect(script).toContain('mkdir -p /opt/researchhub/work');
      expect(script).toContain('chown -R 1000:1000 /opt/researchhub/work');
      expect(script).toContain('-v /opt/researchhub/work:/home/jovyan/work');
      expect(script).toContain('jupyter/scipy-notebook:latest');
      expect(script).toContain('--ServerApp.ip=0.0.0.0');
      expect(script).toContain("frame-ancestors 'self' https://*.web.app https://*.run.app");
      expect(script).toContain('poweroff');
      expect(script).toContain('iptables -t nat -A PREROUTING');
    });
  });

  describe('Instance lifecycle', () => {
    it('provisions GCE instance and waits for public NAT IP', async () => {
      mockInsert.mockResolvedValueOnce([{ name: 'op-123' }]);
      mockGet.mockResolvedValueOnce([
        {
          status: 'RUNNING',
          networkInterfaces: [
            {
              accessConfigs: [{ natIP: '34.120.50.60' }],
            },
          ],
        },
      ]);

      const res = await gceDriver.create({
        sessionId,
        userId,
        profileKey: 'basic-cpu',
        jupyterToken: 'my-token',
        projectId: 'proj-123',
      });

      expect(mockInsert).toHaveBeenCalledTimes(1);
      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall.instanceResource.tags.items).toEqual(['researchhub-lab', 'http-server']);
      expect(insertCall.instanceResource.guestAccelerators).toBeUndefined();
      expect(insertCall.instanceResource.disks[0].initializeParams.diskType).toContain('pd-balanced');
      expect(insertCall.instanceResource.metadata.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'project-id', value: 'proj-123' }),
          expect.objectContaining({ key: 'session-token', value: 'my-token' }),
          expect.objectContaining({ key: 'api-internal-url' }),
        ])
      );
      expect(insertCall.instanceResource.serviceAccounts).toEqual([
        {
          email: 'default',
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        },
      ]);
      expect(res.url).toBe('http://34.120.50.60:8888');
      expect(res.port).toBe(8888);
      expect(res.containerName).toMatch(/^rh-lab-/);
    });

    it('provisions AI/ML high-performance CPU tier with hyperdisk-balanced and no guest accelerators', async () => {
      mockInsert.mockResolvedValueOnce([{ name: 'op-456' }]);
      mockGet.mockResolvedValueOnce([
        {
          status: 'RUNNING',
          networkInterfaces: [
            {
              accessConfigs: [{ natIP: '34.120.50.61' }],
            },
          ],
        },
      ]);

      const res = await gceDriver.create({
        sessionId,
        userId,
        profileKey: 'ml-gpu',
        jupyterToken: 'my-token',
      });

      expect(mockInsert).toHaveBeenCalledTimes(1);
      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall.instanceResource.machineType).toContain('n4-standard-4');
      expect(insertCall.instanceResource.disks[0].initializeParams.diskType).toContain('hyperdisk-balanced');
      expect(insertCall.instanceResource.guestAccelerators).toBeUndefined();
      expect(res.url).toBe('http://34.120.50.61:8888');
    });

    it('falls back to n2-standard-4 if n4-standard-4 insert fails', async () => {
      mockInsert.mockRejectedValueOnce(new Error('Machine type n4-standard-4 not available in zone'));
      mockInsert.mockResolvedValueOnce([{ name: 'op-fallback-789' }]);
      mockGet.mockResolvedValueOnce([
        {
          status: 'RUNNING',
          networkInterfaces: [
            {
              accessConfigs: [{ natIP: '34.120.50.62' }],
            },
          ],
        },
      ]);

      const res = await gceDriver.create({
        sessionId,
        userId,
        profileKey: 'ml-gpu',
        jupyterToken: 'my-token',
      });

      expect(mockInsert).toHaveBeenCalledTimes(2);
      const fallbackCall = mockInsert.mock.calls[1][0];
      expect(fallbackCall.instanceResource.machineType).toContain('n2-standard-4');
      expect(fallbackCall.instanceResource.disks[0].initializeParams.diskType).toContain('pd-balanced');
      expect(res.url).toBe('http://34.120.50.62:8888');
    });

    it('deletes GCE instance cleanly on stop (scale-to-zero)', async () => {
      mockDelete.mockResolvedValueOnce([{ name: 'op-delete-123' }]);

      const res = await gceDriver.deleteContainer(sessionId);
      expect(res).toBe(true);
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it('handles 404 gracefully when deleting an already deleted instance', async () => {
      mockDelete.mockRejectedValue(new Error('The resource was not found (404)'));

      const res = await gceDriver.deleteContainer(sessionId);
      expect(res).toBe(true);
    });

    it('returns normalized running status', async () => {
      mockGet.mockResolvedValueOnce([{ status: 'RUNNING' }]);

      const status = await gceDriver.status(sessionId);
      expect(status).toEqual({ status: 'RUNNING', ready: true });
    });

    it('returns STARTING and ready false if VM is RUNNING in GCE but port 8888 is not yet accepting connections', async () => {
      mockGet.mockResolvedValueOnce([
        {
          status: 'RUNNING',
          networkInterfaces: [
            { accessConfigs: [{ natIP: '127.0.0.1' }] }
          ]
        }
      ]);

      // Port 8888 on localhost is not listening or returns ECONNREFUSED in test, so status returns STARTING
      const status = await gceDriver.status(sessionId);
      expect(status).toEqual({ status: 'STARTING', ready: false });
    });

    it('returns PROVISIONING and ready false if VM is RUNNING in GCE but external NAT IP is not yet assigned', async () => {
      mockGet.mockResolvedValueOnce([
        {
          status: 'RUNNING',
          networkInterfaces: [
            { networkIP: '10.128.0.2', accessConfigs: [] }
          ]
        }
      ]);

      const status = await gceDriver.status(sessionId);
      expect(status).toEqual({ status: 'PROVISIONING', ready: false });
    });

    it('supports direct instanceName parameter as well as sessionId', async () => {
      mockGet.mockResolvedValueOnce([{ status: 'RUNNING' }]);

      const status = await gceDriver.status('rh-lab-1111222233334444');
      expect(status).toEqual({ status: 'RUNNING', ready: true });
    });

    it('returns not_found when instance does not exist', async () => {
      mockGet.mockRejectedValue(new Error('404 Not Found'));

      const status = await gceDriver.status(sessionId);
      expect(status).toEqual({ status: 'NOT_FOUND', ready: false });
    });

    it('lists active lab instances with label filters', async () => {
      mockList.mockResolvedValueOnce([
        [
          {
            name: 'rh-lab-11111111',
            status: 'RUNNING',
            labels: { 'session-id': sessionId },
          },
        ],
      ]);

      const list = await gceDriver.list();
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('rh-lab-11111111');
      expect(list[0].sessionId).toBe(sessionId);
    });

    it('starts stopped GCE instance cleanly', async () => {
      mockStart.mockResolvedValueOnce([{ name: 'op-start-123' }]);
      mockGet.mockResolvedValueOnce([
        {
          status: 'RUNNING',
          networkInterfaces: [
            { accessConfigs: [{ natIP: '34.120.50.99' }] },
          ],
        },
      ]);

      const res = await gceDriver.startContainer(sessionId);
      expect(res.containerName).toMatch(/^rh-lab-/);
      expect(res.url).toBe('http://34.120.50.99:8888');
      expect(mockStart).toHaveBeenCalledTimes(1);
    });

    it('handles 404 when startContainer target does not exist in any zone', async () => {
      mockStart.mockRejectedValue(new Error('The resource was not found (404)'));

      await expect(gceDriver.startContainer(sessionId)).rejects.toThrow('not found in zones');
    });
  });
});
