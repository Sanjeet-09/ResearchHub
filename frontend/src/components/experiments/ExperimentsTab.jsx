import React, { useState, useEffect, useRef } from 'react';
import { experimentApi } from '../../services/api';
import {
  Card,
  Button,
  Input,
  Textarea,
  Badge,
  StatusDot,
  Skeleton,
  EmptyState,
  ProgressBar,
  Dialog,
  ConfirmDialog,
} from '../ui';
import {
  Plus,
  Search,
  FlaskConical,
  UploadCloud,
  FileText,
  Download,
  Trash2,
  ExternalLink,
  Edit3,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  PlayCircle,
  File,
  Paperclip,
  RefreshCw,
} from 'lucide-react';

export const ExperimentsTab = ({ projectId, isMember, isLead }) => {
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // New Experiment Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newHypothesis, setNewHypothesis] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newStatus, setNewStatus] = useState('planned');
  const [createLoading, setCreateLoading] = useState(false);

  // Experiment Detail Drawer / Modal
  const [selectedExp, setSelectedExp] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailFiles, setDetailFiles] = useState([]);
  const [detailLinks, setDetailLinks] = useState([]);
  const [activeDetailTab, setActiveDetailTab] = useState('notes'); // 'notes', 'results', 'files', 'links'
  const [editorMode, setEditorMode] = useState('write'); // 'write', 'preview'

  // Edit fields
  const [editTitle, setEditTitle] = useState('');
  const [editHypothesis, setEditHypothesis] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editResults, setEditResults] = useState('');
  const [editStatus, setEditStatus] = useState('planned');
  const [updateLoading, setUpdateLoading] = useState(false);

  // File Upload State
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Delete experiment modal
  const [isDeleteExpConfirm, setIsDeleteExpConfirm] = useState(false);

  const fetchExperiments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await experimentApi.getExperiments(projectId);
      setExperiments(data || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load experiments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchExperiments();
    }
  }, [projectId]);

  // Open Experiment Detail
  const handleOpenDetail = async (exp) => {
    setSelectedExp(exp);
    setEditTitle(exp.title || '');
    setEditHypothesis(exp.hypothesis || '');
    setEditNotes(exp.notes || '');
    setEditResults(exp.results || '');
    setEditStatus(exp.status || 'planned');
    setActiveDetailTab('notes');

    try {
      setDetailLoading(true);
      const data = await experimentApi.getExperimentById(projectId, exp.id);
      setDetailFiles(data.files || []);
      const links = await experimentApi.getExperimentLinks(exp.id);
      setDetailLinks(links || []);
    } catch (err) {
      console.error('Failed to load experiment details', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setCreateLoading(true);
      await experimentApi.createExperiment(projectId, {
        title: newTitle,
        hypothesis: newHypothesis,
        notes: newNotes,
        status: newStatus,
      });

      setNewTitle('');
      setNewHypothesis('');
      setNewNotes('');
      setNewStatus('planned');
      setIsNewModalOpen(false);
      fetchExperiments();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to create experiment');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleUpdateExperiment = async (overrideStatus) => {
    if (!selectedExp) return;
    try {
      setUpdateLoading(true);
      const updatedStatus = overrideStatus || editStatus;
      const updated = await experimentApi.updateExperiment(projectId, selectedExp.id, {
        title: editTitle,
        hypothesis: editHypothesis,
        notes: editNotes,
        results: editResults,
        status: updatedStatus,
      });

      setSelectedExp((prev) => ({ ...prev, ...updated }));
      setEditStatus(updated.status);
      fetchExperiments();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to update experiment');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDeleteExperiment = async () => {
    if (!selectedExp) return;
    try {
      await experimentApi.deleteExperiment(projectId, selectedExp.id);
      setIsDeleteExpConfirm(false);
      setSelectedExp(null);
      fetchExperiments();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to delete experiment');
    }
  };

  // File Upload Handlers
  const handleFileUpload = async (file) => {
    if (!file || !selectedExp) return;

    try {
      setIsUploading(true);
      setUploadProgress(10);

      // 1. Get signed upload URL
      const { uploadUrl, gcsPath } = await experimentApi.getUploadUrl(projectId, selectedExp.id, {
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });

      setUploadProgress(40);

      // 2. Upload file binary
      await experimentApi.uploadFileBinary(uploadUrl, file, (progress) => {
        setUploadProgress(40 + Math.round(progress * 0.5));
      });

      setUploadProgress(90);

      // 3. Confirm file metadata in DB
      const fileRecord = await experimentApi.confirmFileUpload(projectId, selectedExp.id, {
        fileName: file.name,
        gcsPath,
        mimeType: file.type,
        sizeBytes: file.size,
      });

      setDetailFiles((prev) => [...prev, fileRecord]);
      setUploadProgress(100);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to upload file attachment');
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleDownloadFile = async (fileId) => {
    try {
      const { downloadUrl } = await experimentApi.getDownloadUrl(projectId, selectedExp.id, fileId);
      window.open(downloadUrl, '_blank');
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to get download URL');
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (!confirm('Are you sure you want to delete this file attachment?')) return;
    try {
      await experimentApi.deleteFile(projectId, selectedExp.id, fileId);
      setDetailFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to delete file');
    }
  };

  // Drag & drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Filtered experiments
  const filteredExperiments = experiments.filter((exp) => {
    const matchesSearch =
      exp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (exp.hypothesis && exp.hypothesis.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || exp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'running':
        return (
          <Badge variant="success" className="gap-1.5 font-mono">
            <StatusDot status="running" pulse />
            Running
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="success" className="gap-1.5 font-mono">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="danger" className="gap-1.5 font-mono">
            <XCircle className="w-3 h-3" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1.5 font-mono">
            <Clock className="w-3 h-3 text-warning" />
            Planned
          </Badge>
        );
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-card" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 border-danger/30 text-center space-y-4">
        <p className="text-xs text-danger font-medium">{error}</p>
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={fetchExperiments}>
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls Bar: Search, Status Filter Chips & Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-txt-faint absolute left-3 top-2.5" />
            <Input
              placeholder="Search experiments..."
              className="pl-9 text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1.5 bg-surface-2 p-1 rounded-input border border-border">
            {['all', 'planned', 'running', 'completed', 'failed'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium capitalize transition-colors ${
                  statusFilter === st
                    ? 'bg-surface-3 text-txt shadow-sm font-semibold'
                    : 'text-txt-muted hover:text-txt'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {isMember && (
          <Button variant="primary" icon={Plus} size="sm" onClick={() => setIsNewModalOpen(true)}>
            New Experiment
          </Button>
        )}
      </div>

      {/* Experiments Grid */}
      {filteredExperiments.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No experiments found"
          description={
            searchQuery || statusFilter !== 'all'
              ? 'No experiments match your search filters.'
              : 'Track hypotheses, execution notes, and file attachments for this research project.'
          }
          action={
            isMember && !searchQuery && statusFilter === 'all' ? (
              <Button variant="primary" icon={Plus} size="sm" onClick={() => setIsNewModalOpen(true)}>
                New Experiment
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExperiments.map((exp) => (
            <Card
              key={exp.id}
              className="p-5 hover:border-accent/40 cursor-pointer transition-all space-y-3 group flex flex-col justify-between"
              onClick={() => handleOpenDetail(exp)}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-txt group-hover:text-accent transition-colors line-clamp-1">
                    {exp.title}
                  </h4>
                  {getStatusBadge(exp.status)}
                </div>

                {exp.hypothesis && (
                  <p className="text-xs text-txt-muted line-clamp-2 leading-relaxed">
                    <span className="font-semibold text-txt-faint">Hypothesis:</span> {exp.hypothesis}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-border/50 flex items-center justify-between text-[11px] text-txt-faint font-mono">
                <span>Created {new Date(exp.created_at).toLocaleDateString()}</span>
                {exp.creator_name && <span className="truncate max-w-[110px]">{exp.creator_name}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* New Experiment Modal */}
      <Dialog isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} title="New Experiment">
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="Experiment Title"
            placeholder="e.g. Hyperparameter Sensitivity Matrix"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            required
          />

          <Textarea
            label="Hypothesis (Optional)"
            placeholder="What expected outcome or scientific premise are you testing?"
            rows={2}
            value={newHypothesis}
            onChange={(e) => setNewHypothesis(e.target.value)}
          />

          <Textarea
            label="Initial Notes / Setup (Markdown supported)"
            placeholder="Equipment settings, dataset versions, initial assumptions..."
            rows={3}
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
          />

          <div>
            <label className="block text-xs font-medium text-txt mb-1">Status</label>
            <select
              className="w-full bg-surface-2 border border-border rounded-input px-3 py-2 text-xs text-txt focus:outline-none focus:border-accent"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
            >
              <option value="planned">Planned</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="secondary" onClick={() => setIsNewModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={createLoading}>
              Create Experiment
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Experiment Detail Drawer / Dialog */}
      {selectedExp && (
        <Dialog
          isOpen={Boolean(selectedExp)}
          onClose={() => setSelectedExp(null)}
          title={selectedExp.title}
          className="max-w-3xl"
        >
          <div className="space-y-6">
            {/* Status Switcher Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg bg-surface-2 border border-border">
              <div className="space-y-1">
                <span className="text-[11px] font-mono uppercase text-txt-muted block">Status</span>
                {isMember ? (
                  <div className="flex gap-2">
                    {['planned', 'running', 'completed', 'failed'].map((st) => (
                      <button
                        key={st}
                        onClick={() => handleUpdateExperiment(st)}
                        className={`px-2.5 py-1 rounded text-xs capitalize font-medium transition-all ${
                          editStatus === st
                            ? st === 'running'
                              ? 'bg-success text-bg font-semibold'
                              : st === 'completed'
                              ? 'bg-success/20 text-success border border-success/30 font-semibold'
                              : st === 'failed'
                              ? 'bg-danger/20 text-danger border border-danger/30 font-semibold'
                              : 'bg-accent text-white font-semibold'
                            : 'bg-surface text-txt-muted hover:text-txt border border-border'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div>{getStatusBadge(selectedExp.status)}</div>
                )}
              </div>

              {isMember && (
                <Button
                  variant="danger"
                  size="sm"
                  icon={Trash2}
                  onClick={() => setIsDeleteExpConfirm(true)}
                >
                  Delete
                </Button>
              )}
            </div>

            {/* Inner Tabs for Detail View */}
            <div className="flex border-b border-border gap-6">
              {[
                { id: 'notes', label: 'Notes & Hypothesis' },
                { id: 'results', label: 'Results' },
                { id: 'files', label: `Files (${detailFiles.length})` },
                { id: 'links', label: `Traceability Links (${detailLinks.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveDetailTab(tab.id)}
                  className={`pb-2 text-xs font-semibold border-b-2 transition-colors ${
                    activeDetailTab === tab.id
                      ? 'border-accent text-accent'
                      : 'border-transparent text-txt-muted hover:text-txt'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Notes & Hypothesis */}
            {activeDetailTab === 'notes' && (
              <div className="space-y-4">
                <Textarea
                  label="Hypothesis"
                  placeholder="State the core hypothesis..."
                  rows={2}
                  value={editHypothesis}
                  onChange={(e) => setEditHypothesis(e.target.value)}
                  disabled={!isMember}
                />

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-txt">Notes (Markdown)</label>
                    <div className="flex items-center gap-1 bg-surface-2 p-0.5 rounded border border-border">
                      <button
                        type="button"
                        onClick={() => setEditorMode('write')}
                        className={`px-2 py-0.5 text-[10px] rounded font-medium ${
                          editorMode === 'write' ? 'bg-accent text-white' : 'text-txt-muted hover:text-txt'
                        }`}
                      >
                        <Edit3 className="w-3 h-3 inline mr-1" />
                        Write
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditorMode('preview')}
                        className={`px-2 py-0.5 text-[10px] rounded font-medium ${
                          editorMode === 'preview' ? 'bg-accent text-white' : 'text-txt-muted hover:text-txt'
                        }`}
                      >
                        <Eye className="w-3 h-3 inline mr-1" />
                        Preview
                      </button>
                    </div>
                  </div>

                  {editorMode === 'write' ? (
                    <Textarea
                      placeholder="Write detailed notes, formulas, configuration parameters..."
                      rows={6}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      disabled={!isMember}
                      className="font-mono text-xs"
                    />
                  ) : (
                    <div className="p-4 rounded-lg bg-surface-2 border border-border min-h-[140px] text-xs font-mono text-txt whitespace-pre-wrap leading-relaxed">
                      {editNotes || <span className="text-txt-faint italic">No notes written yet.</span>}
                    </div>
                  )}
                </div>

                {isMember && (
                  <div className="flex justify-end">
                    <Button variant="primary" size="sm" onClick={() => handleUpdateExperiment()} disabled={updateLoading}>
                      Save Changes
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Results */}
            {activeDetailTab === 'results' && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-txt">Experiment Results (Markdown)</label>
                  </div>

                  <Textarea
                    placeholder="Record findings, metrics, evaluation accuracy, loss curves..."
                    rows={8}
                    value={editResults}
                    onChange={(e) => setEditResults(e.target.value)}
                    disabled={!isMember}
                    className="font-mono text-xs"
                  />
                </div>

                {isMember && (
                  <div className="flex justify-end">
                    <Button variant="primary" size="sm" onClick={() => handleUpdateExperiment()} disabled={updateLoading}>
                      Save Results
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: File Attachments Flow */}
            {activeDetailTab === 'files' && (
              <div className="space-y-4">
                {/* Upload Drag & Drop Dropzone */}
                {isMember && (
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-card p-6 text-center cursor-pointer transition-all ${
                      dragActive ? 'border-accent bg-accent-soft/20' : 'border-border hover:border-accent/50 bg-surface-2'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    />
                    <UploadCloud className="w-8 h-8 text-accent mx-auto mb-2" />
                    <p className="text-xs font-semibold text-txt">
                      Drag & drop dataset files or click to browse
                    </p>
                    <p className="text-[11px] text-txt-muted mt-1">
                      Upload CSV, JSON, PNG, NPY or model weights up to 50MB
                    </p>
                  </div>
                )}

                {/* Progress Indicator */}
                {isUploading && (
                  <div className="space-y-1.5 p-3 rounded bg-surface-2 border border-border">
                    <div className="flex justify-between text-xs text-txt font-mono">
                      <span>Uploading file...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <ProgressBar value={uploadProgress} />
                  </div>
                )}

                {/* File Attachments List */}
                {detailFiles.length === 0 ? (
                  <p className="text-xs text-txt-muted text-center py-6">No file attachments associated with this experiment.</p>
                ) : (
                  <div className="space-y-2">
                    {detailFiles.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-surface-2 border border-border hover:border-border-strong transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Paperclip className="w-4 h-4 text-accent" />
                          <div>
                            <span className="text-xs font-semibold text-txt block">{f.file_name}</span>
                            <span className="text-[10px] font-mono text-txt-muted">
                              {formatBytes(f.size_bytes)} • {new Date(f.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={Download}
                            onClick={() => handleDownloadFile(f.id)}
                          >
                            Download
                          </Button>

                          {isMember && (
                            <button
                              onClick={() => handleDeleteFile(f.id)}
                              className="text-txt-faint hover:text-danger p-1 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Traceability Links */}
            {activeDetailTab === 'links' && (
              <div className="space-y-3">
                {detailLinks.length === 0 ? (
                  <p className="text-xs text-txt-muted text-center py-6">No connected activity or publication links registered.</p>
                ) : (
                  <div className="space-y-2">
                    {detailLinks.map((link, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg bg-surface-2 border border-border"
                      >
                        <div className="flex items-center gap-3">
                          <ExternalLink className="w-4 h-4 text-accent" />
                          <div>
                            <span className="text-xs font-semibold text-txt block">{link.label}</span>
                            <span className="text-[10px] font-mono text-txt-muted capitalize">
                              Entity: {link.type}
                            </span>
                          </div>
                        </div>
                        {link.createdAt && (
                          <span className="text-[10px] font-mono text-txt-faint">
                            {new Date(link.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Dialog>
      )}

      {/* Delete Experiment Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteExpConfirm}
        onClose={() => setIsDeleteExpConfirm(false)}
        onConfirm={handleDeleteExperiment}
        title="Delete Experiment"
        message={`Are you sure you want to delete "${selectedExp?.title}"? All attached file records will be purged.`}
        confirmText="Delete Experiment"
        requiredText={selectedExp?.title}
      />
    </div>
  );
};
