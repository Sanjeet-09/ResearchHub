Antigravity Task: Fix Dataset Upload, Attach GCE Service Account, and Enable Notebook Save to Documents

### CRITICAL SAFETY RULES:
- DO NOT rewrite or refactor existing working routes in Gateway (`app.js`, `proxy.js`, `rateLimiter.js`).
- DO NOT create new deployment scripts or rename existing files.
- Apply surgical fixes only to the three targeted areas below.

---

### Task 1: Attach Default Service Account to Compute Engine VMs
**File:** `services/lab/src/drivers/gceDriver.js`

**Problem:** 
VMs provisioned for interactive labs currently run without a service account or scopes, causing Python `storage.Client()` and `gcsfs` inside JupyterLab to fail authentication with GCS.

**Action:**
In the instance creation resource payload (`instancesClient.insert` or `compute.zone.createVM`), ensure `serviceAccounts` is explicitly included:
```javascript
serviceAccounts: [
  {
    email: 'default',
    scopes: ['[https://www.googleapis.com/auth/cloud-platform](https://www.googleapis.com/auth/cloud-platform)'],
  },
]
Ensure this attaches cleanly without modifying existing disk mounts, startup-scripts, or metadata configurations.

Task 2: Fix Dataset Upload Failure in services/dataset
Files: services/dataset/src/controllers/datasetController.js, services/dataset/src/routes/datasetRoutes.js

Problem:
Dataset uploads fail or do not persist properly to Google Cloud Storage.

Action:

Verify services/dataset route uses multer memory storage on upload routes (POST /:id/versions or POST /upload) so req.file.buffer is available.

In the controller:

Verify getStorageAdapter() from @rh/shared is used to store the binary payload.

When process.env.GCS_BUCKET is present, ensure it uploads to key format:datasets/${datasetId}/v${versionNo}/${fileName}

Ensure the database record in dataset_versions updates with the exact storage path (gs://${bucket}/... or signed URL key) and file size.

Wrap the upload in proper error handling so any upload failure returns a clear 400/500 JSON response with the exact error message instead of hanging or dropping the connection.

Task 3: Enable Saving / Exporting from Interactive Lab to Documents
Files: services/lab/src/controllers/labController.js, services/document/src/controllers/documentController.js (or existing export handler)

Problem:
Users working in the JupyterLab testing environment need to save their active notebooks (.ipynb) or experiment outputs directly into the ResearchHub Documents tab.

Action:

Check the existing export/stop sync handler in labController.js (e.g., exportSession or syncSession):

Ensure it can retrieve the active notebook file from the VM workspace (/home/jovyan/work/ or persistent host path /opt/researchhub/work).

Push the exported .ipynb via storageAdapter under documents/${projectId}/${timestamp}_${notebookName}.ipynb.

Create an entry in the documents table via direct database insert or calling service-document (title, file_type: 'notebook', gcs_path, file_size, project_id, created_by).

Ensure the frontend "Export / Save to Documents" button triggers this endpoint and refreshes the Documents list so the .ipynb appears in the Document viewer.