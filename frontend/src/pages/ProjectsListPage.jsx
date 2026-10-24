import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectApi } from '../services/api';
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Input,
  Select,
  Skeleton,
  EmptyState,
  AvatarStack,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui';
import { Plus, Search, FolderKanban, LayoutGrid, List } from 'lucide-react';
import { CreateProjectModal } from '../components/projects/CreateProjectModal';

export const ProjectsListPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('table'); // Table by default per Section 4.3
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

  const statusOptions = [
    { value: 'all', label: 'All statuses' },
    { value: 'planning', label: 'Planning' },
    { value: 'active', label: 'Active' },
    { value: 'on_hold', label: 'On Hold' },
    { value: 'completed', label: 'Completed' },
    { value: 'published', label: 'Published' },
  ];

  return (
    <div className="space-y-6 select-none">
      <PageHeader
        title="Projects"
        description="Directory of university research initiatives and workspace repositories."
        action={
          !isStudent && (
            <Button variant="primary" size="md" icon={Plus} onClick={() => setIsCreateOpen(true)}>
              New project
            </Button>
          )
        }
      />

      {/* Toolbar per Section 4.3: search input, status filter select, grid/table toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-3 stroke-[1.75]" />
            <Input
              placeholder="Search projects..."
              className="pl-9 text-xs h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="w-40 shrink-0">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={statusOptions}
              className="text-xs h-9"
            />
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 p-1 bg-surface-2 rounded-[8px] border border-border self-end sm:self-auto">
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-[6px] transition-colors ${
              viewMode === 'table' ? 'bg-surface-3 text-text' : 'text-text-3 hover:text-text'
            }`}
            title="Table View"
          >
            <List className="w-4 h-4 stroke-[1.75]" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-[6px] transition-colors ${
              viewMode === 'grid' ? 'bg-surface-3 text-text' : 'text-text-3 hover:text-text'
            }`}
            title="Grid View"
          >
            <LayoutGrid className="w-4 h-4 stroke-[1.75]" />
          </button>
        </div>
      </div>

      {/* Content Section */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : error ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-danger mb-4">{error}</p>
          <Button variant="secondary" onClick={fetchProjects}>
            Retry loading
          </Button>
        </Card>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={searchQuery || statusFilter !== 'all' ? "No matching projects" : "No research projects found"}
          description={
            searchQuery || statusFilter !== 'all'
              ? "Try adjusting your search queries or status filters."
              : isStudent
              ? "You haven't been assigned to any research projects yet."
              : "Create your first project to start organizing experiments, datasets, and documents."
          }
          actionLabel={!isStudent && !searchQuery && statusFilter === 'all' ? "New project" : undefined}
          onAction={!isStudent && !searchQuery && statusFilter === 'all' ? () => setIsCreateOpen(true) : undefined}
        />
      ) : viewMode === 'table' ? (
        /* Table View per Section 4.3 (Default): Name, Status, Lead, Members, Dates, Updated */
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow hover={false}>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((project) => {
                const updatedDate = project.updated_at
                  ? new Date(project.updated_at).toLocaleDateString()
                  : 'Recently';
                const createdDate = project.created_at
                  ? new Date(project.created_at).toLocaleDateString()
                  : '—';
                const membersList = [
                  { name: user?.full_name || user?.name || 'User' },
                  { name: 'Collaborator' },
                ];

                return (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <TableCell>
                      <div className="font-medium text-text text-sm hover:underline">
                        {project.title}
                      </div>
                      {project.description && (
                        <div className="text-xs text-text-3 truncate max-w-sm mt-0.5">
                          {project.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
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
                        size="sm"
                      >
                        {project.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-text-2">
                        {project.lead_name || 'Dr. Researcher'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <AvatarStack users={membersList} size="sm" max={3} />
                    </TableCell>
                    <TableCell mono>
                      {createdDate}
                    </TableCell>
                    <TableCell mono>
                      {updatedDate}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        /* Grid View per Section 4.3: same card component with title, status badge, 2-line description, avatar stack */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => {
            const membersList = [
              { name: user?.full_name || user?.name || 'User' },
              { name: 'Collaborator' },
            ];

            return (
              <Link key={project.id} to={`/projects/${project.id}`} className="block">
                <Card className="p-5 flex flex-col justify-between h-44 hover:border-border-strong transition-colors">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold text-text line-clamp-1 hover:underline">
                        {project.title}
                      </h3>
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
                        size="sm"
                      >
                        {project.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-text-2 line-clamp-2 leading-relaxed">
                      {project.description || 'No description provided for this research workspace.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-text-3">
                    <AvatarStack users={membersList} size="sm" max={3} />
                    <span className="font-mono text-[11px] text-text-3">
                      {project.member_count || 1} {project.member_count === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
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
