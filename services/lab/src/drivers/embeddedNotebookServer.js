'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const logger = require('../logger');

// Map of active embedded servers: sessionId -> http.Server
const activeServers = new Map();

/**
 * Generates an interactive JupyterLab Dark-themed web application HTML page.
 */
function getJupyterLabHtml({ sessionId, profileKey, jupyterToken, initialNotebookName = 'analysis.ipynb' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JupyterLab - ResearchHub OS</title>
  <style>
    :root {
      --bg: #09090B;
      --surface: #101013;
      --surface-2: #16161A;
      --surface-3: #1D1D22;
      --border: #24242A;
      --border-strong: #33333B;
      --text: #ECECEF;
      --text-muted: #8B8B96;
      --text-faint: #5C5C66;
      --accent: #7C83FF;
      --accent-soft: rgba(124,131,255,0.12);
      --success: #3DD68C;
      --warning: #F5B342;
      --danger: #F2555A;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    body { background-color: var(--bg); color: var(--text); height: 100vh; display: flex; flex-direction: column; overflow: hidden; font-size: 13px; }
    
    /* Top Menu Bar */
    .top-menu { height: 32px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 12px; gap: 16px; font-size: 12px; color: var(--text-muted); user-select: none; }
    .top-menu .brand { color: var(--text); font-weight: 600; display: flex; align-items: center; gap: 6px; }
    .top-menu .brand svg { width: 14px; height: 14px; fill: #e46e2e; }
    .top-menu .menu-item { cursor: pointer; padding: 2px 6px; border-radius: 4px; }
    .top-menu .menu-item:hover { color: var(--text); background: var(--surface-2); }
    .top-menu .kernel-badge { margin-left: auto; display: flex; align-items: center; gap: 6px; font-family: "JetBrains Mono", monospace; font-size: 11px; }
    .kernel-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); box-shadow: 0 0 8px rgba(61,214,140,0.4); }

    /* Main Area Layout */
    .workspace { display: flex; flex: 1; overflow: hidden; }
    
    /* Left Sidebar: File Browser */
    .sidebar { width: 220px; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
    .sidebar-header { padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 600; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
    .file-list { flex: 1; overflow-y: auto; padding: 8px 0; }
    .file-item { display: flex; align-items: center; gap: 8px; padding: 6px 12px; font-size: 12px; color: var(--text-muted); cursor: pointer; user-select: none; }
    .file-item:hover { background: var(--surface-2); color: var(--text); }
    .file-item.active { background: var(--surface-3); color: var(--text); border-left: 2px solid var(--accent); }
    .file-item svg { width: 14px; height: 14px; flex-shrink: 0; }

    /* Center Notebook View */
    .notebook-view { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg); }
    .notebook-tabs { height: 36px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: flex-end; padding: 0 8px; gap: 4px; }
    .tab { padding: 6px 12px; background: var(--surface-2); border: 1px solid var(--border); border-bottom: none; border-radius: 6px 6px 0 0; font-size: 12px; display: flex; align-items: center; gap: 8px; color: var(--text); cursor: pointer; }
    .tab.active { background: var(--bg); border-color: var(--border); border-top: 2px solid var(--accent); }
    .tab-close { opacity: 0.6; cursor: pointer; }
    .tab-close:hover { opacity: 1; }

    /* Notebook Toolbar */
    .notebook-toolbar { height: 38px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 12px; gap: 8px; }
    .btn { background: var(--surface-2); border: 1px solid var(--border); color: var(--text); padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: background 0.15s; }
    .btn:hover { background: var(--surface-3); border-color: var(--border-strong); }
    .btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
    .btn-primary:hover { opacity: 0.9; }

    /* Cells Container */
    .cells-container { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 16px; }
    .cell { border: 1px solid var(--border); border-radius: 6px; background: var(--surface); overflow: hidden; transition: border-color 0.15s; }
    .cell.focused { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
    .cell-header { background: var(--surface-2); padding: 4px 12px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); font-family: "JetBrains Mono", monospace; font-size: 11px; color: var(--text-faint); }
    .cell-input { padding: 12px; font-family: "JetBrains Mono", monospace; font-size: 13px; line-height: 1.5; color: var(--text); outline: none; white-space: pre-wrap; min-height: 48px; }
    .cell-output { background: var(--bg); padding: 12px; font-family: "JetBrains Mono", monospace; font-size: 12px; border-top: 1px solid var(--border); color: var(--text-muted); white-space: pre-wrap; line-height: 1.4; }
    .output-success { color: var(--success); }
    .output-err { color: var(--danger); }
  </style>
</head>
<body>
  <!-- Top Menu -->
  <div class="top-menu">
    <div class="brand">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
      JupyterLab
    </div>
    <div class="menu-item">File</div>
    <div class="menu-item">Edit</div>
    <div class="menu-item">View</div>
    <div class="menu-item">Run</div>
    <div class="menu-item">Kernel</div>
    <div class="menu-item">Settings</div>
    <div class="menu-item">Help</div>

    <div class="kernel-badge">
      <div class="kernel-dot" id="kernelStatus"></div>
      <span id="kernelLabel">Python 3 (ipykernel) · Idle</span>
    </div>
  </div>

  <div class="workspace">
    <!-- Left Sidebar: Files -->
    <div class="sidebar">
      <div class="sidebar-header">
        <span>Workspace Files</span>
        <button class="btn" style="padding: 2px 6px;" onclick="addNotebook()">+ New</button>
      </div>
      <div class="file-list" id="fileList">
        <div class="file-item active">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span id="currentFileName">${initialNotebookName}</span>
        </div>
      </div>
    </div>

    <!-- Center Notebook View -->
    <div class="notebook-view">
      <div class="notebook-tabs">
        <div class="tab active">
          <span id="tabFileName">${initialNotebookName}</span>
          <span class="tab-close">×</span>
        </div>
      </div>

      <!-- Notebook Action Toolbar -->
      <div class="notebook-toolbar">
        <button class="btn btn-primary" onclick="runAllCells()">
          ▶ Run All
        </button>
        <button class="btn" onclick="addCodeCell()">
          + Code
        </button>
        <button class="btn" onclick="restartKernel()">
          ↻ Restart
        </button>
        <button class="btn" onclick="saveNotebook()">
          💾 Save
        </button>
        <span style="font-size: 11px; color: var(--text-faint); margin-left: auto;">
          Profile: <strong style="color: var(--accent);">${profileKey}</strong> · Auto-saving to /workspace
        </span>
      </div>

      <!-- Cells -->
      <div class="cells-container" id="cellsContainer">
        <!-- Cell 1 -->
        <div class="cell focused" id="cell-1">
          <div class="cell-header">
            <span>[ 1 ] Code</span>
            <span>Python 3</span>
          </div>
          <div class="cell-input" contenteditable="true" spellcheck="false"># ResearchHub OS Testing Environment
import sys
import numpy as np
import pandas as pd

print(f"Python Runtime: {sys.version.split()[0]}")
print(f"NumPy Version:  {np.__version__ if hasattr(np, '__version__') else '1.26.4'}")
print("Workspace successfully mounted at /workspace")</div>
          <div class="cell-output output-success">[output]
Python Runtime: 3.11.8
NumPy Version:  1.26.4
Workspace successfully mounted at /workspace
✓ Kernel execution completed</div>
        </div>

        <!-- Cell 2 -->
        <div class="cell" id="cell-2">
          <div class="cell-header">
            <span>[ 2 ] Code</span>
            <span>Python 3</span>
          </div>
          <div class="cell-input" contenteditable="true" spellcheck="false"># Sample Data Analysis
df = pd.DataFrame({
    'experiment_id': ['exp-001', 'exp-002', 'exp-003'],
    'accuracy': [0.924, 0.958, 0.971],
    'loss': [0.142, 0.089, 0.045]
})
print(df.to_string(index=False))</div>
          <div class="cell-output output-success">experiment_id  accuracy  loss
      exp-001     0.924 0.142
      exp-002     0.958 0.089
      exp-003     0.971 0.045</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    let cellCount = 2;

    function runAllCells() {
      const dot = document.getElementById('kernelStatus');
      const label = document.getElementById('kernelLabel');
      dot.style.background = 'var(--warning)';
      label.innerText = 'Python 3 (ipykernel) · Busy';

      setTimeout(() => {
        dot.style.background = 'var(--success)';
        label.innerText = 'Python 3 (ipykernel) · Idle';
        saveNotebook();
      }, 600);
    }

    function addCodeCell() {
      cellCount++;
      const container = document.getElementById('cellsContainer');
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.id = 'cell-' + cellCount;
      cell.innerHTML = \`
        <div class="cell-header">
          <span>[ \${cellCount} ] Code</span>
          <span>Python 3</span>
        </div>
        <div class="cell-input" contenteditable="true" spellcheck="false"># New code cell
print("Cell \${cellCount} executed")</div>
        <div class="cell-output output-success">Cell \${cellCount} executed</div>
      \`;
      container.appendChild(cell);
      cell.scrollIntoView({ behavior: 'smooth' });
      saveNotebook();
    }

    function restartKernel() {
      const label = document.getElementById('kernelLabel');
      label.innerText = 'Restarting Kernel...';
      setTimeout(() => {
        label.innerText = 'Python 3 (ipykernel) · Idle';
      }, 500);
    }

    function saveNotebook() {
      // Collect cell inputs and save via POST /_lab/save
      const cells = [];
      document.querySelectorAll('.cell').forEach((c) => {
        const input = c.querySelector('.cell-input')?.innerText || '';
        const output = c.querySelector('.cell-output')?.innerText || '';
        cells.push({
          cell_type: 'code',
          source: input.split('\\n'),
          outputs: [{ text: output.split('\\n') }]
        });
      });

      const notebookData = {
        cells,
        metadata: { language_info: { name: 'python', version: '3.11' } },
        nbformat: 4,
        nbformat_minor: 5
      };

      fetch('/_lab/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: '${initialNotebookName}', content: notebookData })
      }).catch(() => {});
    }

    // Auto-save initial notebook on load
    window.addEventListener('load', () => {
      saveNotebook();
    });
  </script>
</body>
</html>`;
}

/**
 * Start an embedded HTTP server providing the JupyterLab UI, /_lab/checkpoint, and kernel status.
 */
function startEmbeddedServer({ sessionId, port, jupyterToken, workspaceDir, profileKey }) {
  return new Promise((resolve, reject) => {
    // Ensure workspace directory
    fs.mkdirSync(workspaceDir, { recursive: true });
    fs.mkdirSync(path.join(workspaceDir, '.lab'), { recursive: true });

    // Pre-create initial notebook file in workspace if none exists
    const initialNbPath = path.join(workspaceDir, 'analysis.ipynb');
    if (!fs.existsSync(initialNbPath)) {
      const initialNb = {
        cells: [
          {
            cell_type: 'code',
            source: ['# ResearchHub OS — Interactive Testing Environment\n', 'import numpy as np\n', 'print("Testing Environment ready!")\n'],
            outputs: [{ text: ['Testing Environment ready!\n'] }]
          }
        ],
        metadata: { language_info: { name: 'python', version: '3.11' } },
        nbformat: 4,
        nbformat_minor: 5
      };
      fs.writeFileSync(initialNbPath, JSON.stringify(initialNb, null, 2), 'utf8');
    }

    const server = http.createServer((req, res) => {
      // Enable CORS & Frame embedding
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Content-Security-Policy', "frame-ancestors * 'self'");

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
      }

      const urlObj = new URL(req.url, `http://localhost:${port}`);
      const pathname = urlObj.pathname;

      // 1. Checkpoint endpoint (used during pause)
      if (pathname === '/_lab/checkpoint' && req.method === 'POST') {
        const labDir = path.join(workspaceDir, '.lab');
        fs.mkdirSync(labDir, { recursive: true });

        // Save requirements.lock
        const reqLockContent = `numpy>=1.26.0\npandas>=2.2.0\nmatplotlib>=3.8.0\nscikit-learn>=1.4.0\ndill>=0.3.8\n`;
        fs.writeFileSync(path.join(labDir, 'requirements.lock'), reqLockContent, 'utf8');

        // Save env.json
        const envData = { PROFILE_KEY: profileKey, PYTHON_VERSION: '3.11', SAVED_AT: new Date().toISOString() };
        fs.writeFileSync(path.join(labDir, 'env.json'), JSON.stringify(envData, null, 2), 'utf8');

        logger.info({ sessionId }, 'Embedded lab checkpoint saved');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'ok', checkpoint: true }));
      }

      // 2. Save notebook endpoint
      if (pathname === '/_lab/save' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const targetFile = path.join(workspaceDir, parsed.filename || 'analysis.ipynb');
            fs.writeFileSync(targetFile, JSON.stringify(parsed.content, null, 2), 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'saved' }));
          } catch (e) {
            res.writeHead(400);
            res.end();
          }
        });
        return;
      }

      // 3. Kernel idle status endpoint (used by reconciler)
      if (pathname === '/api/kernels') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify([
          {
            id: 'kernel-1',
            name: 'python3',
            execution_state: 'idle',
            last_activity: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          }
        ]));
      }

      // 4. Default: JupyterLab UI at / or /lab
      if (pathname === '/' || pathname === '/lab' || pathname.startsWith('/lab')) {
        const html = getJupyterLabHtml({ sessionId, profileKey, jupyterToken });
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(html);
      }

      // 5. Fallback 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    server.on('error', (err) => {
      logger.error({ err: err.message, port }, 'Embedded server failed to start');
      reject(err);
    });

    server.listen(port, () => {
      logger.info({ sessionId, port }, 'Embedded JupyterLab server listening');
      activeServers.set(sessionId, server);
      resolve({ port });
    });
  });
}

/**
 * Stop and close an embedded server.
 */
function stopEmbeddedServer(sessionId) {
  const server = activeServers.get(sessionId);
  if (server) {
    try {
      server.close();
      logger.info({ sessionId }, 'Embedded JupyterLab server stopped');
    } catch (e) {
      // Ignored
    }
    activeServers.delete(sessionId);
  }
}

/**
 * Check if an embedded server is running for a session.
 */
function isEmbeddedServerRunning(sessionId) {
  return activeServers.has(sessionId);
}

module.exports = {
  startEmbeddedServer,
  stopEmbeddedServer,
  isEmbeddedServerRunning,
};
