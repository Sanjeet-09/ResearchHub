import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectApi } from '../services/api';
import { PageHeader, Card, CardHeader, CardTitle, CardContent, StatusDot, Badge, Button, Skeleton, EmptyState } from '../components/ui';
import { FolderKanban, TestTube, Bell, Terminal, Plus, ArrowRight, FolderPlus } from 'lucide-react';
import { CreateProjectModal } from '../components/projects/CreateProjectModal';

export const DashboardPage = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await projectApi.getProjects();
      setProjects(data || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const isStudent = user?.role === 'student';
  const activeProjectsCount = projects.filter(p => p.status === 'active' || p.status === 'planning').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user?.full_name || 'Researcher'}. Here is your research overview.`}
        action={
          !isStudent && (
            <Button icon={Plus} onClick={() => setIsCreateOpen(true)}>
              New Project
            </Button>
          )
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-txt-muted uppercase font-semibold">Active Projects</span>
              <div className="text-2xl font-bold text-txt mt-1">
                {loading ? <Skeleton className="h-8 w-12" /> : activeProjectsCount}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-accent-soft text-accent border border-accent/20">
              <FolderKanban className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-txt-muted uppercase font-semibold">Running Labs</span>
              <div className="text-2xl font-bold text-txt mt-1">0</div>
            </div>
            <div className="p-2.5 rounded-lg bg-success/10 text-success border border-success/20">
              <Terminal className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-txt-muted uppercase font-semibold">Reservations</span>
              <div className="text-2xl font-bold text-txt mt-1">0</div>
            </div>
            <div className="p-2.5 rounded-lg bg-warning/10 text-warning border border-warning/20">
              <TestTube className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-txt-muted uppercase font-semibold">Notifications</span>
              <div className="text-2xl font-bold text-txt mt-1">0</div>
            </div>
            <div className="p-2.5 rounded-lg bg-info/10 text-info border border-info/20">
              <Bell className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Projects */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-txt-muted">My Projects</h2>
            <Link to="/projects" className="text-xs text-accent hover:text-accent-hover flex items-center gap-1 font-medium transition-colors">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : error ? (
            <Card className="p-6 border-danger/30 text-center">
              <p className="text-xs text-danger mb-3">{error}</p>
              <Button variant="secondary" size="sm" onClick={fetchProjects}>
                Retry Loading
              </Button>
            </Card>
          ) : projects.length === 0 ? (
            <Card className="p-8">
              <EmptyState
                icon={FolderPlus}
                title="No active projects"
                description={isStudent ? "You have not been added to any projects yet." : "Get started by creating your first research project."}
                action={!isStudent && <Button icon={Plus} size="sm" onClick={() => setIsCreateOpen(true)}>Create Project</Button>}
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 4).map((p) => (
                <Link key={p.id} to={`/projects/${p.id}`} className="block group">
                  <Card className="p-5 border-border hover:border-border-strong transition-all hover:bg-surface-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-txt group-hover:text-accent transition-colors">
                            {p.title}
                          </h3>
                          <Badge variant={p.status === 'active' ? 'success' : p.status === 'planning' ? 'accent' : 'secondary'}>
                            {p.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-txt-muted line-clamp-1">
                          {p.description || 'No description provided'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-mono text-txt-faint block">
                          {p.member_count || 1} {p.member_count === 1 ? 'member' : 'members'}
                        </span>
                        {p.project_role && (
                          <Badge variant="outline" className="mt-1 uppercase text-[10px]">
                            {p.project_role}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed Stub */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-txt-muted">Recent Activity</h2>
          <Card>
            <CardContent className="p-4 space-y-4 text-xs">
              <div className="flex items-start gap-2.5">
                <StatusDot status="online" />
                <div>
                  <span className="font-semibold text-txt">System Initialized</span>
                  <p className="text-txt-muted">Phase 2 project service integration live</p>
                  <span className="text-[10px] font-mono text-txt-faint">Just now</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Project Modal */}
      {!isStudent && (
        <CreateProjectModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={fetchProjects}
        />
      )}
    </div>
  );
};
