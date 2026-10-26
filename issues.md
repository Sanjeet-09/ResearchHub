# Antigravity Master Task: Fix JupyterLab Redirect Loop, Status Polling Crash & Dataset Version Upload (35% Stall)

### Critical Live Bugs Addressed
1. **JupyterLab `ERR_TOO_MANY_REDIRECTS`:** Browser reports `This page isn't working — redirected you too many times` on `/api/lab/sessions/:id/proxy/lab`[cite: 15].
2. **Premature "Session Launch Failed":** Status check crashes during GCE boot, causing `LabSessionView` to immediately fail with `Failed to check session status`.
3. **Dataset Version Upload Stalls at 35%:** Upload progress reaches 35% and fails with `Failed to upload version` alert popup.
4. **Document Viewer & Content Streaming:** `.ipynb` and `.md` files in the Documents tab fail to open or preview[cite: 10].
5. **Experiment Dropzone & Activity Timeline:** Missing multipart body passthrough and activity log persistence[cite: 9, 11].

CRITICAL SYSTEM GUARDRAIL: Do NOT alter or regress:
* High-performance CPU flags (AMX/AVX-512) and dynamic disk size calculation in `services/lab/src/drivers/gceDriver.js`.
* Cloud Run memory (`1Gi`) and timeout (`120s`) for `rh-lab`.
* Automatic VM deletion on stop/cleanup to prevent idle compute billing.
* Database connection pools, migrations, and JWT verification.

---

### Part 1: Fix JupyterLab `ERR_TOO_MANY_REDIRECTS` (The Ping-Pong Loop)

#### Root Cause:
In the previous fix, a 302 redirect was added in Gateway's `proxy.js` to redirect `/api/lab/sessions/:id/proxy/lab` $\rightarrow$ `/api/lab/sessions/:id/proxy/lab/`[cite: 15].
However, JupyterLab's Tornado webserver handles `/lab` as its canonical application route. When JupyterLab receives `/lab/`, Tornado automatically responds with a 302 redirect back to `/lab`! 
This creates an infinite redirect ping-pong loop between the Gateway and JupyterLab:
`Gateway (/lab -> /lab/) -> JupyterLab (/lab/ -> /lab) -> Gateway (/lab -> /lab/)` $\rightarrow$ `ERR_TOO_MANY_REDIRECTS`[cite: 15].

#### Implementation Steps:
1. **Remove Trailing-Slash Redirect in `services/gateway/src/middleware/proxy.js`:**
   - Delete any `res.redirect(302, .../lab/)` redirect handlers for `/lab`.
   - Pass both `/lab` and all sub-resources directly through to the target VM without redirecting:
   ```javascript
   // services/gateway/src/middleware/proxy.js
   const { createProxyMiddleware } = require('http-proxy-middleware');

   function createLabProxy() {
     return createProxyMiddleware({
       target: '[http://127.0.0.1:8888](http://127.0.0.1:8888)', // Dynamically overridden by router
       router: async (req) => {
         const sessionId = req.params.id;
         const targetUrl = await getLabSessionTargetUrl(sessionId); // Resolves http://<vm-ip>:8888
         return targetUrl;
       },
       changeOrigin: true,
       ws: true,
       proxyTimeout: 15000,
       timeout: 15000,
       // Do NOT strip pathRewrite if Jupyter is configured with base_url
       on: {
         proxyRes: (proxyRes) => {
           delete proxyRes.headers['x-frame-options'];
           proxyRes.headers['content-security-policy'] =
             "frame-ancestors 'self' https://*.web.app https://*.run.app https://*.firebaseapp.com http://localhost:3000 http://localhost:5000";
         },
         error: (err, req, res) => {
           console.warn('[Lab Proxy Error]', err.message);
           if (res && !res.headersSent && typeof res.status === 'function') {
             res.status(503).json({ error: 'Lab container is booting or unreachable', ready: false });
           }
         }
       }
     });
   }

   Align Base URL in services/lab/src/drivers/gceDriver.js:

Ensure the Docker startup command sets --ServerApp.base_url="/api/lab/sessions/${session.id}/proxy/" and --ServerApp.default_url="/lab".

Ensure tokens and passwords are fully disabled internally:--ServerApp.token='' --ServerApp.password='' --ServerApp.disable_check_xsrf=True --ServerApp.allow_origin='*'.

Frontend Canonical URL in frontend/src/components/lab/LabSessionView.jsx:

Target the canonical /lab URL without an artificially forced trailing slash:

JavaScript
const iframeUrl = `/api/lab/sessions/${session.id}/proxy/lab`;
Wire both the embedded <iframe> and "Open Tab ↗" to this exact iframeUrl.

Part 2: Fix "Failed to check session status" (Premature Failure Modal)
Root Cause:
While Google Compute Engine provisions the VM (which takes 20–45s), GCE's API or the port 8888 probe returns transient 404s, 503s, or socket timeouts. labController.js allowed this to throw an unhandled 500 error, and LabSessionView.jsx aborted immediately on the first failed poll[cite: 12, 13].

Implementation Steps:
Backend Status Safety in services/lab/src/controllers/labController.js:

In getSessionStatus(req, res):
Wrap the call to driver.status() in a try/catch and Promise.race with a 2500ms timeout:

JavaScript
try {
  const statusData = await Promise.race([
    driver.status(session.gce_instance_name, session.gce_zone),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Probe timeout')), 2500))
  ]);
  return res.json({
    status: statusData.status || 'provisioning',
    ready: Boolean(statusData.ready),
    public_ip: statusData.ip || session.public_ip || null
  });
} catch (err) {
  // Never return 500 while provisioning; fallback cleanly to DB state
  return res.json({
    status: session.status || 'provisioning',
    ready: false,
    public_ip: session.public_ip || null
  });
}
Frontend Polling Resilience in frontend/src/components/lab/LabSessionView.jsx:

Allow up to 40 polling attempts (every 3 seconds = 120 seconds total).

If a poll returns an HTTP error or times out, do NOT call setLaunchFailed(true). Log a warning, maintain the progress bar, and show status text: "Waiting for cloud container runtime to initialize...".

Only trigger Session Launch Failed if the backend explicitly responds with { status: 'failed' } or all 40 retries are exhausted.

Part 3: Fix Dataset Version Upload Failing at 35% (Failed to upload version)
Root Cause:
At 35% progress, the frontend finishes creating the version metadata row and starts transmitting the binary dataset file. The upload fails because:

services/gateway/src/app.js runs express.json() on the request, which consumes and truncates the incoming multipart/form-data stream before it reaches the dataset microservice.

OR multer is missing from the dataset versions route in services/dataset/.

Implementation Steps:
Bypass JSON Body-Parser for Multipart in services/gateway/src/app.js:
Ensure express.json() never intercepts file uploads:

JavaScript
// services/gateway/src/app.js
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  const isUpload = contentType.includes('multipart/form-data') ||
                   req.path.includes('/versions') ||
                   req.path.includes('/datasets') ||
                   req.path.includes('/files') ||
                   req.path.includes('/upload') ||
                   req.path.includes('/documents');

  if (isUpload) {
    return next(); // Pass raw stream through to microservice
  }
  express.json({ limit: '10mb' })(req, res, next);
});
Handle File Upload in services/dataset/src/routes/datasetRoutes.js & controllers/datasetController.js:

Attach multer to the version upload route:

JavaScript
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

router.post('/:id/versions', upload.single('file'), datasetController.createVersion);
In createVersion:

Extract req.file (the uploaded binary) and req.body (change notes, version metadata).

Save the file using shared/src/storage.js or write to disk/cloud storage.

Insert a record into dataset_versions (dataset_id, version_number, storage_path, file_size, change_note, created_at).

Emit an activity event: emitActivityEvent({ projectId, entityType: 'dataset', action: 'version_uploaded', ... }).

Respond with HTTP 201 { success: true, version: newVersion }.

Frontend Dataset Modal (DatasetUploadVersionModal.jsx / DatasetsTab.jsx):

Ensure the submission uses FormData with key 'file':

JavaScript
const formData = new FormData();
formData.append('file', selectedFile);
formData.append('change_note', changeNote);
On HTTP 201, update progress to 100%, trigger a toast "Version uploaded successfully", and refresh the versions list[cite: 14].

Part 4: Fix Document Opening & Viewer (.ipynb & .md Files)
Implementation Steps:
Document Content Endpoint in services/document/src/:

Ensure GET /api/documents/:id/content exists.

Fetch the file via storage.readFile(bucket, key) or database column.

Stream or return JSON { document, content: rawContentString }.

Frontend Viewer Modal in frontend/src/components/documents/DocumentsTab.jsx:

When the user clicks a document card or the external link ↗:

If .ipynb: Fetch /api/documents/${doc.id}/content, parse the JSON notebook cells, and render inputs and outputs in a modal viewer.

If .md or .txt: Render markdown content in a formatted reading pane.

Ensure the direct download button ↓ downloads with the correct filename (${doc.title}.ipynb or ${doc.title}.md).

Part 5: Fix Experiment Dropzone, Publications Tab & Activity Timeline
Experiment File Dropzone:

In services/experiment/src/routes/experimentRoutes.js, ensure multer.single('file') is mounted on POST /:id/files.

Update ExperimentsTab.jsx so dragging and dropping files uploads via FormData and updates the file count immediately.

Publications Tab:

In services/publication/src/controllers/publicationController.js, support column aliases (venue / venue_journal, published_on / publication_date) to align with existing schemas without database migration conflicts.

Activity Timeline:

In shared/src/events.js, ensure emitActivityEvent writes directly to the project_activities / activity_timeline table.

In frontend/src/components/timeline/TimelineTab.jsx, verify that fetchTimeline populates the timeline feed and filtering by pills works as expected.

Part 6: In-App Notification Fallbacks (Brave Shields Safe)
In frontend/src/hooks/useMessageNotifications.js:

When a chat or project message arrives while document.hidden is true:

Attempt native desktop notification (Notification.requestPermission()).

If blocked or denied, alternate document.title between ResearchHub OS and 🔔 (1) New Message! every 1 second until the window regains focus.

Play an audio ping (new Audio('/notification.mp3').play().catch(() => {})).

Increment the unread notification bell badge in the global navigation bar.
