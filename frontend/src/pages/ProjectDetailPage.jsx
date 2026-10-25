import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectApi, authApi } from '../services/api';
import {
  Tabs,
  Card,
  Badge,
  Button,
  Input,
  Checkbox,
  Skeleton,
  Dialog,
  ConfirmDialog,
  Avatar,
  AvatarStack,
  EmptyState,
} from '../components/ui';
import {
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Trash2,
  UserPlus,
  ShieldAlert,
  TestTube2,
  Database,
  FileText,
  BookOpen,
  CalendarClock,
  Terminal,
  Users,
  FolderKanban,
  MessageSquare,
} from 'lucide-react';
import { ExperimentsTab } from '../components/experiments/ExperimentsTab';
import { DatasetsTab } from '../components/datasets/DatasetsTab';
import { DocumentsTab } from '../components/documents/DocumentsTab';
import { PublicationsTab } from '../components/publications/PublicationsTab';
import { TimelineTab } from '../components/timeline/TimelineTab';
import { TeamActivityTab } from '../components/activity/TeamActivityTab';
import { LabTab } from '../components/lab/LabTab';
import { ProjectDiscussionsTab } from '../components/discussions/ProjectDiscussionsTab';
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

  const isProfessor = currentUser?.role === 'professor' || currentUser?.role === 'admin';
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
        <Skeleton className="h-32 w-full rounded-[12px]" />
        <Skeleton className="h-10 w-80 rounded-[8px]" />
        <Skeleton className="h-64 w-full rounded-[12px]" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <Card className="p-8 text-center space-y-4">
        <ShieldAlert className="w-10 h-10 text-danger mx-auto stroke-[1.75]" />
        <div>
          <h2 className="text-base font-semibold text-text">Project Access Restricted</h2>
          <p className="text-xs text-text-2 mt-1">{error || 'Project not found or access denied.'}</p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/projects')}>
          Back to Projects List
        </Button>
      </Card>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FolderKanban },
    { id: 'experiments', label: 'Experiments', icon: TestTube2, badge: project.experiments_count },
    { id: 'datasets', label: 'Datasets', icon: Database, badge: project.datasets_count },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'publications', label: 'Publications', icon: BookOpen },
    { id: 'discussions', label: 'Discussions', icon: MessageSquare },
    { id: 'timeline', label: 'Timeline', icon: CalendarClock },
    { id: 'lab', label: 'Testing Environment', icon: Terminal },
    { id: 'activity', label: 'Team Activity', icon: Users },
  ];

  return (
    <div className="space-y-6 select-none">
      {/* 1. Header Block per Section 4.4: Title, status badge, avatar stack, actions */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-mono text-text-3 px-2 py-0.5 rounded bg-surface-2 border border-border">
                {project.id?.slice(0, 8)}
              </span>
              <Badge
                variant={
                  project.status === 'active'
                    ? 'success'
                    : project.status === 'completed'
                    ? 'info'
                    : project.status === 'on_hold'
                    ? 'warning'
                    : 'neutral'
                }
              >
                {project.status}
              </Badge>
              {project.allow_student_gpu && (
                <Badge variant="aiml" size="sm">
                  GPU Enabled
                </Badge>
              )}
            </div>
            
            <h1 className="text-2xl font-semibold tracking-tight text-text">
              {project.title}
            </h1>
            
            <p className="text-xs sm:text-sm text-text-2 leading-relaxed">
              {project.description || 'No project description provided.'}
            </p>

            {/* Avatar stack in header */}
            <div className="flex items-center gap-3 pt-1">
              <AvatarStack
                users={project.members?.map(m => ({
                  name: m.full_name || m.name || m.email,
                  id: m.user_id,
                })) || []}
                size="sm"
                max={5}
              />
              <span className="text-xs text-text-3 font-mono">
                {project.members?.length || 1} {project.members?.length === 1 ? 'member' : 'members'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0 self-start md:self-center">
            <Button
              variant={activeTab === 'discussions' ? 'primary' : 'secondary'}
              size="sm"
              icon={MessageSquare}
              onClick={() => handleTabChange('discussions')}
            >
              Discussions
            </Button>
            {isLead && (
              <Button variant="danger" size="sm" icon={Trash2} onClick={() => setIsDeleteConfirmOpen(true)}>
                Delete project
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* 2. Underline Tabs per Section 4.4 & 3.2: sticky at top: 76px with solid --bg */}
      <div className="sticky top-[76px] z-10 bg-bg pt-2 pb-0">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} variant="underline" />
      </div>

      {/* 3. Overview Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Control & Settings Card */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text">Project control & settings</h3>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <div className="space-y-2">
                  <span className="text-xs text-text-3 block font-medium">Status</span>
                  {isLead ? (
                    <div className="flex flex-wrap gap-2">
                      {['planning', 'active', 'on_hold', 'completed', 'published'].map((st) => (
                        <button
                          key={st}
                          onClick={() => handleStatusChange(st)}
                          className={`px-3 py-1 rounded-[6px] text-xs capitalize transition-colors ${
                            project.status === st
                              ? 'bg-primary text-primary-fg font-medium'
                              : 'bg-surface-2 text-text-2 hover:text-text border border-border'
                          }`}
                        >
                          {st.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-text capitalize">{project.status}</span>
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
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text">Milestones</h3>
                {isMember && (
                  <Button variant="secondary" size="sm" icon={Plus} onClick={() => setIsAddMilestoneOpen(true)}>
                    Add milestone
                  </Button>
                )}
              </div>

              {project.milestones.length === 0 ? (
                <p className="text-xs text-text-3 py-6 text-center">No milestones created yet.</p>
              ) : (
                <div className="space-y-2">
                  {project.milestones.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-[8px] bg-surface-2 border border-border">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => isMember && handleToggleMilestone(m)}
                          disabled={!isMember}
                          className="hover:opacity-80 transition-opacity"
                        >
                          {m.is_done ? (
                            <CheckCircle2 className="w-4 h-4 text-success stroke-[2]" />
                          ) : (
                            <Circle className="w-4 h-4 text-text-3 stroke-[1.75]" />
                          )}
                        </button>
                        <span className={`text-xs font-medium ${m.is_done ? 'line-through text-text-3' : 'text-text'}`}>
                          {m.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        {m.due_date && (
                          <span className="text-[11px] font-mono text-text-3 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 stroke-[1.75]" />
                            {new Date(m.due_date).toLocaleDateString()}
                          </span>
                        )}
                        {isLead && (
                          <button
                            onClick={() => handleDeleteMilestone(m.id)}
                            className="text-text-3 hover:text-danger p-1 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar Column: Team Members */}
          <div className="space-y-6">
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text">Team members</h3>
                {isLead && (
                  <Button variant="secondary" size="sm" icon={UserPlus} onClick={handleOpenAddMember}>
                    Add member
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                {project.members.map((member) => (
                  <div key={member.user_id} className="flex items-center justify-between p-2.5 rounded-[8px] bg-surface-2 border border-border">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={member.full_name || member.email} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-text truncate">{member.full_name || 'Member'}</span>
                          <Badge variant="neutral" size="sm">
                            {member.project_role}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-text-3 block truncate">{member.email}</span>
                      </div>
                    </div>

                    {isLead && member.user_id !== project.owner_id && (
                      <button
                        onClick={() => handleRemoveMember(member.user_id)}
                        className="text-text-3 hover:text-danger p-1 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Other Tabs */}
      {activeTab === 'experiments' && (
        <ExperimentsTab projectId={id} isMember={isMember} isLead={isLead} />
      )}

      {activeTab === 'datasets' && (
        <DatasetsTab projectId={id} isMember={isMember} isLead={isLead} />
      )}

      {activeTab === 'documents' && (
        <DocumentsTab projectId={id} isMember={isMember} isLead={isLead} />
      )}

      {activeTab === 'publications' && (
        <PublicationsTab projectId={id} isMember={isMember} isLead={isLead} />
      )}

      {activeTab === 'discussions' && (
        <ProjectDiscussionsTab projectId={id} isMember={isMember} isLead={isLead} />
      )}

      {activeTab === 'timeline' && (
        <TimelineTab projectId={id} />
      )}

      {activeTab === 'lab' && (
        isMember ? (
          <LabTab projectId={id} isMember={isMember} isLead={isLead} allowStudentGpu={project.allow_student_gpu} />
        ) : (
          <EmptyState
            icon={Terminal}
            title="Testing Environment Restricted"
            description="Testing environments require Member or Lead permissions in this project."
          />
        )
      )}

      {activeTab === 'activity' && (
        <TeamActivityTab projectId={id} isMember={isMember} />
      )}

      {/* Add Member Modal */}
      <Dialog isOpen={isAddMemberOpen} onClose={() => setIsAddMemberOpen(false)} title="Add Team Member">
        <form onSubmit={handleAddMemberSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-text-2">Select User</label>
            <select
              className="w-full h-9 bg-surface-2 border border-border rounded-[8px] px-3 text-xs text-text focus:outline-none focus-visible:outline-2 focus-visible:outline-[#EDEDED]"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              {allUsers.map((u) => (
                <option key={u.id} value={u.id} className="bg-surface-2 text-text">
                  {u.full_name} ({u.email}) — {u.role}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-text-2">Project Role</label>
            <select
              className="w-full h-9 bg-surface-2 border border-border rounded-[8px] px-3 text-xs text-text focus:outline-none focus-visible:outline-2 focus-visible:outline-[#EDEDED]"
              value={selectedMemberRole}
              onChange={(e) => setSelectedMemberRole(e.target.value)}
            >
              <option value="member" className="bg-surface-2 text-text">Member (Can edit experiments & datasets)</option>
              <option value="lead" className="bg-surface-2 text-text">Lead (Full project admin permissions)</option>
              <option value="viewer" className="bg-surface-2 text-text">Viewer (Read-only access)</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => setIsAddMemberOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={actionLoading}>
              Add Member
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Add Milestone Modal */}
      <Dialog isOpen={isAddMilestoneOpen} onClose={() => setIsAddMilestoneOpen(false)} title="Add Milestone">
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

          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => setIsAddMilestoneOpen(false)}>
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
        description={`Are you sure you want to permanently delete "${project.title}"? All associated metadata will be removed.`}
        confirmText="Delete Project"
        confirmName={project.title}
        variant="danger"
        isLoading={actionLoading}
      />
    </div>
  );
};
