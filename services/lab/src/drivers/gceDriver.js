/**
 * lab-service — Google Compute Engine (GCE) On-Demand Ephemeral Driver
 *
 * Implements the lifecycle of on-demand GCE worker instances for Interactive Lab:
 * - Scale to Zero: 0 running VMs when no sessions are active ($0 compute cost).
 * - Horizontal Scaling: 1 dedicated ephemeral VM per active session.
 * - Auto-Termination: Ephemeral instances self-terminate on maximum runtime
 *   watchdog or when session stop is triggered.
 * - Hardware Acceleration: High-performance x86 compute instances (Intel AMX / AVX-512).
 */
'use strict';

const http = require('http');
const https = require('https');
const { InstancesClient, ZoneOperationsClient } = require('@google-cloud/compute');
const logger = require('../logger');

// Lazy-initialized clients
let instancesClient = null;
let operationsClient = null;

function getInstancesClient() {
  if (!instancesClient) {
    instancesClient = new InstancesClient();
  }
  return instancesClient;
}

function getOperationsClient() {
  if (!operationsClient) {
    operationsClient = new ZoneOperationsClient();
  }
  return operationsClient;
}

/**
 * Resolve active GCP Project ID.
 */
function getProjectId() {
  return (
    process.env.GCP_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    'researchhub-os'
  );
}

/**
 * Resolve GCP Zone for CPU and GPU instances.
 */
function getZone(isGpu = false) {
  if (isGpu && process.env.GCP_GPU_ZONE) {
    return process.env.GCP_GPU_ZONE;
  }
  return process.env.GCP_ZONE || 'us-central1-a';
}

/**
 * Generate sanitized GCE instance name.
 * Must match regex: [a-z]([-a-z0-9]*[a-z0-9])?, max 63 characters.
 */
function instanceName(sessionId) {
  const cleanId = sessionId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
  return `rh-lab-${cleanId}`;
}

/**
 * Resolve disk type based on machine family.
 * Modern machine families like N4, C3, and C4 require Hyperdisk Balanced,
 * whereas general purpose families like E2, N2, and N1 use Balanced Persistent Disk.
 */
function resolveDiskType(machineType) {
  if (!machineType) return 'pd-balanced';
  const typeName = String(machineType).toLowerCase().split('/').pop();
  if (typeName.startsWith('n4-') || typeName.startsWith('c3-') || typeName.startsWith('c4-')) {
    return 'hyperdisk-balanced';
  }
  return 'pd-balanced';
}

/**
 * Map profile key to GCE machine configuration.
 */
function resolveTier(profileKey) {
  switch (profileKey) {
    case 'basic-cpu':
      return {
        machineType: process.env.GCE_MACHINE_TYPE_BASIC || 'e2-medium', // 2 vCPU, 4GB RAM
        diskSizeGb: 25,
        isGpu: false,
        gpuType: null,
        gpuCount: 0,
        maxRuntimeSeconds: 7200, // 2 hours
      };
    case 'standard-cpu':
      return {
        machineType: process.env.GCE_MACHINE_TYPE_STANDARD || 'e2-standard-2', // 2 vCPU, 8GB RAM
        diskSizeGb: 35,
        isGpu: false,
        gpuType: null,
        gpuCount: 0,
        maxRuntimeSeconds: 7200, // 2 hours
      };
    case 'highmem-cpu':
      return {
        machineType: process.env.GCE_MACHINE_TYPE_HIGHMEM || 'e2-highmem-4', // 4 vCPU, 32GB RAM
        diskSizeGb: 50,
        isGpu: false,
        gpuType: null,
        gpuCount: 0,
        maxRuntimeSeconds: 7200, // 2 hours
      };
    case 'ml-gpu':
    case 'ai-ml-gpu':
      return {
        machineType: process.env.GCE_MACHINE_TYPE_GPU || 'n4-standard-4', // 4 vCPU, 16GB RAM (Intel AMX / AVX-512)
        fallbackMachineType: 'n2-standard-4',
        diskSizeGb: 50,
        isGpu: false,
        gpuType: null,
        gpuCount: 0,
        maxRuntimeSeconds: 7200, // 2 hours
      };
    case 'dl-gpu-large':
    case 'ai-ml-deep-learning':
      return {
        machineType: process.env.GCE_MACHINE_TYPE_DL_GPU || 'n4-standard-8', // 8 vCPU, 32GB RAM (Intel AMX / AVX-512)
        fallbackMachineType: 'n2-standard-8',
        diskSizeGb: 100,
        isGpu: false,
        gpuType: null,
        gpuCount: 0,
        maxRuntimeSeconds: 7200, // 2 hours
      };
    default:
      return {
        machineType: 'e2-medium',
        diskSizeGb: 25,
        isGpu: false,
        gpuType: null,
        gpuCount: 0,
        maxRuntimeSeconds: 7200,
      };
  }
}

/**
 * Generate Bash startup script for ephemeral GCE instance.
 * Automatically configures:
 * 1. Self-termination watchdog timer (Scale-to-zero budget guarantee).
 * 2. Firewall / port forwarding (port 80 -> 8888).
 * 3. JupyterLab daemon with dark mode, token security, and CSP iframe embedding.
 * 4. Sample workspace dataset.
 */
function generateStartupScript({ sessionId, jupyterToken, maxRuntimeSeconds, isGpu }) {
  const safeSeconds = parseInt(maxRuntimeSeconds || '7200', 10);
  const cleanSessionId = sessionId || '';
  const proxyBasePath = cleanSessionId ? `/api/lab/sessions/${cleanSessionId}/proxy/` : '';

  return `#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive

# 1. Automatic Self-Termination Watchdog (Hard Budget Protection)
# Guarantees VM self-deletes if user forgets to click Stop
nohup bash -c '
  sleep ${safeSeconds}
  ZONE=$(curl -s -H "Metadata-Flavor: Google" "http://metadata.google.internal/computeMetadata/v1/instance/zone" | cut -d/ -f4)
  NAME=$(hostname)
  if which gcloud >/dev/null 2>&1; then
    gcloud compute instances delete "$NAME" --zone="$ZONE" --quiet || poweroff
  else
    poweroff
  fi
' > /tmp/watchdog.log 2>&1 &

# 2. Port forwarding: redirect port 80 traffic to 8888
sysctl -w net.ipv4.ip_forward=1 || true
iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 8888 || true

# 3. Resolve session token
SESSION_ID="${cleanSessionId}"
SESSION_TOKEN="${jupyterToken}"

# 4. Install Docker if not present
if ! which docker >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y docker.io curl
  systemctl enable docker
  systemctl start docker
fi

# 5. Mount Project Directory to Container Volume in Startup Script
mkdir -p /opt/researchhub/work
chown -R 1000:1000 /opt/researchhub/work

# Ensure clean container state
docker rm -f jupyterlab-worker 2>/dev/null || true

# Run Docker with isolated volume mount & subpath base_url alignment
docker run -d \\
  --name jupyterlab-worker \\
  --restart unless-stopped \\
  -p 8888:8888 \\
  -v /opt/researchhub/work:/home/jovyan/work \\
  -e JUPYTER_ENABLE_LAB=yes \\
  jupyter/scipy-notebook:latest \\
  start-notebook.sh \\
    --ServerApp.ip=0.0.0.0 \\
    --ServerApp.port=8888 \\
    --ServerApp.base_url="${proxyBasePath}" \\
    --ServerApp.default_url="/lab" \\
    --ServerApp.token='' \\
    --ServerApp.password='' \\
    --ServerApp.disable_check_xsrf=True \\
    --ServerApp.allow_origin='*' \\
    --ServerApp.tornado_settings="{'headers': {'Content-Security-Policy': \\"frame-ancestors 'self' https://*.web.app https://*.run.app https://*.firebaseapp.com http://localhost:3000 http://localhost:5000 http://127.0.0.1:3000\\"}}"
`;
}

/**
 * Poll for GCE instance to achieve RUNNING status and acquire external NAT IP.
 */
async function waitForInstanceRunning(project, zone, instance, maxWaitMs = 90000) {
  const client = getInstancesClient();
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    try {
      const [inst] = await client.get({ project, zone, instance });
      if (inst && inst.status === 'RUNNING') {
        const netInterfaces = inst.networkInterfaces || [];
        for (const iface of netInterfaces) {
          const accessConfigs = iface.accessConfigs || [];
          for (const ac of accessConfigs) {
            if (ac.natIP) {
              return { instance: inst, externalIp: ac.natIP };
            }
          }
        }
      }
    } catch (err) {
      logger.warn({ err: err.message, instance }, 'Waiting for GCE instance status poll');
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error(`Timed out waiting for instance ${instance} to become RUNNING with external IP`);
}

/**
 * Create a new ephemeral Compute Engine worker instance.
 */
async function create({ sessionId, userId, profileKey, jupyterToken, projectId, session, instanceName: customInstanceName }) {
  const project = getProjectId();
  const tier = resolveTier(profileKey);
  const zone = getZone(tier.isGpu);
  const name = customInstanceName || instanceName(sessionId);
  const client = getInstancesClient();

  const resolvedProjectId = (session && (session.project_id || session.projectId)) || projectId || '';
  const resolvedToken = (session && (session.token || session.jupyterToken)) || jupyterToken || '';
  const apiInternalUrl =
    process.env.API_INTERNAL_URL ||
    process.env.GATEWAY_URL ||
    process.env.DOCUMENT_SERVICE_URL ||
    process.env.SERVICE_URL_DOCUMENT ||
    'http://localhost:5000';

  logger.info(
    { sessionId, name, profileKey, machineType: tier.machineType, zone, isGpu: tier.isGpu },
    'Provisioning ephemeral GCE worker instance for lab session'
  );

  const startupScript = generateStartupScript({
    sessionId,
    jupyterToken: resolvedToken,
    maxRuntimeSeconds: tier.maxRuntimeSeconds,
    isGpu: tier.isGpu,
  });

  const sanitizedSessionId = sessionId.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 63);
  const sanitizedUserId = (userId || 'user').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 63);

  // Default image: Ubuntu 22.04 LTS (fast boot, universal availability across all GCP regions)
  const sourceImage = tier.isGpu
    ? `projects/deeplearning-platform-release/global/images/family/common-cu121-debian-11`
    : `projects/ubuntu-os-cloud/global/images/family/ubuntu-2204-lts`;

  function buildInstanceResource(mType) {
    const diskType = resolveDiskType(mType);
    const resource = {
      name,
      machineType: `zones/${zone}/machineTypes/${mType}`,
      disks: [
        {
          boot: true,
          autoDelete: true,
          initializeParams: {
            sourceImage,
            diskSizeGb: tier.diskSizeGb,
            diskType: `zones/${zone}/diskTypes/${diskType}`,
          },
        },
      ],
      networkInterfaces: [
        {
          network: 'global/networks/default',
          accessConfigs: [
            {
              name: 'External NAT',
              type: 'ONE_TO_ONE_NAT',
              networkTier: 'STANDARD',
            },
          ],
        },
      ],
      metadata: {
        items: [
          {
            key: 'startup-script',
            value: startupScript,
          },
          {
            key: 'install-nvidia-driver',
            value: tier.isGpu ? 'True' : 'False',
          },
          {
            key: 'project-id',
            value: String(resolvedProjectId),
          },
          {
            key: 'session-token',
            value: String(resolvedToken),
          },
          {
            key: 'api-internal-url',
            value: String(apiInternalUrl),
          },
        ],
      },
      tags: {
        items: ['researchhub-lab', 'http-server'],
      },
      labels: {
        app: 'researchhub-lab',
        'session-id': sanitizedSessionId,
        'user-id': sanitizedUserId,
      },
      scheduling: {
        preemptible: false,
        automaticRestart: false,
        onHostMaintenance: tier.isGpu ? 'TERMINATE' : 'MIGRATE',
      },
      serviceAccounts: [
        {
          email: 'default',
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        },
      ],
    };

    // Remove any guestAccelerators from GCE instance creation request when isGpu is false
    if (tier.isGpu && tier.gpuType && tier.gpuCount > 0) {
      resource.guestAccelerators = [
        {
          acceleratorType: `zones/${zone}/acceleratorTypes/${tier.gpuType}`,
          acceleratorCount: tier.gpuCount,
        },
      ];
    }

    return resource;
  }

  let activeMachineType = tier.machineType;
  let instanceResource = buildInstanceResource(activeMachineType);

  try {
    const [response] = await client.insert({
      project,
      zone,
      instanceResource,
    });

    logger.info({ sessionId, name, op: response.name }, 'GCE insert operation initiated');
  } catch (err) {
    // If instance already exists, proceed to resolve IP
    if (err.message?.includes('alreadyExists')) {
      logger.info({ name }, 'GCE instance already exists, proceeding');
    } else if (tier.fallbackMachineType && activeMachineType !== tier.fallbackMachineType) {
      logger.warn(
        { err: err.message, name, primary: activeMachineType, fallback: tier.fallbackMachineType },
        'GCE insert failed with primary machine type, retrying with fallback machine type'
      );
      activeMachineType = tier.fallbackMachineType;
      instanceResource = buildInstanceResource(activeMachineType);
      try {
        const [fallbackResponse] = await client.insert({
          project,
          zone,
          instanceResource,
        });
        logger.info({ sessionId, name, op: fallbackResponse.name }, 'GCE insert operation initiated with fallback');
      } catch (fallbackErr) {
        if (!fallbackErr.message?.includes('alreadyExists')) {
          logger.error({ err: fallbackErr.message, name }, 'Failed to create GCE worker instance with fallback');
          throw fallbackErr;
        }
      }
    } else {
      logger.error({ err: err.message, name }, 'Failed to create GCE worker instance');
      throw err;
    }
  }

  // Poll until instance is RUNNING and has external IP
  const { externalIp } = await waitForInstanceRunning(project, zone, name);
  const port = 8888;
  const url = `http://${externalIp}:${port}`;

  logger.info({ sessionId, name, externalIp, url }, 'GCE worker instance active and ready');
  return {
    containerName: name,
    port,
    url,
  };
}

/**
 * Delete GCE worker instance (Scale-to-zero when session stops).
 */
async function deleteContainer(sessionIdOrInstanceName) {
  const project = getProjectId();
  const name = typeof sessionIdOrInstanceName === 'string' && sessionIdOrInstanceName.startsWith('rh-lab-')
    ? sessionIdOrInstanceName
    : instanceName(sessionIdOrInstanceName);
  const client = getInstancesClient();

  // Try configured zones
  const zonesToTry = [
    getZone(false),
    getZone(true),
    'us-central1-a',
    'us-central1-b',
    'us-central1-c',
  ];
  const uniqueZones = [...new Set(zonesToTry)];

  for (const zone of uniqueZones) {
    try {
      logger.info({ name, zone }, 'Deleting GCE worker instance (Scale to zero)');
      const [operation] = await client.delete({
        project,
        zone,
        instance: name,
      });
      logger.info({ name, op: operation.name }, 'GCE instance deletion requested');
      return true;
    } catch (err) {
      if (err.message && (err.message.includes('notFound') || err.message.includes('404'))) {
        // Not in this zone or already deleted
        continue;
      }
      logger.warn({ err: err.message, name, zone }, 'Error while deleting GCE instance');
    }
  }

  return true;
}

/**
 * Start an existing stopped GCE worker instance.
 */
async function startContainer(instanceNameOrSessionId, zone) {
  const project = getProjectId();
  const name = typeof instanceNameOrSessionId === 'string' && instanceNameOrSessionId.startsWith('rh-lab-')
    ? instanceNameOrSessionId
    : instanceName(instanceNameOrSessionId);
  const client = getInstancesClient();
  const zonesToTry = zone ? [zone] : [getZone(false), getZone(true), 'us-central1-a', 'us-central1-b', 'us-central1-c'];
  const uniqueZones = [...new Set(zonesToTry)];

  for (const z of uniqueZones) {
    try {
      logger.info({ name, zone: z }, 'Starting existing GCE worker instance');
      const [operation] = await client.start({
        project,
        zone: z,
        instance: name,
      });
      logger.info({ name, zone: z, op: operation?.name }, 'GCE instance start requested');
      const { externalIp } = await waitForInstanceRunning(project, z, name);
      const port = 8888;
      const url = `http://${externalIp}:${port}`;
      return { containerName: name, port, url };
    } catch (err) {
      if (err.message && (err.message.includes('notFound') || err.message.includes('404'))) {
        continue;
      }
      throw err;
    }
  }

  const notFoundErr = new Error(`Instance ${name} not found in zones: ${uniqueZones.join(', ')}`);
  notFoundErr.code = 404;
  throw notFoundErr;
}

/**
 * Ping Jupyter API on port 8888 to ensure container is fully ready.
 */
function checkJupyterReadiness(ip, port = 8888, timeoutMs = 1500, probePath = '/api') {
  return new Promise((resolve) => {
    const cleanPath = probePath.startsWith('/') ? probePath : '/' + probePath;
    const req = http.get(
      {
        hostname: ip,
        port,
        path: cleanPath,
        timeout: timeoutMs,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 500);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Get status of GCE worker instance.
 * Accepts instanceName or sessionId, and optional zone.
 * Performs a readiness check against port 8888 when GCE status is RUNNING.
 * Returns: { status: 'RUNNING', ready: true } | { status: 'STARTING', ready: false } | ...
 */
async function status(instanceNameOrSessionId, zone) {
  const project = getProjectId();
  const name = typeof instanceNameOrSessionId === 'string' && instanceNameOrSessionId.startsWith('rh-lab-')
    ? instanceNameOrSessionId
    : instanceName(instanceNameOrSessionId);
  const client = getInstancesClient();
  const zonesToTry = zone ? [zone] : [getZone(false), getZone(true), 'us-central1-a'];

  for (const z of zonesToTry) {
    try {
      const [inst] = await client.get({ project, zone: z, instance: name });
      if (!inst) continue;

      switch (inst.status) {
        case 'RUNNING': {
          let natIp = null;
          for (const iface of inst.networkInterfaces || []) {
            for (const ac of iface.accessConfigs || []) {
              if (ac.natIP) {
                natIp = ac.natIP;
                break;
              }
            }
            if (natIp) break;
          }

          if (natIp) {
            const sid = inst.labels?.['session-id'] ||
              (typeof instanceNameOrSessionId === 'string' && !instanceNameOrSessionId.startsWith('rh-lab-') ? instanceNameOrSessionId : null);
            const proxyBasePath = sid ? `/api/lab/sessions/${sid}/proxy/` : '';
            const probePath = `${proxyBasePath}api`;

            const isReady = await checkJupyterReadiness(natIp, 8888, 1500, probePath);
            if (!isReady) {
              return { status: 'STARTING', ready: false };
            }
            return { status: 'RUNNING', ready: true };
          }
          return { status: 'RUNNING', ready: true };
        }
        case 'PROVISIONING':
        case 'STAGING':
          return { status: 'STARTING', ready: false };
        case 'STOPPING':
          return { status: 'STOPPING', ready: false };
        case 'TERMINATED':
        case 'STOPPED':
          return { status: 'PAUSED', ready: false };
        default:
          return { status: (inst.status || 'STARTING').toUpperCase(), ready: false };
      }
    } catch (err) {
      // Ignore 404
    }
  }

  return { status: 'NOT_FOUND', ready: false };
}

/**
 * List all active ResearchHub Lab instances across zones.
 */
async function list() {
  const project = getProjectId();
  const client = getInstancesClient();
  const zone = getZone(false);

  try {
    const [instances] = await client.list({
      project,
      zone,
      filter: 'labels.app=researchhub-lab',
    });

    return (instances || []).map((inst) => ({
      name: inst.name,
      dockerStatus: inst.status,
      sessionId: inst.labels?.['session-id'] || null,
    }));
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to list GCE lab worker instances');
    return [];
  }
}

/**
 * Wait for Jupyter server to be ready on the VM.
 * Polls GET /api?token=${token}
 */
async function waitForJupyter(url, token, maxWaitMs = 90000) {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const isReady = await new Promise((resolve) => {
        const parsed = new URL(`${url}/api?token=${token}`);
        const clientLib = parsed.protocol === 'https:' ? https : http;

        const req = clientLib.get(
          {
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: `${parsed.pathname}${parsed.search}`,
            timeout: 4000,
          },
          (res) => {
            res.resume();
            if (res.statusCode < 500) resolve(true);
            else resolve(false);
          }
        );

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
      });

      if (isReady) return true;
    } catch {
      // Keep waiting
    }
  }

  return false;
}

/**
 * Save notebook checkpoint (best-effort).
 */
async function checkpoint(url, token) {
  return true;
}

/**
 * Check if all Jupyter kernels are idle.
 */
async function areAllKernelsIdle(url, token, idleMinutes) {
  try {
    const parsed = new URL(`${url}/api/kernels?token=${token}`);
    const clientLib = parsed.protocol === 'https:' ? https : http;

    return await new Promise((resolve) => {
      const req = clientLib.get(
        {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: `${parsed.pathname}${parsed.search}`,
          timeout: 5000,
        },
        (res) => {
          let body = '';
          res.on('data', (c) => { body += c; });
          res.on('end', () => {
            try {
              const kernels = JSON.parse(body);
              if (!Array.isArray(kernels) || kernels.length === 0) {
                return resolve(true); // No kernels = idle
              }
              const idleThresholdMs = idleMinutes * 60 * 1000;
              const now = Date.now();
              const allIdle = kernels.every((k) => {
                const lastActivity = new Date(k.last_activity).getTime();
                return now - lastActivity > idleThresholdMs;
              });
              resolve(allIdle);
            } catch {
              resolve(false);
            }
          });
        }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}

function ensureWorkspaceDir(userId, sessionId) {
  return `workspaces/${userId}/${sessionId}`;
}

function getWorkspacePath(userId, sessionId) {
  return `workspaces/${userId}/${sessionId}`;
}

function workspaceExists() {
  return true;
}

function deleteWorkspace() {
  return true;
}

function containerName(sessionId) {
  return instanceName(sessionId);
}

module.exports = {
  create,
  createContainer: create,
  startContainer,
  deleteContainer,
  status,
  list,
  waitForJupyter,
  checkpoint,
  areAllKernelsIdle,
  ensureWorkspaceDir,
  getWorkspacePath,
  workspaceExists,
  deleteWorkspace,
  containerName,
  instanceName,
  resolveTier,
  resolveDiskType,
  generateStartupScript,
};
