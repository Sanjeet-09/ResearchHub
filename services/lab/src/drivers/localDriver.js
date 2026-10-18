/**
 * lab-service — Local Docker Driver
 *
 * Implements the same create/delete/status/list interface as the cloudrun driver.
 * Uses `docker` CLI via child_process (no Docker SDK dependency).
 *
 * Container naming: lab-<sessionId8>
 * Workspace: LABS_LOCAL_DIR/<userId>/<sessionId>/
 * Jupyter token is passed as env var JUPYTER_TOKEN
 * Port: dynamically assigned, stored in session record
 */
'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const logger = require('../logger');
const {
  startEmbeddedServer,
  stopEmbeddedServer,
  isEmbeddedServerRunning,
} = require('./embeddedNotebookServer');

const execFileAsync = promisify(execFile);

const LABS_LOCAL_DIR = process.env.LABS_LOCAL_DIR || path.join(process.cwd(), '.lab-workspaces');

/**
 * Ensure the workspace directory exists.
 * @param {string} userId
 * @param {string} sessionId
 * @returns {string} absolute workspace path
 */
function ensureWorkspaceDir(userId, sessionId) {
  const wsPath = path.join(LABS_LOCAL_DIR, userId, sessionId);
  fs.mkdirSync(wsPath, { recursive: true });
  return wsPath;
}

/**
 * Get workspace path (does not create).
 */
function getWorkspacePath(userId, sessionId) {
  return path.join(LABS_LOCAL_DIR, userId, sessionId);
}

/**
 * Check whether workspace directory has any files.
 */
function workspaceExists(userId, sessionId) {
  const wsPath = getWorkspacePath(userId, sessionId);
  return fs.existsSync(wsPath);
}

/**
 * Delete workspace directory and all its contents.
 */
function deleteWorkspace(userId, sessionId) {
  const wsPath = getWorkspacePath(userId, sessionId);
  if (fs.existsSync(wsPath)) {
    fs.rmSync(wsPath, { recursive: true, force: true });
  }
}

/**
 * Container name for a session.
 */
function containerName(sessionId) {
  return `lab-${sessionId.replace(/-/g, '').slice(0, 8)}`;
}

/**
 * Find a free port between 8900-8999.
 */
async function findFreePort() {
  const { execSync } = require('child_process');
  for (let port = 8900; port <= 8999; port++) {
    try {
      // Check if port is in use by any docker container
      const out = execSync(
        `docker ps --filter "publish=${port}" --format "{{.Ports}}"`,
        { encoding: 'utf8' }
      ).trim();
      if (!out) return port;
    } catch {
      return port;
    }
  }
  throw new Error('No free ports available in range 8900-8999');
}

/**
 * Map profile key to image name. In local mode we use the locally-built images.
 * Profiles 1-3 (CPU) use lab-cpu-base, profiles 4-5 (GPU) use lab-ml-gpu.
 */
function resolveImage(profileKey) {
  if (profileKey === 'ml-gpu' || profileKey === 'dl-gpu-large') {
    return process.env.LAB_ML_GPU_IMAGE || 'lab-ml-gpu:latest';
  }
  return process.env.LAB_CPU_BASE_IMAGE || 'lab-cpu-base:latest';
}

async function checkDockerImageExists(image) {
  try {
    await execFileAsync('docker', ['image', 'inspect', image], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a new lab container.
 * If the Docker image is available, runs a local Docker container.
 * If the Docker image is not yet built, seamlessly falls back to an embedded local JupyterLab server.
 */
async function create({ sessionId, userId, profileKey, jupyterToken, workspaceDir }) {
  const name = containerName(sessionId);
  const image = resolveImage(profileKey);
  const port = await findFreePort();

  // 1. Try Docker if image exists locally
  const hasDockerImage = await checkDockerImageExists(image);

  if (hasDockerImage) {
    const args = [
      'run', '-d',
      '--name', name,
      '-p', `${port}:8888`,
      '-e', `JUPYTER_TOKEN=${jupyterToken}`,
      '-e', `PROFILE_KEY=${profileKey}`,
      '-v', `${workspaceDir}:/workspace`,
      '--restart', 'no',
      '--label', `app=researchhub-lab`,
      '--label', `session-id=${sessionId}`,
      '--label', `user-id=${userId}`,
      image,
    ];

    logger.info({ sessionId, name, image, port }, 'Starting lab Docker container');
    try {
      const { stdout } = await execFileAsync('docker', args, { timeout: 30000 });
      logger.info({ containerId: stdout.trim().slice(0, 12), name, port }, 'Lab container started');
      return { containerName: name, port, url: `http://localhost:${port}` };
    } catch (err) {
      logger.warn({ err: err.message, sessionId }, 'Docker run failed, falling back to embedded local notebook server');
    }
  } else {
    logger.info({ image, sessionId }, 'Docker image not found locally, using embedded local notebook server');
  }

  // 2. Resilient fallback: Embedded local JupyterLab server
  logger.info({ sessionId, port, profileKey }, 'Starting embedded local JupyterLab notebook server');
  await startEmbeddedServer({ sessionId, port, jupyterToken, workspaceDir, profileKey });

  const url = `http://localhost:${port}`;
  return { containerName: name, port, url };
}

/**
 * Delete (stop + remove) a container by session ID.
 * Ignores errors if container not found (idempotent).
 */
async function deleteContainer(sessionId) {
  // Stop embedded server if active
  stopEmbeddedServer(sessionId);

  const name = containerName(sessionId);
  try {
    await execFileAsync('docker', ['stop', name], { timeout: 5000 });
    logger.info({ name }, 'Lab container stopped');
  } catch (err) {
    // Ignore: container may already be stopped or not exist
  }
  try {
    await execFileAsync('docker', ['rm', '-f', name], { timeout: 5000 });
    logger.info({ name }, 'Lab container removed');
  } catch (err) {
    // Ignore
  }
}

/**
 * Get container status.
 * @returns {'running'|'exited'|'not_found'|string}
 */
async function status(sessionId) {
  if (isEmbeddedServerRunning(sessionId)) {
    return 'running';
  }
  const name = containerName(sessionId);
  try {
    const { stdout } = await execFileAsync(
      'docker', ['inspect', '--format', '{{.State.Status}}', name],
      { timeout: 3000 }
    );
    return stdout.trim();
  } catch {
    return 'not_found';
  }
}

/**
 * List all containers labelled app=researchhub-lab.
 * Returns array of { name, sessionId, status }
 */
async function list() {
  try {
    const { stdout } = await execFileAsync(
      'docker',
      [
        'ps', '-a',
        '--filter', 'label=app=researchhub-lab',
        '--format', '{{.Names}}\t{{.Status}}\t{{.Label "session-id"}}',
      ],
      { timeout: 10000 }
    );
    if (!stdout.trim()) return [];
    return stdout
      .trim()
      .split('\n')
      .map((line) => {
        const [name, dockerStatus, sessionId] = line.split('\t');
        return { name, dockerStatus, sessionId };
      });
  } catch {
    return [];
  }
}

/**
 * Wait for the Jupyter server inside the container to be ready.
 * Polls GET /api up to maxWaitMs.
 */
async function waitForJupyter(url, token, maxWaitMs = 60000) {
  const http = require('http');
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`${url}/api?token=${token}`, (res) => {
          if (res.statusCode < 500) resolve();
          else reject(new Error(`status ${res.statusCode}`));
          res.resume();
        });
        req.on('error', reject);
        req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')); });
      });
      return true;
    } catch {
      // Not ready yet
    }
  }
  return false;
}

/**
 * Call /_lab/checkpoint on the running container (for pause).
 * Best-effort — timeout 60s; errors are logged and swallowed.
 */
async function checkpoint(url, token) {
  const http = require('http');
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(`${url}/_lab/checkpoint`);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 80,
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `token ${token}`,
        },
        timeout: 60000,
      };
      const req = http.request(options, (res) => {
        res.resume();
        logger.info({ statusCode: res.statusCode }, 'Checkpoint response');
        resolve(true);
      });
      req.on('error', (err) => {
        logger.warn({ err: err.message }, 'Checkpoint request error (ignored)');
        resolve(false);
      });
      req.on('timeout', () => {
        req.destroy();
        logger.warn('Checkpoint request timed out (ignored)');
        resolve(false);
      });
      req.write(JSON.stringify({}));
      req.end();
    } catch (err) {
      logger.warn({ err: err.message }, 'Checkpoint setup error (ignored)');
      resolve(false);
    }
  });
}

/**
 * Check Jupyter kernel activity for idle detection.
 * Returns true if all kernels have been idle for idleMinutes.
 */
async function areAllKernelsIdle(url, token, idleMinutes) {
  const http = require('http');
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(`${url}/api/kernels?token=${token}`);
      const req = http.get(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 80,
          path: parsedUrl.search
            ? `${parsedUrl.pathname}${parsedUrl.search}`
            : parsedUrl.pathname,
          timeout: 5000,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => { body += chunk; });
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
      req.on('timeout', () => { req.destroy(); resolve(false); });
    } catch {
      resolve(false);
    }
  });
}

module.exports = {
  create,
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
};
