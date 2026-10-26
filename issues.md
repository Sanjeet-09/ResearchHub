# Antigravity Task: Comprehensive Fix for Lab Workspace, Document Viewer, Experiments, Publications & Timeline

### Critical Architecture & System Guardrails
Do NOT regress or alter any of the following working implementations:
* Maintain dynamic disk resolution and high-performance CPU flags (AMX/AVX-512) in `services/lab/src/drivers/gceDriver.js`.
* Maintain Cloud Run sizing (`1Gi` memory, `120s` timeout) for `rh-lab`.
* Maintain automatic VM deletion on stop/edit to avoid idle cloud compute costs.
* Maintain existing database migrations, JWT verification, and multipart upload handling.

---

### Part 1: Fix JupyterLab Subpath Assets (White Screen) & Proxy Alignment

#### Root Cause:
When accessing `/api/lab/sessions/:id/proxy/lab`, JupyterLab defaults to requesting scripts and themes from the root (`/static/...`, `/api/...`, `main.js`). The browser routes these requests to Firebase Hosting, which falls back to serving `index.html` (`text/html`), causing MIME type errors and a blank white screen[cite: 9]. Additionally, internal token checks trigger unwanted HTML login redirects on sub-resource requests[cite: 9].

#### Implementation Steps:
1. **Dynamic Base URL & Startup Script in `services/lab/src/drivers/gceDriver.js`:**
   - Interpolate the session ID into the proxy base path:
     ```javascript
     const proxyBasePath = `/api/lab/sessions/${session.id}/proxy/`;
     ```
   - In the startup script Docker launch command:
     - Bind to `0.0.0.0` on port `8888`.
     - Pass `--ServerApp.base_url="${proxyBasePath}"` so Jupyter prefixes all internal links, scripts, and API calls.
     - Pass `--ServerApp.default_url="/lab"`.
     - Disable internal token/password checks (the API Gateway and GCE firewall manage authentication):
       `--ServerApp.token='' --ServerApp.password='' --ServerApp.disable_check_xsrf=True --ServerApp.allow_origin='*'`.
     - Configure frame ancestors so the iframe renders without CSP blocks:
       `--ServerApp.tornado_settings="{'headers': {'Content-Security-Policy': \"frame-ancestors 'self' https://*.web.app https://*.run.app https://*.firebaseapp.com http://localhost:3000 http://localhost:5000\"}}"`.
     - Ensure the container volume is mounted to `/opt/researchhub/work` and owned by UID `1000:1000`.

2. **Readiness Probe in `gceDriver.status(instanceName, zone)`:**
   - When GCE indicates the VM is running, issue a probe to `http://<vm-ip>:8888${proxyBasePath}api` with a 1.5s timeout.
   - Return `{ status: 'provisioning', ready: false }` while unreachable.
   - Return `{ status: 'running', ready: true }` only after Jupyter responds with HTTP 200/302.

3. **Proxy Alignment in `services/gateway/src/middleware/proxy.js`:**
   - Because Jupyter is started with `base_url`, forward the path intact without stripping `/api/lab/sessions/:id/proxy/`.
   - Ensure WebSocket upgrades (`ws: true`) and `changeOrigin: true` are enabled.
   - Normalize trailing slashes: automatically redirect `/api/lab/sessions/:id/proxy/lab` to `/api/lab/sessions/:id/proxy/lab/`.

4. **Frontend URLs in `frontend/src/components/lab/LabSessionView.jsx`:**
   - Update both the `<iframe>` `src` and the "Open Tab ↗" link to include the trailing slash:
     ```javascript
     const proxyUrl = `/api/lab/sessions/${session.id}/proxy/lab/`;
     ```
   - Retain the container readiness progress overlay (0%–100%) during `provisioning` and `starting` states. Do not mount the `<iframe>` until the status endpoint reports `running` with `ready: true`.

---

### Part 2: Safe Session Restart (Ephemeral VM Re-Provisioning)

#### Root Cause:
Stopping a session deletes the VM to halt billing (`gceDriver.deleteContainer`)[cite: 7]. Calling `POST /api/lab/sessions/:id/restart` invokes `instancesClient.start()` on a non-existent instance, returning `404 NOT_FOUND` and an HTTP 500 error[cite: 7, 8].

#### Implementation Steps:
1. **Update `restartSession` in `services/lab/src/controllers/labController.js`:**
   - Query GCE status. If the instance was deleted on stop (`NOT_FOUND`):
     - Do NOT call `instancesClient.start()`.
     - Re-provision a fresh ephemeral VM: generate a unique name (e.g. `rh-lab-${sessionId.slice(0, 8)}-${Date.now()}`), invoke `driver.createContainer(...)` with the session's saved profile configuration, and set database status to `'provisioning'`.
     - Update the `lab_sessions` record with the new `instance_name`, clear `stopped_at`, set `started_at = NOW()`, and save.
   - If the instance remains allocated in GCE in a terminated state, invoke `driver.startContainer(...)`.
2. **Error Safety:**
   - Wrap restart logic in a `try/catch`. Return a structured JSON response `{ error: err.message }` with HTTP 400/500 rather than crashing.

---

### Part 3: Fix Document Viewer & Opening (`.ipynb` and `.md` Files)

#### Root Cause:
Exported notebooks and markdown reports appear as cards in the **Documents** tab, but clicking the external link `↗` or opening the document fails, returns a 404, or has no viewer handler attached[cite: 10].

#### Implementation Steps:
1. **Document Content & Stream Route in `services/document/`:**
   - Ensure an endpoint exists to retrieve raw document content or download files:
     `GET /api/documents/:id/download` and `GET /api/documents/:id/content`.
   - If stored in Supabase Storage or local storage, fetch and stream the buffer with correct headers (`Content-Type: application/x-ipynb+json` or `text/markdown`).
   - If file contents are stored as text/JSON in the database, return `{ document, content: doc.content }`.
2. **Frontend Document Viewer in `frontend/src/components/documents/` (or `DocumentsTab.jsx`):**
   - Wire the external link `↗` and card click handlers[cite: 10]:
     - If the file is `.ipynb`: Open a modal with a lightweight notebook viewer (e.g., render cells, inputs, and outputs) or trigger a direct download with a toast notification.
     - If the file is `.md` or `.txt`: Render the markdown/plain text preview inside a modal.
     - Ensure the download button `↓` fetches the file cleanly with its original filename (e.g. `${doc.title}.ipynb`)[cite: 10].

---

### Part 4: Fix Experiment File & Dataset Attachment Uploads

#### Root Cause:
Inside the **ExpTest** modal under the **Files** tab, dragging/dropping or browsing files fails to upload or attach artifacts to the experiment[cite: 9].

#### Implementation Steps:
1. **Gateway Passthrough in `services/gateway/src/app.js`:**
   - Ensure requests to `/api/experiments/:id/files`, `/api/experiments/:id/attachments`, or `/api/projects/:pid/experiments/:id/files` bypass `express.json()` body parsing so `multipart/form-data` streams cleanly to `rh-experiment`.
2. **Experiment File Upload Controller in `services/experiment/`:**
   - Add/verify `multer` middleware on the experiment file upload route.
   - Store the uploaded file in the project storage bucket (`experiments/<experiment_id>/<filename>`) or fallback to database/local storage.
   - Create a record in `experiment_files` (or `experiment_attachments`) linking `experiment_id`, `file_name`, `file_size`, `mime_type`, and `storage_path`.
   - Return HTTP 201 with the created file metadata so the UI immediately updates the **Files (0)** counter and list[cite: 9].
3. **Frontend Upload Handler in `frontend/src/components/experiments/`:**
   - In the experiment details modal, ensure the dropzone triggers `POST /api/experiments/:id/files` with `FormData`.
   - Update file attachment list state upon successful upload without requiring a page refresh.

---

### Part 5: Fix Publications Tab & Workflow

#### Root Cause:
Clicking the **Publications** tab fails to load existing publications or creates an unhandled error when creating or linking papers.

#### Implementation Steps:
1. **Gateway Route in `services/gateway/src/app.js`:**
   - Verify that routes starting with `/api/publications` and `/api/projects/:pid/publications` proxy to the designated service (`rh-project`, `rh-document`, or `rh-publication`).
2. **Service CRUD Handlers:**
   - Ensure the database schema has the `publications` table (columns: `id`, `project_id`, `title`, `authors`, `venue_journal`, `doi`, `status`, `publication_date`, `created_at`).
   - Implement `GET /api/projects/:pid/publications` and `POST /api/projects/:pid/publications`.
3. **Frontend Integration:**
   - Ensure the **Publications** tab renders the publication list and provides a functional "Add Publication" dialog (title, authors, journal/conference, DOI, and status).

---

### Part 6: Fix Project Activity Timeline

#### Root Cause:
The **Timeline** tab shows `"PROJECT ACTIVITY TIMELINE (0) - No timeline events yet"` because services do not emit activity events, or the frontend queries a mismatched endpoint[cite: 11].

#### Implementation Steps:
1. **Activity Recording Middleware / Utility in Backend Services:**
   - Ensure that whenever:
     - An experiment is created or status is changed[cite: 9],
     - A document/notebook is uploaded or exported[cite: 10],
     - A lab compute session is started or stopped[cite: 7],
   - An event record is inserted into `activity_timeline` / `audit_logs` (columns: `id`, `project_id`, `user_id`, `entity_type`, `action`, `title`, `metadata`, `created_at`).
2. **Timeline Endpoint & Gateway Routing:**
   - Ensure `GET /api/projects/:pid/timeline` (or `activity`) returns events sorted by `created_at DESC`.
   - Ensure Gateway routes `/api/projects/:pid/timeline` correctly to the service managing activity logs.
3. **Frontend Timeline Tab in `frontend/src/components/projects/` (or `TimelineTab.jsx`):**
   - Align the fetch URL with the backend route (`/api/projects/:projectId/timeline`).
   - Provide a functional **Refresh Feed** button that re-fetches activity events[cite: 11].
   - Ensure filters (**All Activities**, **Experiments**, **Datasets**, **Documents**, **Publications**, **Members**) correctly filter events by `entity_type`[cite: 11].

---

### Part 7: In-App Notification Fallbacks (Brave/Shields Safe)

#### Implementation Steps:
In `frontend/src/` (inside your real-time chat/notification listener):
1. **Permission Request:**
   - Trigger `Notification.requestPermission()` on user login or discussion open.
2. **Desktop Notification Handling:**
   - If granted and `document.hidden` is true, trigger a native `Notification`.
3. **Shield-Proof In-App Fallbacks:**
   - **Flashing Title:** When `document.hidden` is true, toggle `document.title` every 1 second between `ResearchHub OS` and `🔔 (1) New Message!` until the window regains focus (`window.onfocus` or `visibilitychange`).
   - **Visual Header Badge:** Increment the unread count badge in the global navigation bar (`nav.bell`).
   - **Audio Chime:** Play a subtle chime (`new Audio('/notification.mp3').play().catch(() => {})`).

---

### Part 8: Verification & Test Execution

Run all test suites and verify frontend build before completing:
```powershell
npm test --workspace=@rh/service-lab
npm test --workspace=@rh/service-gateway
npm test --workspace=@rh/service-document
npm test --workspace=@rh/service-experiment
npm run build --workspace=frontend