import React, { useState, useEffect } from 'react';
import {
  publicationApi,
  experimentApi,
  datasetApi,
  documentApi,
} from '../../services/api';
import {
  Card,
  Button,
  Input,
  Badge,
  Skeleton,
  EmptyState,
  Dialog,
  ConfirmDialog,
} from '../ui';
import {
  BookOpen,
  Plus,
  ExternalLink,
  GitBranch,
  Trash2,
  Edit3,
  Calendar,
  User,
  MapPin,
  Link as LinkIcon,
  Unlink,
  FlaskConical,
  Database,
  FileText,
  AlertCircle,
  RefreshCw,
  X,
  Search,
  CheckCircle2,
} from 'lucide-react';

const PUB_STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'published', label: 'Published' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'published', label: 'Published' },
];

function getStatusBadgeVariant(status) {
  switch (status) {
    case 'published':
      return 'success';
    case 'accepted':
      return 'info';
    case 'submitted':
      return 'warning';
    case 'draft':
    default:
      return 'secondary';
  }
}

export const PublicationsTab = ({ projectId, isMember, isLead }) => {
  const [publications, setPublications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // New Publication Modal & State
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAuthors, setNewAuthors] = useState('');
  const [newVenue, setNewVenue] = useState('');
  const [newDoi, setNewDoi] = useState('');
  const [newStatus, setNewStatus] = useState('draft');
  const [newPublishedOn, setNewPublishedOn] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Edit Publication Modal & State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPub, setEditingPub] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthors, setEditAuthors] = useState('');
  const [editVenue, setEditVenue] = useState('');
  const [editDoi, setEditDoi] = useState('');
  const [editStatus, setEditStatus] = useState('draft');
  const [editPublishedOn, setEditPublishedOn] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);

  // Delete Publication Confirm Dialog
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [pubToDelete, setPubToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Trace Modal & State
  const [isTraceOpen, setIsTraceOpen] = useState(false);
  const [selectedPub, setSelectedPub] = useState(null);
  const [traceData, setTraceData] = useState(null);
  const [traceLoading, setTraceLoading] = useState(false);

  // Link Artifact State (within Trace Modal)
  const [linkEntityType, setLinkEntityType] = useState('experiment');
  const [linkEntityId, setLinkEntityId] = useState('');
  const [linkingLoading, setLinkingLoading] = useState(false);

  // Project Artifacts for linking dropdowns
  const [availableExperiments, setAvailableExperiments] = useState([]);
  const [availableDatasets, setAvailableDatasets] = useState([]);
  const [availableDocuments, setAvailableDocuments] = useState([]);

  const fetchPublications = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await publicationApi.getPublications(projectId);
      setPublications(data || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load publications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchPublications();
    }
  }, [projectId]);

  // Load project entities when Trace modal opens so user can link them
  const loadProjectArtifacts = async () => {
    try {
      const [expList, dsList, docList] = await Promise.all([
        experimentApi.getExperiments(projectId).catch(() => []),
        datasetApi.getDatasets(projectId).catch(() => []),
        documentApi.getDocuments(projectId).catch(() => ({ documents: [] })),
      ]);
      setAvailableExperiments(expList || []);
      setAvailableDatasets(dsList || []);
      setAvailableDocuments(docList.documents || []);

      // Default selected item
      if (linkEntityType === 'experiment' && expList?.length > 0) {
        setLinkEntityId(expList[0].id);
      } else if (linkEntityType === 'dataset' && dsList?.length > 0) {
        setLinkEntityId(dsList[0].id);
      } else if (linkEntityType === 'document' && docList.documents?.length > 0) {
        setLinkEntityId(docList.documents[0].id);
      }
    } catch (err) {
      console.error('Error loading project artifacts', err);
    }
  };

  // Open Trace View
  const handleOpenTrace = async (pub) => {
    setSelectedPub(pub);
    setIsTraceOpen(true);
    setTraceLoading(true);
    try {
      const data = await publicationApi.getTrace(projectId, pub.id);
      setTraceData(data.trace || { experiments: [], datasets: [], documents: [] });
      await loadProjectArtifacts();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to load publication trace');
    } finally {
      setTraceLoading(false);
    }
  };

  // Refresh trace data
  const refreshTrace = async () => {
    if (!selectedPub) return;
    try {
      setTraceLoading(true);
      const data = await publicationApi.getTrace(projectId, selectedPub.id);
      setTraceData(data.trace || { experiments: [], datasets: [], documents: [] });
      fetchPublications();
    } catch (err) {
      console.error('Failed to refresh trace', err);
    } finally {
      setTraceLoading(false);
    }
  };

  // Add Link Submit
  const handleAddLink = async (e) => {
    e.preventDefault();
    if (!selectedPub || !linkEntityId) return;

    try {
      setLinkingLoading(true);
      await publicationApi.addLink(projectId, selectedPub.id, {
        entityType: linkEntityType,
        entityId: linkEntityId,
      });
      await refreshTrace();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to link artifact');
    } finally {
      setLinkingLoading(false);
    }
  };

  // Remove Link
  const handleRemoveLink = async (entityType, entityId) => {
    if (!selectedPub) return;
    try {
      setTraceLoading(true);
      await publicationApi.removeLink(projectId, selectedPub.id, {
        entityType,
        entityId,
      });
      await refreshTrace();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to unlink artifact');
      setTraceLoading(false);
    }
  };

  // Create Publication Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setCreateLoading(true);
      await publicationApi.createPublication(projectId, {
        title: newTitle.trim(),
        authors: newAuthors.trim() || null,
        venue: newVenue.trim() || null,
        doi: newDoi.trim() || null,
        status: newStatus,
        publishedOn: newPublishedOn || null,
      });

      setIsNewOpen(false);
      setNewTitle('');
      setNewAuthors('');
      setNewVenue('');
      setNewDoi('');
      setNewStatus('draft');
      setNewPublishedOn('');
      fetchPublications();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to create publication');
    } finally {
      setCreateLoading(false);
    }
  };

  // Edit Handlers
  const handleOpenEdit = (pub) => {
    setEditingPub(pub);
    setEditTitle(pub.title || '');
    setEditAuthors(pub.authors || '');
    setEditVenue(pub.venue || '');
    setEditDoi(pub.doi || '');
    setEditStatus(pub.status || 'draft');
    setEditPublishedOn(pub.published_on ? pub.published_on.split('T')[0] : '');
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editTitle.trim()) return;

    try {
      setUpdateLoading(true);
      await publicationApi.updatePublication(projectId, editingPub.id, {
        title: editTitle.trim(),
        authors: editAuthors.trim() || null,
        venue: editVenue.trim() || null,
        doi: editDoi.trim() || null,
        status: editStatus,
        publishedOn: editPublishedOn || null,
      });
      setIsEditOpen(false);
      setEditingPub(null);
      fetchPublications();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to update publication');
    } finally {
      setUpdateLoading(false);
    }
  };

  // Delete Handlers
  const handleOpenDelete = (pub) => {
    setPubToDelete(pub);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pubToDelete) return;
    try {
      setDeleteLoading(true);
      await publicationApi.deletePublication(projectId, pubToDelete.id);
      setIsDeleteOpen(false);
      setPubToDelete(null);
      fetchPublications();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to delete publication');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Client-side filtering
  const filteredPubs = publications.filter((p) => {
    const matchesStatus = selectedStatus === 'all' || p.status === selectedStatus;
    const matchesQuery =
      !searchQuery.trim() ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.authors && p.authors.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.venue && p.venue.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-txt-faint" />
          <input
            type="text"
            placeholder="Search by title, authors, venue..."
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
            onClick={() => setIsNewOpen(true)}
          >
            New Publication
          </Button>
        )}
      </div>

      {/* Status Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {PUB_STATUSES.map((st) => (
          <button
            key={st.value}
            onClick={() => setSelectedStatus(st.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              selectedStatus === st.value
                ? 'bg-accent/15 text-accent border border-accent/30 font-semibold'
                : 'bg-surface-2 text-txt-muted hover:text-txt border border-border/50 hover:border-border'
            }`}
          >
            {st.label}
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
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={fetchPublications}>
            Retry
          </Button>
        </Card>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="w-20 h-5 rounded-full" />
                <Skeleton className="w-24 h-4" />
              </div>
              <Skeleton className="w-2/3 h-6" />
              <Skeleton className="w-1/2 h-4" />
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredPubs.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title={searchQuery || selectedStatus !== 'all' ? 'No matching publications' : 'No publications yet'}
          description={
            searchQuery || selectedStatus !== 'all'
              ? 'Try modifying your search or status filter.'
              : 'Add manuscripts, conference papers, or journal articles and trace them back to project experiments, datasets, and documents.'
          }
          action={
            isMember ? (
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => setIsNewOpen(true)}
              >
                Add First Publication
              </Button>
            ) : null
          }
        />
      )}

      {/* Publications List */}
      {!loading && !error && filteredPubs.length > 0 && (
        <div className="space-y-4">
          {filteredPubs.map((pub) => {
            const badgeVariant = getStatusBadgeVariant(pub.status);
            const linkCount = parseInt(pub.link_count || 0);

            return (
              <Card
                key={pub.id}
                className="p-5 hover:border-border-strong transition-all duration-200 group flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Main Information */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Badge variant={badgeVariant} className="capitalize text-[10px] tracking-wider px-2 py-0.5">
                      {pub.status}
                    </Badge>
                    {pub.venue && (
                      <span className="text-xs font-semibold text-accent flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {pub.venue}
                      </span>
                    )}
                    {pub.published_on && (
                      <span className="text-[11px] font-mono text-txt-faint flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(pub.published_on).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <h3
                    className="text-base font-semibold text-txt group-hover:text-accent transition-colors cursor-pointer"
                    onClick={() => handleOpenTrace(pub)}
                  >
                    {pub.title}
                  </h3>

                  {pub.authors && (
                    <p className="text-xs text-txt-muted flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-txt-faint shrink-0" />
                      <span>{pub.authors}</span>
                    </p>
                  )}

                  {pub.doi && (
                    <div className="pt-1 flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-txt-faint font-mono">DOI:</span>
                      <a
                        href={pub.doi.startsWith('http') ? pub.doi : `https://doi.org/${pub.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-accent hover:underline flex items-center gap-1"
                      >
                        {pub.doi}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Right Side: Traceability & Actions */}
                <div className="flex flex-wrap md:flex-col items-end justify-between md:justify-center gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-border/50">
                  {/* Traceability Button */}
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={GitBranch}
                    onClick={() => handleOpenTrace(pub)}
                    className="gap-2"
                  >
                    Traceability
                    <span className="px-1.5 py-0.2 rounded-full bg-accent/20 text-accent font-mono text-[10px] font-bold">
                      {linkCount}
                    </span>
                  </Button>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {isMember && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Edit3}
                        onClick={() => handleOpenEdit(pub)}
                        title="Edit publication"
                      />
                    )}

                    {isLead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        onClick={() => handleOpenDelete(pub)}
                        className="text-txt-faint hover:text-danger"
                        title="Delete publication (Lead only)"
                      />
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Trace View & Link Management Modal */}
      <Dialog
        isOpen={isTraceOpen}
        onClose={() => setIsTraceOpen(false)}
        title="Publication Traceability & Artifact Lineage"
        className="max-w-3xl"
      >
        <div className="space-y-6">
          {/* Publication Header */}
          {selectedPub && (
            <div className="p-4 rounded-xl bg-surface-2 border border-border/70 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant={getStatusBadgeVariant(selectedPub.status)} className="capitalize text-[10px]">
                  {selectedPub.status}
                </Badge>
                {selectedPub.venue && (
                  <span className="text-xs font-medium text-accent">{selectedPub.venue}</span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-txt">{selectedPub.title}</h3>
              {selectedPub.authors && (
                <p className="text-xs text-txt-muted">{selectedPub.authors}</p>
              )}
            </div>
          )}

          {/* Trace Loading State */}
          {traceLoading && (
            <div className="py-8 space-y-3">
              <Skeleton className="w-1/3 h-4" />
              <Skeleton className="w-full h-12 rounded-lg" />
              <Skeleton className="w-full h-12 rounded-lg" />
            </div>
          )}

          {/* Trace Results */}
          {!traceLoading && traceData && (
            <div className="space-y-6">
              {/* Linked Experiments */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-txt uppercase tracking-wider flex items-center gap-1.5">
                    <FlaskConical className="w-3.5 h-3.5 text-accent" />
                    Linked Experiments ({traceData.experiments?.length || 0})
                  </h4>
                </div>

                {(!traceData.experiments || traceData.experiments.length === 0) ? (
                  <p className="text-xs text-txt-faint italic p-3 rounded-lg bg-surface-2/40 border border-border/40">
                    No experiments linked to this publication yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {traceData.experiments.map((exp) => (
                      <div
                        key={exp.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-surface-2 border border-border/60 hover:border-border transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <FlaskConical className="w-4 h-4 text-accent shrink-0" />
                          <div>
                            <span className="text-xs font-semibold text-txt block">{exp.title}</span>
                            <span className="text-[11px] text-txt-muted flex items-center gap-2">
                              <Badge variant="secondary" className="capitalize text-[9px] py-0">
                                {exp.status}
                              </Badge>
                              <span>by {exp.created_by_name || 'Member'}</span>
                            </span>
                          </div>
                        </div>

                        {isMember && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Unlink}
                            onClick={() => handleRemoveLink('experiment', exp.id)}
                            className="text-txt-faint hover:text-danger"
                            title="Unlink experiment"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Linked Datasets */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-txt uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-accent" />
                    Linked Datasets ({traceData.datasets?.length || 0})
                  </h4>
                </div>

                {(!traceData.datasets || traceData.datasets.length === 0) ? (
                  <p className="text-xs text-txt-faint italic p-3 rounded-lg bg-surface-2/40 border border-border/40">
                    No datasets linked to this publication yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {traceData.datasets.map((ds) => (
                      <div
                        key={ds.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-surface-2 border border-border/60 hover:border-border transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Database className="w-4 h-4 text-accent shrink-0" />
                          <div>
                            <span className="text-xs font-semibold text-txt block">{ds.title}</span>
                            <span className="text-[11px] text-txt-muted flex items-center gap-2">
                              <span className="font-mono text-txt-faint text-[10px]">
                                {ds.version_count || 1} versions
                              </span>
                              <span>by {ds.created_by_name || 'Member'}</span>
                            </span>
                          </div>
                        </div>

                        {isMember && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Unlink}
                            onClick={() => handleRemoveLink('dataset', ds.id)}
                            className="text-txt-faint hover:text-danger"
                            title="Unlink dataset"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Linked Documents */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-txt uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-accent" />
                    Linked Documents ({traceData.documents?.length || 0})
                  </h4>
                </div>

                {(!traceData.documents || traceData.documents.length === 0) ? (
                  <p className="text-xs text-txt-faint italic p-3 rounded-lg bg-surface-2/40 border border-border/40">
                    No documents linked to this publication yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {traceData.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-surface-2 border border-border/60 hover:border-border transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-accent shrink-0" />
                          <div>
                            <span className="text-xs font-semibold text-txt block">{doc.title}</span>
                            <span className="text-[11px] text-txt-muted flex items-center gap-2">
                              <Badge variant="accent" className="capitalize text-[9px] py-0">
                                {doc.doc_type}
                              </Badge>
                              <span>by {doc.uploaded_by_name || 'Member'}</span>
                            </span>
                          </div>
                        </div>

                        {isMember && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Unlink}
                            onClick={() => handleRemoveLink('document', doc.id)}
                            className="text-txt-faint hover:text-danger"
                            title="Unlink document"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Link New Artifact Form */}
              {isMember && (
                <div className="p-4 rounded-xl bg-surface-2 border border-border/80 space-y-3 pt-4">
                  <h4 className="text-xs font-semibold text-txt uppercase tracking-wider flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-accent" />
                    Link Project Artifact to this Publication
                  </h4>

                  <form onSubmit={handleAddLink} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    {/* Entity Type Picker */}
                    <div className="md:col-span-4">
                      <label className="block text-[11px] font-medium text-txt-muted mb-1">
                        Artifact Type
                      </label>
                      <select
                        value={linkEntityType}
                        onChange={(e) => {
                          const newType = e.target.value;
                          setLinkEntityType(newType);
                          if (newType === 'experiment' && availableExperiments.length > 0) {
                            setLinkEntityId(availableExperiments[0].id);
                          } else if (newType === 'dataset' && availableDatasets.length > 0) {
                            setLinkEntityId(availableDatasets[0].id);
                          } else if (newType === 'document' && availableDocuments.length > 0) {
                            setLinkEntityId(availableDocuments[0].id);
                          } else {
                            setLinkEntityId('');
                          }
                        }}
                        className="w-full bg-surface border border-border rounded-input px-3 py-2 text-xs text-txt focus:outline-none focus:border-accent"
                      >
                        <option value="experiment">Experiment</option>
                        <option value="dataset">Dataset</option>
                        <option value="document">Document</option>
                      </select>
                    </div>

                    {/* Entity Selector */}
                    <div className="md:col-span-6">
                      <label className="block text-[11px] font-medium text-txt-muted mb-1">
                        Select Item
                      </label>
                      <select
                        value={linkEntityId}
                        onChange={(e) => setLinkEntityId(e.target.value)}
                        className="w-full bg-surface border border-border rounded-input px-3 py-2 text-xs text-txt focus:outline-none focus:border-accent"
                      >
                        {linkEntityType === 'experiment' &&
                          availableExperiments.map((exp) => (
                            <option key={exp.id} value={exp.id}>
                              {exp.title} ({exp.status})
                            </option>
                          ))}

                        {linkEntityType === 'dataset' &&
                          availableDatasets.map((ds) => (
                            <option key={ds.id} value={ds.id}>
                              {ds.name}
                            </option>
                          ))}

                        {linkEntityType === 'document' &&
                          availableDocuments.map((doc) => (
                            <option key={doc.id} value={doc.id}>
                              {doc.title} ({doc.doc_type})
                            </option>
                          ))}

                        {((linkEntityType === 'experiment' && availableExperiments.length === 0) ||
                          (linkEntityType === 'dataset' && availableDatasets.length === 0) ||
                          (linkEntityType === 'document' && availableDocuments.length === 0)) && (
                          <option value="">No {linkEntityType}s found in project</option>
                        )}
                      </select>
                    </div>

                    {/* Submit Button */}
                    <div className="md:col-span-2">
                      <Button
                        type="submit"
                        variant="primary"
                        className="w-full text-xs"
                        disabled={linkingLoading || !linkEntityId}
                      >
                        {linkingLoading ? 'Linking...' : 'Link'}
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* Close button */}
          <div className="flex justify-end pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsTraceOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>

      {/* New Publication Modal */}
      <Dialog
        isOpen={isNewOpen}
        onClose={() => !createLoading && setIsNewOpen(false)}
        title="Add Project Publication"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="Publication Title"
            placeholder="e.g. Scalable Federated Learning on Heterogeneous Edge Devices"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            required
          />

          <Input
            label="Authors"
            placeholder="e.g. Alex Johnson, Elena Rostova, Marcus Vance"
            value={newAuthors}
            onChange={(e) => setNewAuthors(e.target.value)}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Venue / Conference / Journal"
              placeholder="e.g. ICML 2026, Nature Communications"
              value={newVenue}
              onChange={(e) => setNewVenue(e.target.value)}
            />

            <Input
              label="DOI (Digital Object Identifier)"
              placeholder="e.g. 10.1145/3372278.3390678"
              value={newDoi}
              onChange={(e) => setNewDoi(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-txt mb-1">Lifecycle Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-input px-3 py-2 text-xs text-txt focus:outline-none focus:border-accent"
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Published Date"
              type="date"
              value={newPublishedOn}
              onChange={(e) => setNewPublishedOn(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsNewOpen(false)}
              disabled={createLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={createLoading || !newTitle.trim()}
            >
              {createLoading ? 'Creating...' : 'Create Publication'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Publication Modal */}
      <Dialog
        isOpen={isEditOpen}
        onClose={() => !updateLoading && setIsEditOpen(false)}
        title="Edit Publication"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label="Publication Title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            required
          />

          <Input
            label="Authors"
            value={editAuthors}
            onChange={(e) => setEditAuthors(e.target.value)}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Venue / Conference / Journal"
              value={editVenue}
              onChange={(e) => setEditVenue(e.target.value)}
            />

            <Input
              label="DOI"
              value={editDoi}
              onChange={(e) => setEditDoi(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-txt mb-1">Lifecycle Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-input px-3 py-2 text-xs text-txt focus:outline-none focus:border-accent"
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Published Date"
              type="date"
              value={editPublishedOn}
              onChange={(e) => setEditPublishedOn(e.target.value)}
            />
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
              disabled={updateLoading || !editTitle.trim()}
            >
              {updateLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Publication ConfirmDialog */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Publication"
        message={`Are you sure you want to delete publication "${pubToDelete?.title}"? All links associated with this publication will be removed.`}
        confirmText="Delete Publication"
        requiredText={pubToDelete?.title}
      />
    </div>
  );
};
