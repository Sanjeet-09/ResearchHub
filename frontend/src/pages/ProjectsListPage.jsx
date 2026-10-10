import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectApi } from '../services/api';
import { PageHeader, Card, CardContent, Badge, Button, Input, Skeleton, EmptyState } from '../components/ui';
import { Plus, Search, FolderKanban, Users, Calendar } from 'lucide-react';
import { CreateProjectModal } from '../components/projects/CreateProjectModal';


export const ProjectsListPage = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
      setError(err.response?.data?.error?.message || 'Failed to load projects list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const isStudent = user?.role === 'student';

  const filteredProjects = projects.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Research Projects"
        description="Directory of ongoing university research initiatives and lab workspaces."
        action={
          !isStudent && (
            <Button icon={Plus} onClick={() => setIsCreateOpen(true)}>
              New Project
            </Button>
          )
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-txt-faint" />
          <Input
            placeholder="Search projects..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {['all', 'planning', 'active', 'on_hold', 'completed', 'published'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-surface-3 text-accent border border-accent/30'
                  : 'bg-surface text-txt-muted hover:text-txt border border-border'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Content Section */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : error ? (
        <Card className="p-8 border-danger/30 text-center">
          <p className="text-sm text-danger mb-4">{error}</p>
          <Button variant="secondary" onClick={fetchProjects}>
            Retry Loading
          </Button>
        </Card>
      ) : filteredProjects.length === 0 ? (
        <Card className="p-12">
          <EmptyState
            icon={FolderKanban}
            title={searchQuery || statusFilter !== 'all' ? "No matching projects" : "No research projects found"}
            description={
              searchQuery || statusFilter !== 'all'
                ? "Try clearing filters or search queries."
                : isStudent
                ? "You have not been assigned to any research projects."
                : "Create your first project to start organizing experiments and data."
            }
            action={
              !isStudent && !searchQuery && statusFilter === 'all' && (
                <Button icon={Plus} onClick={() => setIsCreateOpen(true)}>
                  Create Project
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`} className="block group">
              <Card className="p-6 border-border hover:border-border-strong transition-all hover:bg-surface-2 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-base font-semibold text-txt group-hover:text-accent transition-colors line-clamp-1">
                      {project.title}
                    </h3>
                    <Badge variant={project.status === 'active' ? 'success' : project.status === 'planning' ? 'accent' : 'secondary'}>
                      {project.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-txt-muted line-clamp-2 mb-4 leading-relaxed">
                    {project.description || 'No description provided for this research workspace.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-border/50 flex items-center justify-between text-xs text-txt-muted">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-txt-faint" />
                      <span className="font-mono">{project.member_count || 1}</span>
                    </span>
                    {project.start_date && (
                      <span className="flex items-center gap-1.5 font-mono text-[11px] text-txt-faint">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(project.start_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {project.project_role && (
                    <Badge variant="outline" className="uppercase text-[10px]">
                      {project.project_role}
                    </Badge>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

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
