import React, { useState, useEffect, useRef } from 'react';
import { documentApi } from '../../services/api';
import {
  Card,
  Button,
  Input,
  Select,
  Badge,
  Skeleton,
  EmptyState,
  ProgressBar,
  Dialog,
  ConfirmDialog,
} from '../ui';
import {
  UploadCloud,
  Search,
  Download,
  ExternalLink,
  Trash2,
  Edit3,
  FileText,
  Image as ImageIcon,
  FileCode,
  File,
  AlertCircle,
  RefreshCw,
  Plus,
  Calendar,
  User,
  HardDrive,
  X,
} from 'lucide-react';

const DOC_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'paper', label: 'Paper' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Image' },
  { value: 'report', label: 'Report' },
  { value: 'note', label: 'Note' },
  { value: 'other', label: 'Other' },
];

const DOC_TYPE_OPTIONS = [
  { value: 'paper', label: 'Research Paper' },
  { value: 'pdf', label: 'PDF Document' },
  { value: 'image', label: 'Image / Figure' },
  { value: 'report', label: 'Lab Report' },
  { value: 'note', label: 'Meeting / Field Note' },
  { value: 'other', label: 'Other' },
];

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function detectDocType(fileName = '', mimeType = '') {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf' || (mimeType && mimeType.includes('pdf'))) return 'pdf';
  if (['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif', 'bmp', 'ico', 'tiff'].includes(ext) || (mimeType && mimeType.startsWith('image/'))) return 'image';
  if (['tex', 'bib', 'docx', 'doc', 'odt', 'rtf', 'epub'].includes(ext)) return 'paper';
  if (['pptx', 'ppt', 'xlsx', 'xls', 'csv', 'tsv'].includes(ext)) return 'report';
  if (['md', 'markdown', 'txt', 'py', 'ipynb', 'js', 'jsx', 'ts', 'tsx', 'json', 'yaml', 'yml', 'sh', 'r', 'c', 'cpp', 'java'].includes(ext)) return 'note';
  return 'other';
}

function getDocIcon(type) {
  switch (type) {
    case 'paper':
    case 'pdf':
    case 'report':
      return FileText;
    case 'image':
      return ImageIcon;
    case 'note':
      return FileCode;
    default:
      return File;
  }
}

function getBadgeVariant(type) {
  switch (type) {
    case 'paper':
      return 'accent';
    case 'pdf':
      return 'info';
    case 'report':
      return 'warning';
    case 'image':
      return 'success';
    default:
      return 'secondary';
  }
}

export const DocumentsTab = ({ projectId, isMember, isLead }) => {
  const [documents, setDocuments] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Upload Modal & State (Multi-file queue)
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [currentUploadingIndex, setCurrentUploadingIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Edit Modal & State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDocType, setEditDocType] = useState('other');
  const [updateLoading, setUpdateLoading] = useState(false);

  // Delete Confirm Dialog
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Download state
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (selectedType !== 'all') params.docType = selectedType;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const data = await documentApi.getDocuments(projectId, params);
      setDocuments(data.documents || []);
      setTotalCount(data.total || 0);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchDocuments();
    }
  }, [projectId, selectedType, searchQuery]);



  // File Drag & Drop Handlers (Multi-file support)
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleFilesAdded = (incomingFiles) => {
    setUploadError(null);
    const newItems = incomingFiles.map((f, idx) => {
      const nameWithoutExt = f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      return {
        id: `${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
        file: f,
        title: nameWithoutExt || f.name,
        docType: detectDocType(f.name, f.type),
      };
    });
    setUploadQueue((prev) => [...prev, ...newItems]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAdded(Array.from(e.target.files));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveQueueItem = (id) => {
    setUploadQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateQueueItem = (id, field, value) => {
    setUploadQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Upload Submit (Batched multi-file upload)
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (uploadQueue.length === 0) {
      setUploadError('Please select at least one document to upload.');
      return;
    }

    for (const item of uploadQueue) {
      if (!item.title.trim()) {
        setUploadError(`Please provide a title for file: ${item.file.name}`);
        return;
      }
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadError(null);

      const total = uploadQueue.length;
      for (let i = 0; i < total; i++) {
        const item = uploadQueue[i];
        setCurrentUploadingIndex(i);

        const baseProgress = Math.round((i / total) * 100);
        const nextBaseProgress = Math.round(((i + 1) / total) * 100);

        // Step 1: Request signed upload URL
        const signedData = await documentApi.getUploadUrl(projectId, {
          fileName: item.file.name,
          mimeType: item.file.type || 'application/octet-stream',
          docType: item.docType,
          title: item.title.trim(),
        });

        // Step 2: Binary upload to storage with granular progress
        await documentApi.uploadFileBinary(signedData.uploadUrl, item.file, (percent) => {
          const itemPortion = (percent / 100) * (nextBaseProgress - baseProgress);
          setUploadProgress(Math.round(baseProgress + itemPortion));
        });

        // Step 3: Record document metadata in database
        await documentApi.createDocument(projectId, {
          title: item.title.trim(),
          docType: item.docType,
          gcsPath: signedData.gcsPath,
          mimeType: item.file.type || 'application/octet-stream',
          sizeBytes: item.file.size,
          fileName: item.file.name,
        });

        setUploadProgress(nextBaseProgress);
      }

      // Reset & close
      setIsUploadOpen(false);
      setUploadQueue([]);
      setCurrentUploadingIndex(0);
      setUploadProgress(0);
      fetchDocuments();
    } catch (err) {
      setUploadError(err.response?.data?.error?.message || err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  // View Document in New Tab Handler
  const handleViewDocument = async (doc) => {
    try {
      setDownloadingId(doc.id);
      const downloadRes = await documentApi.getDownloadUrl(projectId, doc.id);
      const url = typeof downloadRes === 'string' ? downloadRes : downloadRes?.downloadUrl;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to open document');
    } finally {
      setDownloadingId(null);
    }
  };

  // Download Handler (saves locally to device)
  const handleDownload = async (doc) => {
    try {
      setDownloadingId(doc.id);
      const downloadRes = await documentApi.getDownloadUrl(projectId, doc.id);
      const url = typeof downloadRes === 'string' ? downloadRes : downloadRes?.downloadUrl;
      if (url) {
        const downloadUrl = url.includes('?') ? `${url}&download=true` : `${url}?download=true`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', doc.file_name || doc.title || 'document');
        link.setAttribute('target', '_blank');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to retrieve download link');
    } finally {
      setDownloadingId(null);
    }
  };

  // Edit Handlers
  const handleOpenEdit = (doc) => {
    setEditingDoc(doc);
    setEditTitle(doc.title);
    setEditDocType(doc.doc_type);
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editTitle.trim()) return;

    try {
      setUpdateLoading(true);
      await documentApi.updateDocument(projectId, editingDoc.id, {
        title: editTitle.trim(),
        docType: editDocType,
      });
      setIsEditOpen(false);
      setEditingDoc(null);
      fetchDocuments();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to update document');
    } finally {
      setUpdateLoading(false);
    }
  };

  // Delete Handlers
  const handleOpenDelete = (doc) => {
    setDocToDelete(doc);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!docToDelete) return;
    try {
      setDeleteLoading(true);
      await documentApi.deleteDocument(projectId, docToDelete.id);
      setIsDeleteOpen(false);
      setDocToDelete(null);
      fetchDocuments();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to delete document');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Bar & Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-txt-faint" />
          <input
            type="text"
            placeholder="Search documents by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-border rounded-input pl-9 pr-8 py-2 text-xs text-txt placeholder-txt-faint focus:outline-none focus:border-accent transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-txt-faint hover:text-txt"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Primary Action Button */}
        {isMember && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => {
              setUploadError(null);
              setUploadQueue([]);
              setCurrentUploadingIndex(0);
              setUploadProgress(0);
              setIsUploadOpen(true);
            }}
          >
            Upload Document
          </Button>
        )}
      </div>

      {/* Type Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {DOC_TYPES.map((type) => (
          <button
            key={type.value}
            onClick={() => setSelectedType(type.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              selectedType === type.value
                ? 'bg-accent/15 text-accent border border-accent/30 font-semibold'
                : 'bg-surface-2 text-txt-muted hover:text-txt border border-border/50 hover:border-border'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Error Banner */}
      {error && (
        <Card className="p-4 border-danger/40 bg-danger/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-danger shrink-0" />
            <span className="text-xs text-danger">{error}</span>
          </div>
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={fetchDocuments}>
            Retry
          </Button>
        </Card>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="w-16 h-5 rounded-full" />
                <Skeleton className="w-12 h-4" />
              </div>
              <Skeleton className="w-3/4 h-5" />
              <div className="flex items-center gap-2 pt-2">
                <Skeleton className="w-4 h-4 rounded-full" />
                <Skeleton className="w-24 h-3" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && documents.length === 0 && (
        <EmptyState
          icon={FileText}
          title={searchQuery || selectedType !== 'all' ? 'No matching documents' : 'No documents in project'}
          description={
            searchQuery || selectedType !== 'all'
              ? 'Try modifying your search query or doc type filter to see results.'
              : 'Upload research papers, PDF reports, figures, or meeting notes to maintain full project documentation.'
          }
          action={
            isMember ? (
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => setIsUploadOpen(true)}
              >
                Upload First Document
              </Button>
            ) : null
          }
        />
      )}

      {/* Document Grid */}
      {!loading && !error && documents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => {
            const Icon = getDocIcon(doc.doc_type);
            const badgeVariant = getBadgeVariant(doc.doc_type);

            return (
              <Card
                key={doc.id}
                className="p-5 flex flex-col justify-between hover:border-border-strong transition-all duration-200 group"
              >
                <div className="space-y-3">
                  {/* Card Top: Type Badge & Size */}
                  <div className="flex items-center justify-between">
                    <Badge variant={badgeVariant} className="capitalize text-[10px] tracking-wider px-2 py-0.5">
                      {doc.doc_type}
                    </Badge>
                    <span className="text-[11px] font-mono text-txt-faint flex items-center gap-1">
                      <HardDrive className="w-3 h-3" />
                      {formatBytes(doc.size_bytes)}
                    </span>
                  </div>

                  {/* Document Title */}
                  <div className="flex items-start gap-2.5 pt-1">
                    <div className="p-2 rounded-lg bg-surface-2 border border-border/60 text-accent shrink-0 mt-0.5 group-hover:bg-accent/10 transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <h4
                      className="text-sm font-semibold text-txt line-clamp-2 leading-snug group-hover:text-accent transition-colors cursor-pointer"
                      onClick={() => handleViewDocument(doc)}
                      title="Open document in new tab"
                    >
                      {doc.title}
                    </h4>
                  </div>
                </div>

                {/* Card Bottom: Metadata & Actions */}
                <div className="pt-4 mt-4 border-t border-border/50 flex items-center justify-between">
                  <div className="space-y-1 text-[11px] text-txt-muted">
                    <div className="flex items-center gap-1.5" title={doc.uploaded_by_email}>
                      <User className="w-3 h-3 text-txt-faint" />
                      <span className="truncate max-w-[130px]">
                        {doc.uploaded_by_name || 'Member'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-txt-faint">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={ExternalLink}
                      onClick={() => handleViewDocument(doc)}
                      disabled={downloadingId === doc.id}
                      title="Open in new tab"
                    />

                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Download}
                      onClick={() => handleDownload(doc)}
                      disabled={downloadingId === doc.id}
                      title="Download document to device"
                    />

                    {isMember && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Edit3}
                        onClick={() => handleOpenEdit(doc)}
                        title="Edit metadata"
                      />
                    )}

                    {isMember && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        onClick={() => handleOpenDelete(doc)}
                        className="text-txt-faint hover:text-danger"
                        title="Delete document"
                      />
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload Document Modal (Multi-document support) */}
      <Dialog
        isOpen={isUploadOpen}
        onClose={() => !isUploading && setIsUploadOpen(false)}
        title="Upload Research Documents"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          {/* File Dropzone */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-txt">
                {uploadQueue.length === 0 ? 'Document Files' : `Files Queued (${uploadQueue.length})`}
              </label>
              {uploadQueue.length > 0 && !isUploading && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-accent hover:underline flex items-center gap-1 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add more files
                </button>
              )}
            </div>

            <div
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                dragActive
                  ? 'border-accent bg-accent-soft'
                  : 'border-border hover:border-border-strong bg-surface-2'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="space-y-1.5">
                <UploadCloud className="w-7 h-7 text-txt-faint mx-auto" />
                <p className="text-xs text-txt font-medium">
                  Drag and drop documents here, or <span className="text-accent underline">browse</span>
                </p>
                <p className="text-[11px] text-txt-faint">
                  Supports any document format: PDF, Word, PowerPoint, Excel, Images, Code, Notes, Archives (up to 500 MB per file)
                </p>
              </div>
            </div>
          </div>

          {/* Queued Files List */}
          {uploadQueue.length > 0 && (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {uploadQueue.map((item) => {
                const ItemIcon = getDocIcon(item.docType);
                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-surface border border-border/80 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <ItemIcon className="w-4 h-4 text-accent shrink-0" />
                        <span className="font-mono text-txt truncate text-xs" title={item.file.name}>
                          {item.file.name}
                        </span>
                        <span className="text-[10px] text-txt-faint font-mono shrink-0">
                          ({formatBytes(item.file.size)})
                        </span>
                      </div>

                      {!isUploading && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQueueItem(item.id)}
                          className="text-txt-faint hover:text-danger p-1 transition-colors rounded"
                          title="Remove from queue"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => handleUpdateQueueItem(item.id, 'title', e.target.value)}
                          placeholder="Document title..."
                          disabled={isUploading}
                          className="w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-txt focus:outline-none focus:border-accent"
                          required
                        />
                      </div>

                      <div>
                        <select
                          value={item.docType}
                          onChange={(e) => handleUpdateQueueItem(item.id, 'docType', e.target.value)}
                          disabled={isUploading}
                          className="w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-txt focus:outline-none focus:border-accent"
                        >
                          {DOC_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-txt-muted truncate">
                  Uploading file {currentUploadingIndex + 1} of {uploadQueue.length}: {uploadQueue[currentUploadingIndex]?.file?.name}
                </span>
                <span className="font-mono text-accent shrink-0">{uploadProgress}%</span>
              </div>
              <ProgressBar value={uploadProgress} />
            </div>
          )}

          {/* Upload Error Banner */}
          {uploadError && (
            <p className="text-xs text-danger bg-danger/10 p-2.5 rounded-lg border border-danger/30">
              {uploadError}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsUploadOpen(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isUploading || uploadQueue.length === 0}
            >
              {isUploading
                ? `Uploading (${currentUploadingIndex + 1}/${uploadQueue.length})...`
                : uploadQueue.length > 1
                ? `Upload All (${uploadQueue.length} Documents)`
                : 'Upload Document'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Document Modal */}
      <Dialog
        isOpen={isEditOpen}
        onClose={() => !updateLoading && setIsEditOpen(false)}
        title="Edit Document Information"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label="Document Title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-medium text-txt mb-1.5">Document Classification</label>
            <select
              value={editDocType}
              onChange={(e) => setEditDocType(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-input px-3 py-2 text-xs text-txt focus:outline-none focus:border-accent"
            >
              {DOC_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditOpen(false)}
              disabled={updateLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={updateLoading}
            >
              {updateLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Document Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Document"
        message={`Are you sure you want to permanently delete "${docToDelete?.title}"? The associated file in storage will be removed.`}
        confirmText="Delete Document"
        requiredText={docToDelete?.title}
      />
    </div>
  );
};
