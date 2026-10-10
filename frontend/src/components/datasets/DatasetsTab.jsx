import React, { useState, useEffect, useRef } from 'react';
import { datasetApi } from '../../services/api';
import {
  Card,
  Button,
  Input,
  Textarea,
  Badge,
  Skeleton,
  EmptyState,
  ProgressBar,
  Dialog,
  ConfirmDialog,
  Timeline,
} from '../ui';
import {
  Plus,
  Search,
  Database,
  UploadCloud,
  Download,
  Trash2,
  Edit3,
  RefreshCw,
  History,
  RotateCcw,
  FileText,
  Hash,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export const DatasetsTab = ({ projectId, isMember, isLead }) => {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // New Dataset modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Selected dataset detail panel
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [versions, setVersions] = useState([]);
  const [expandedVersionId, setExpandedVersionId] = useState(null);

  // Edit dataset
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // New version upload
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadChangeNote, setUploadChangeNote] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Delete dataset confirm
  const [isDeleteConfirm, setIsDeleteConfirm] = useState(false);

  // Restore confirm
  const [restoreTargetVersion, setRestoreTargetVersion] = useState(null);
  const [isRestoreConfirm, setIsRestoreConfirm] = useState(false);

  const fetchDatasets = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await datasetApi.getDatasets(projectId);
      setDatasets(data || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load datasets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchDatasets();
    }
  }, [projectId]);

  const handleOpenDetail = async (ds) => {
    setSelectedDataset(ds);
    setExpandedVersionId(null);
    try {
      setDetailLoading(true);
      const data = await datasetApi.getDatasetById(projectId, ds.id);
      setVersions(data.versions || []);
      setSelectedDataset(data.dataset);
    } catch (err) {
      console.error('Failed to load dataset details', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setCreateLoading(true);
      await datasetApi.createDataset(projectId, {
        name: newName,
        description: newDescription,
      });
      setNewName('');
      setNewDescription('');
      setIsNewModalOpen(false);
      fetchDatasets();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to create dataset');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDataset) return;

    try {
      setUpdateLoading(true);
      const updated = await datasetApi.updateDataset(projectId, selectedDataset.id, {
        name: editName,
        description: editDescription,
      });
      setSelectedDataset((prev) => ({ ...prev, ...updated }));
      setIsEditOpen(false);
      fetchDatasets();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to update dataset');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDeleteDataset = async () => {
    if (!selectedDataset) return;
    try {
      await datasetApi.deleteDataset(projectId, selectedDataset.id);
      setIsDeleteConfirm(false);
      setSelectedDataset(null);
      fetchDatasets();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to delete dataset');
    }
  };

  // File upload: 3-step signed URL flow
  const handleFileUpload = async (file) => {
    if (!file || !selectedDataset) return;

    // Compute SHA-256 checksum client-side
    let checksumSha256 = '';
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      checksumSha256 = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (err) {
      checksumSha256 = `client-${Date.now()}`; // fallback for environments without crypto.subtle
    }

    try {
      setIsUploading(true);
      setUploadProgress(10);

      // Step 1: Get signed upload URL
      const { uploadUrl, gcsPath, nextVersion } = await datasetApi.getVersionUploadUrl(projectId, selectedDataset.id, {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
      });

      setUploadProgress(35);

      // Step 2: Upload binary
      await datasetApi.uploadFileBinary(uploadUrl, file, (pct) => {
        setUploadProgress(35 + Math.round(pct * 0.5));
      });

      setUploadProgress(88);

      // Step 3: Confirm version
      await datasetApi.confirmVersion(projectId, selectedDataset.id, {
        gcsPath,
        sizeBytes: file.size,
        checksumSha256,
        changeNote: uploadChangeNote.trim() || `Version ${nextVersion} uploaded`,
        metadata: {
          originalFileName: file.name,
          mimeType: file.type || 'application/octet-stream',
        },
      });

      setUploadProgress(100);
      setUploadChangeNote('');

      // Refresh versions
      const data = await datasetApi.getDatasetById(projectId, selectedDataset.id);
      setVersions(data.versions || []);
      setSelectedDataset(data.dataset);
      fetchDatasets();

      setTimeout(() => {
        setIsUploadOpen(false);
        setUploadProgress(0);
      }, 800);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to upload version');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (versionId) => {
    try {
      const { downloadUrl } = await datasetApi.getVersionDownloadUrl(projectId, selectedDataset.id, versionId);
      window.open(downloadUrl, '_blank');
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to get download URL');
    }
  };

  const handleRestoreVersion = async () => {
    if (!restoreTargetVersion || !selectedDataset) return;
    try {
      await datasetApi.restoreVersion(projectId, selectedDataset.id, restoreTargetVersion.id);
      setIsRestoreConfirm(false);
      setRestoreTargetVersion(null);

      const data = await datasetApi.getDatasetById(projectId, selectedDataset.id);
      setVersions(data.versions || []);
      setSelectedDataset(data.dataset);
      fetchDatasets();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to restore version');
    }
  };

  // Drag & Drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '—';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredDatasets = datasets.filter((ds) =>
    ds.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (ds.description && ds.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // ── Loading State ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-card" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error State ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <Card className="p-8 border-danger/30 text-center space-y-4">
        <AlertCircle className="w-8 h-8 text-danger mx-auto" />
        <p className="text-xs text-danger font-medium">{error}</p>
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={fetchDatasets}>
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Controls Bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-txt-faint absolute left-3 top-2.5" />
          <Input
            placeholder="Search datasets..."
            className="pl-9 text-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {isMember && (
          <Button variant="primary" icon={Plus} size="sm" onClick={() => setIsNewModalOpen(true)}>
            New Dataset
          </Button>
        )}
      </div>

      {/* ── Dataset List ──────────────────────────────────────────────────── */}
      {filteredDatasets.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No datasets found"
          description={
            searchQuery
              ? 'No datasets match your search.'
              : 'Track versioned datasets for this research project with full attribution and history.'
          }
          action={
            isMember && !searchQuery ? (
              <Button variant="primary" icon={Plus} size="sm" onClick={() => setIsNewModalOpen(true)}>
                New Dataset
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredDatasets.map((ds) => (
            <Card
              key={ds.id}
              className="p-5 hover:border-accent/40 cursor-pointer transition-all group"
              onClick={() => handleOpenDetail(ds)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-accent/10 border border-accent/20 mt-0.5 shrink-0">
                    <Database className="w-4 h-4 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-txt group-hover:text-accent transition-colors truncate">
                      {ds.name}
                    </h4>
                    {ds.description && (
                      <p className="text-xs text-txt-muted line-clamp-1 mt-0.5">{ds.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] font-mono text-txt-faint">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {ds.created_by_name || 'Unknown'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(ds.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Current version badge */}
                {ds.current_version_no ? (
                  <div className="shrink-0 text-right">
                    <Badge variant="accent" className="font-mono text-[10px]">
                      v{ds.current_version_no}
                    </Badge>
                    <p className="text-[10px] font-mono text-txt-faint mt-1">
                      {formatBytes(ds.current_size_bytes)}
                    </p>
                  </div>
                ) : (
                  <Badge variant="secondary" className="font-mono text-[10px] shrink-0">
                    No versions
                  </Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── New Dataset Modal ─────────────────────────────────────────────── */}
      <Dialog isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} title="New Dataset">
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="Dataset Name"
            placeholder="e.g. Protein Binding Affinity Corpus"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <Textarea
            label="Description (Optional)"
            placeholder="Brief description of dataset content, format, and source..."
            rows={3}
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="secondary" onClick={() => setIsNewModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={createLoading}>
              Create Dataset
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ── Dataset Detail Dialog ─────────────────────────────────────────── */}
      {selectedDataset && (
        <Dialog
          isOpen={Boolean(selectedDataset)}
          onClose={() => setSelectedDataset(null)}
          title={selectedDataset.name}
          className="max-w-3xl"
        >
          <div className="space-y-6">
            {/* Header: meta + actions */}
            <div className="flex flex-wrap items-start justify-between gap-4 p-4 rounded-lg bg-surface-2 border border-border">
              <div className="space-y-1">
                <p className="text-[11px] font-mono text-txt-muted">
                  Created by <span className="text-txt font-semibold">{selectedDataset.created_by_name || 'Unknown'}</span>
                  {' · '}
                  {new Date(selectedDataset.created_at).toLocaleDateString()}
                </p>
                {selectedDataset.description && (
                  <p className="text-xs text-txt-muted">{selectedDataset.description}</p>
                )}
                {selectedDataset.current_version_no && (
                  <Badge variant="accent" className="font-mono text-[11px]">
                    Current: v{selectedDataset.current_version_no}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {isMember && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Edit3}
                      onClick={() => {
                        setEditName(selectedDataset.name);
                        setEditDescription(selectedDataset.description || '');
                        setIsEditOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={UploadCloud}
                      onClick={() => setIsUploadOpen(true)}
                    >
                      Upload Version
                    </Button>
                  </>
                )}
                {isLead && (
                  <Button
                    variant="danger"
                    size="sm"
                    icon={Trash2}
                    onClick={() => setIsDeleteConfirm(true)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>

            {/* Version History Timeline */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <History className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-txt">Version History</h3>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {versions.length} {versions.length === 1 ? 'version' : 'versions'}
                </Badge>
              </div>

              {detailLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-border rounded-card">
                  <FileText className="w-8 h-8 text-txt-faint mx-auto mb-2" />
                  <p className="text-xs text-txt-muted">No versions yet.</p>
                  {isMember && (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={UploadCloud}
                      className="mt-3"
                      onClick={() => setIsUploadOpen(true)}
                    >
                      Upload First Version
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {versions.map((v, idx) => {
                    const isCurrent = v.id === selectedDataset.current_version_id;
                    const isExpanded = expandedVersionId === v.id;
                    return (
                      <div
                        key={v.id}
                        className={`rounded-lg border transition-all ${
                          isCurrent ? 'border-accent/40 bg-accent/5' : 'border-border bg-surface-2'
                        }`}
                      >
                        {/* Version row header */}
                        <div
                          className="flex items-center justify-between p-3 cursor-pointer"
                          onClick={() => setExpandedVersionId(isExpanded ? null : v.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold font-mono shrink-0 ${
                              isCurrent ? 'bg-accent text-white' : 'bg-surface-3 text-txt-muted'
                            }`}>
                              v{v.version_no}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-txt">
                                  {v.change_note || `Version ${v.version_no}`}
                                </span>
                                {isCurrent && (
                                  <Badge variant="success" className="text-[9px] font-mono py-0">
                                    Current
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-[10px] font-mono text-txt-faint mt-0.5">
                                <span className="flex items-center gap-1">
                                  <User className="w-2.5 h-2.5" />
                                  {v.author_name || 'Unknown'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  {new Date(v.created_at).toLocaleString()}
                                </span>
                                {v.size_bytes > 0 && (
                                  <span>{formatBytes(v.size_bytes)}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Download}
                              onClick={(e) => { e.stopPropagation(); handleDownload(v.id); }}
                            >
                              Download
                            </Button>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-txt-faint" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-txt-faint" />
                            )}
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                            {v.checksum_sha256 && (
                              <div className="flex items-start gap-2">
                                <Hash className="w-3 h-3 text-txt-faint mt-0.5 shrink-0" />
                                <span className="text-[10px] font-mono text-txt-muted break-all">
                                  SHA-256: {v.checksum_sha256}
                                </span>
                              </div>
                            )}
                            {v.metadata && Object.keys(v.metadata).length > 0 && (
                              <div className="p-2 bg-surface rounded border border-border">
                                <p className="text-[10px] font-mono text-txt-faint mb-1">Metadata</p>
                                <pre className="text-[10px] font-mono text-txt-muted whitespace-pre-wrap">
                                  {JSON.stringify(v.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                            {isMember && !isCurrent && (
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={RotateCcw}
                                onClick={() => {
                                  setRestoreTargetVersion(v);
                                  setIsRestoreConfirm(true);
                                }}
                              >
                                Restore as New Version
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Dialog>
      )}

      {/* ── Edit Dataset Modal ────────────────────────────────────────────── */}
      <Dialog isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Dataset">
        <form onSubmit={handleUpdateSubmit} className="space-y-4">
          <Input
            label="Dataset Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />
          <Textarea
            label="Description"
            rows={3}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="secondary" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={updateLoading}>
              Save Changes
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ── Upload Version Modal ──────────────────────────────────────────── */}
      <Dialog
        isOpen={isUploadOpen}
        onClose={() => !isUploading && setIsUploadOpen(false)}
        title="Upload New Version"
      >
        <div className="space-y-4">
          <Textarea
            label="Change Note (Optional)"
            placeholder="What changed in this version? e.g. 'Added 2k new samples, fixed label errors in rows 1200-1500'"
            rows={2}
            value={uploadChangeNote}
            onChange={(e) => setUploadChangeNote(e.target.value)}
            disabled={isUploading}
          />

          {/* Drag & Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-card p-8 text-center cursor-pointer transition-all ${
              isUploading
                ? 'border-accent/50 bg-accent/5 cursor-not-allowed'
                : dragActive
                ? 'border-accent bg-accent-soft/20'
                : 'border-border hover:border-accent/50 bg-surface-2'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              disabled={isUploading}
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
            <UploadCloud className="w-10 h-10 text-accent mx-auto mb-3" />
            <p className="text-sm font-semibold text-txt">
              {isUploading ? 'Uploading...' : 'Drag & drop or click to browse'}
            </p>
            <p className="text-xs text-txt-muted mt-1">
              CSV, JSON, Parquet, HDF5, NPY, ZIP or any dataset file (up to 50 MB)
            </p>
          </div>

          {/* Upload progress */}
          {isUploading && (
            <div className="space-y-1.5 p-3 rounded bg-surface-2 border border-border">
              <div className="flex justify-between text-xs text-txt font-mono">
                <span>Uploading & confirming version...</span>
                <span>{uploadProgress}%</span>
              </div>
              <ProgressBar value={uploadProgress} />
            </div>
          )}

          {uploadProgress === 100 && !isUploading && (
            <div className="flex items-center gap-2 p-3 rounded bg-success/10 border border-success/30">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <p className="text-xs text-success font-medium">Version uploaded and recorded successfully!</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsUploadOpen(false)}
              disabled={isUploading}
            >
              Close
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Delete Confirm ────────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={isDeleteConfirm}
        onClose={() => setIsDeleteConfirm(false)}
        onConfirm={handleDeleteDataset}
        title="Delete Dataset"
        message={`Are you sure you want to delete "${selectedDataset?.name}"? All version records will be permanently removed.`}
        confirmText="Delete Dataset"
        requiredText={selectedDataset?.name}
      />

      {/* ── Restore Confirm ───────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={isRestoreConfirm}
        onClose={() => { setIsRestoreConfirm(false); setRestoreTargetVersion(null); }}
        onConfirm={handleRestoreVersion}
        title="Restore Version"
        message={`This will create a new version (immutable copy) from v${restoreTargetVersion?.version_no}. The current version will not be modified. Continue?`}
        confirmText="Restore as New Version"
        variant="primary"
      />
    </div>
  );
};
