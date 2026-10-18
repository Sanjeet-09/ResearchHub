import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectApi, authApi } from '../services/api';
import { PageHeader, Tabs, Card, CardHeader, CardTitle, CardContent, Badge, Button, Input, Select, Checkbox, Skeleton, Dialog, ConfirmDialog } from '../components/ui';
import { CheckCircle2, Circle, Clock, Plus, Trash2, UserPlus, ShieldAlert, Cpu, Sparkles } from 'lucide-react';
import { ExperimentsTab } from '../components/experiments/ExperimentsTab';
import { DatasetsTab } from '../components/datasets/DatasetsTab';
import { DocumentsTab } from '../components/documents/DocumentsTab';
import { PublicationsTab } from '../components/publications/PublicationsTab';
import { TimelineTab } from '../components/timeline/TimelineTab';
import { TeamActivityTab } from '../components/activity/TeamActivityTab';
import { LabTab } from '../components/lab/LabTab';
import { usePresence } from '../hooks/usePresence';

export const ProjectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser } = useAuth();

  const [project, setProject] = useState(null);
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals state
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isAddMilestoneOpen, setIsAddMilestoneOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Form states
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedMemberRole, setSelectedMemberRole] = useState('member');
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDueDate, setMilestoneDueDate] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await projectApi.getProjectById(id);
      setProject(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [id]);

  // Load available users when add member modal opens
  const handleOpenAddMember = async () => {
    try {
      setIsAddMemberOpen(true);
      const users = await authApi.getUsers();
      setAllUsers(users || []);
      if (users && users.length > 0) {
        setSelectedUserId(users[0].id);
      }
    } catch (err) {
      console.error('Failed to load users for assignment', err);
    }
  };

  const isProfessor = currentUser?.role === 'professor';
  const currentUserMember = project?.members?.find(m => m.user_id === currentUser?.id);
  const isLead = isProfessor || currentUserMember?.project_role === 'lead';
  const isMember = isLead || currentUserMember?.project_role === 'member';

  const getTabActivity = (tab, projectTitle) => {
    switch (tab) {
      case 'experiments':
        return `Reviewing experiments in ${projectTitle || 'project'}`;
      case 'datasets':
        return `Exploring datasets in ${projectTitle || 'project'}`;
      case 'documents':
        return `Browsing documents in ${projectTitle || 'project'}`;
      case 'publications':
        return `Checking publications in ${projectTitle || 'project'}`;
      case 'timeline':
        return `Viewing timeline in ${projectTitle || 'project'}`;
      case 'activity':
        return `Viewing team activity in ${projectTitle || 'project'}`;
      case 'lab':
        return `Testing environment in ${projectTitle || 'project'}`;
      case 'overview':
      default:
        return `Viewing ${projectTitle || 'project overview'}`;
    }
  };

  usePresence({
    projectId: id,
    currentActivity: getTabActivity(activeTab, project?.title),
    entityType: activeTab,
  });

  const handleStatusChange = async (newStatus) => {
    try {
      await projectApi.updateProjectStatus(id, newStatus);
      fetchProjectDetails();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to update status');
    }
  };

  const handleToggleGpu = async () => {
    try {
      await projectApi.updateProject(id, { allowStudentGpu: !project.allow_student_gpu });
      fetchProjectDetails();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to update GPU setting');
    }
  };

  const handleAddMemberSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;
    try {
      setActionLoading(true);
      await projectApi.addMember(id, selectedUserId, selectedMemberRole);
      setIsAddMemberOpen(false);
      fetchProjectDetails();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to add member');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      await projectApi.removeMember(id, userId);
      fetchProjectDetails();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to remove member');
    }
  };

  const handleAddMilestoneSubmit = async (e) => {
    e.preventDefault();
    if (!milestoneTitle.trim()) return;
    try {
      setActionLoading(true);
      await projectApi.createMilestone(id, {
        title: milestoneTitle,
        dueDate: milestoneDueDate || null,
      });
      setMilestoneTitle('');
      setMilestoneDueDate('');
      setIsAddMilestoneOpen(false);
      fetchProjectDetails();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to add milestone');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleMilestone = async (milestone) => {
    try {
      await projectApi.updateMilestone(id, milestone.id, { isDone: !milestone.is_done });
      fetchProjectDetails();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to update milestone');
    }
  };

  const handleDeleteMilestone = async (milestoneId) => {
    try {
      await projectApi.deleteMilestone(id, milestoneId);
      fetchProjectDetails();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to delete milestone');
    }
  };

  const handleDeleteProject = async () => {
    try {
      setActionLoading(true);
      await projectApi.deleteProject(id);
      navigate('/projects');
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to delete project');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <Card className="p-8 border-danger/30 text-center space-y-4">
        <ShieldAlert className="w-10 h-10 text-danger mx-auto" />
        <div>
          <h2 className="text-base font-semibold text-txt">Project Access Restricted</h2>
          <p className="text-xs text-txt-muted mt-1">{error || 'Project not found or access denied.'}</p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/projects')}>
          Back to Projects List
        </Button>
      </Card>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'experiments', label: 'Experiments' },
    { id: 'datasets', label: 'Datasets' },
    { id: 'documents', label: 'Documents' },
    { id: 'publications', label: 'Publications' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'lab', label: 'Testing Environment' },
    { id: 'activity', label: 'Team Activity' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={project.title}
        description={project.description || 'No project description.'}
        action={
          <div className="flex items-center gap-3">
            <Badge variant={project.status === 'active' ? 'success' : project.status === 'planning' ? 'accent' : 'secondary'} className="uppercase px-3 py-1">
              {project.status}
            </Badge>

            {isLead && (
              <Button variant="danger" size="sm" icon={Trash2} onClick={() => setIsDeleteConfirmOpen(true)}>
                Delete Project
              </Button>
            )}
          </div>
        }
      />

      {/* Underline Tabs Layout (Section 3.3) */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />

      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status & Settings Card */}
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-txt uppercase tracking-wider">Project Control & Settings</h3>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <div className="space-y-1">
                  <span className="text-xs text-txt-muted block font-medium">Project Lifecycle Status</span>
                  {isLead ? (
                    <div className="flex gap-2">
                      {['planning', 'active', 'on_hold', 'completed', 'published'].map((st) => (
                        <button
                          key={st}
                          onClick={() => handleStatusChange(st)}
                          className={`px-2.5 py-1 rounded text-xs capitalize transition-colors ${project.status === st
                              ? 'bg-accent text-white font-semibold'
                              : 'bg-surface-2 text-txt-muted hover:text-txt border border-border'
                            }`}
                        >
                          {st.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-txt capitalize">{project.status}</span>
                  )}
                </div>

                {isLead && (
                  <div className="pt-2">
                    <Checkbox
                      label="Allow Student GPU Labs"
                      checked={project.allow_student_gpu}
                      onChange={handleToggleGpu}
                    />
                  </div>
                )}
              </div>
            </Card>

            {/* Milestones Card */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-txt uppercase tracking-wider">Milestones</h3>
                {isMember && (
                  <Button variant="secondary" size="sm" icon={Plus} onClick={() => setIsAddMilestoneOpen(true)}>
                    Add Milestone
                  </Button>
                )}
              </div>

              {project.milestones.length === 0 ? (
                <p className="text-xs text-txt-muted py-4 text-center">No milestones created yet.</p>
              ) : (
                <div className="space-y-2">
                  {project.milestones.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-2 border border-border/60">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => isMember && handleToggleMilestone(m)}
                          disabled={!isMember}
                          className="text-accent hover:opacity-80 transition-opacity"
                        >
                          {m.is_done ? (
                            <CheckCircle2 className="w-5 h-5 text-success" />
                          ) : (
                            <Circle className="w-5 h-5 text-txt-faint" />
                          )}
                        </button>
                        <span className={`text-xs font-medium ${m.is_done ? 'line-through text-txt-muted' : 'text-txt'}`}>
                          {m.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        {m.due_date && (
                          <span className="text-[11px] font-mono text-txt-faint flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(m.due_date).toLocaleDateString()}
                          </span>
                        )}
                        {isLead && (
                          <button
                            onClick={() => handleDeleteMilestone(m.id)}
                            className="text-txt-faint hover:text-danger p-1 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar Column: Members Management */}
          <div className="space-y-6">
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-txt uppercase tracking-wider">Team Members</h3>
                {isLead && (
                  <Button variant="secondary" size="sm" icon={UserPlus} onClick={handleOpenAddMember}>
                    Add Member
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                {project.members.map((member) => (
                  <div key={member.user_id} className="flex items-center justify-between p-3 rounded-lg bg-surface-2 border border-border/40">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-txt">{member.full_name || 'Member'}</span>
                        <Badge variant={member.project_role === 'lead' ? 'accent' : 'secondary'} className="uppercase text-[9px] px-1.5 py-0">
                          {member.project_role}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-txt-muted block">{member.email}</span>
                    </div>

                    {isLead && member.user_id !== project.owner_id && (
                      <button
                        onClick={() => handleRemoveMember(member.user_id)}
                        className="text-txt-faint hover:text-danger p-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Experiments Tab */}
      {activeTab === 'experiments' && (
        <ExperimentsTab projectId={id} isMember={isMember} isLead={isLead} />
      )}

      {/* Datasets Tab */}
      {activeTab === 'datasets' && (
        <DatasetsTab projectId={id} isMember={isMember} isLead={isLead} />
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <DocumentsTab projectId={id} isMember={isMember} isLead={isLead} />
      )}

      {/* Publications Tab */}
      {activeTab === 'publications' && (
        <PublicationsTab projectId={id} isMember={isMember} isLead={isLead} />
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <TimelineTab projectId={id} />
      )}

      {/* Testing Environment Tab */}
      {activeTab === 'lab' && (
        <LabTab projectId={id} isMember={isMember} allowStudentGpu={project.allow_student_gpu} />
      )}

      {/* Team Activity Tab */}
      {activeTab === 'activity' && (
        <TeamActivityTab projectId={id} isMember={isMember} />
      )}

      {/* Other Tab Placeholders */}
      {!['overview', 'experiments', 'datasets', 'documents', 'publications', 'timeline', 'lab', 'activity'].includes(activeTab) && (
        <Card className="p-12 text-center text-txt-muted text-xs">
          The <span className="text-accent font-semibold capitalize">{activeTab}</span> tab for {project.title} will be integrated in subsequent phases.
        </Card>
      )}

      {/* Add Member Modal */}
      <Dialog isOpen={isAddMemberOpen} onClose={() => setIsAddMemberOpen(false)} title="Add Team Member">
        <form onSubmit={handleAddMemberSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-txt mb-1">Select User</label>
            <select
              className="w-full bg-surface-2 border border-border rounded-input px-3 py-2 text-xs text-txt focus:outline-none focus:border-accent"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.email}) — {u.role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-txt mb-1">Project Role</label>
            <select
              className="w-full bg-surface-2 border border-border rounded-input px-3 py-2 text-xs text-txt focus:outline-none focus:border-accent"
              value={selectedMemberRole}
              onChange={(e) => setSelectedMemberRole(e.target.value)}
            >
              <option value="member">Member (Can edit experiments & datasets)</option>
              <option value="lead">Lead (Full project admin permissions)</option>
              <option value="viewer">Viewer (Read-only access)</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="secondary" onClick={() => setIsAddMemberOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={actionLoading}>
              Add Member
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Add Milestone Modal */}
      <Dialog isOpen={isAddMilestoneOpen} onClose={() => setIsAddMilestoneOpen(false)} title="Add Project Milestone">
        <form onSubmit={handleAddMilestoneSubmit} className="space-y-4">
          <Input
            label="Milestone Title"
            placeholder="e.g. Complete Phase 1 Dataset Ingestion"
            value={milestoneTitle}
            onChange={(e) => setMilestoneTitle(e.target.value)}
            required
          />

          <Input
            label="Due Date"
            type="date"
            value={milestoneDueDate}
            onChange={(e) => setMilestoneDueDate(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="secondary" onClick={() => setIsAddMilestoneOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={actionLoading}>
              Add Milestone
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Confirm Delete Project Modal */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDeleteProject}
        title="Delete Project"
        message={`Are you sure you want to permanently delete "${project.title}"? All associated metadata will be removed.`}
        confirmText="Delete Project"
        requiredText={project.title}
      />
    </div>
  );
};
