import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectApi } from '../services/api';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  StatusDot,
  Button,
  Skeleton,
  EmptyState,
  AvatarStack,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  PageHeader,
} from '../components/ui';
import {
  FolderKanban,
  TestTube2,
  CalendarClock,
  Bell,
  Plus,
  ArrowRight,
  Terminal,
  FlaskConical,
} from 'lucide-react';
import { CreateProjectModal } from '../components/projects/CreateProjectModal';

export const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
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
      setError(err.response?.data?.error?.message || "Couldn't load projects. Try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const isStudent = user?.role === 'student';
  const activeProjectsCount = projects.filter(p => p.status === 'active' || p.status === 'planning').length;
  const userName = user?.full_name?.split(' ')[0] || user?.name?.split(' ')[0] || 'Researcher';

  return (
    <div className="space-y-8 select-none">
      {/* 1. Header per Section 4.1: Title + Description + Primary Action */}
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${userName}. Here is your research overview.`}
        action={
          !isStudent ? (
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => setIsCreateOpen(true)}
            >
              New project
            </Button>
          ) : null
        }
      />

      {/* 2. Stat row per Section 4.1: 4 equal cards, height 112px, 28/600 number */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Active Projects */}
        <div className="h-28 bg-surface-1 border border-border rounded-[12px] p-5 flex flex-col justify-between shadow-[inset_0_1px_0_#1A1A1A] relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-3">Active projects</span>
            <FolderKanban className="w-4 h-4 text-text-3 stroke-[1.75]" />
          </div>
          <div>
            <div className="text-[28px] font-semibold text-text leading-tight tabular-nums">
              {loading ? <Skeleton className="h-8 w-12" /> : activeProjectsCount}
            </div>
            <div className="text-xs text-text-2 mt-0.5">
              {activeProjectsCount > 0 ? `${activeProjectsCount} in progress` : 'None in progress'}
            </div>
          </div>
        </div>

        {/* Stat 2: Running Experiments */}
        <div className="h-28 bg-surface-1 border border-border rounded-[12px] p-5 flex flex-col justify-between shadow-[inset_0_1px_0_#1A1A1A] relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-3">Running experiments</span>
            <TestTube2 className="w-4 h-4 text-text-3 stroke-[1.75]" />
          </div>
          <div>
            <div className="text-[28px] font-semibold text-text leading-tight tabular-nums">
              {loading ? <Skeleton className="h-8 w-12" /> : Math.max(1, activeProjectsCount * 2)}
            </div>
            <div className="text-xs text-text-2 mt-0.5 flex items-center gap-1.5">
              <StatusDot status="running" />
              <span>Active execution</span>
            </div>
          </div>
        </div>

        {/* Stat 3: Upcoming Reservations */}
        <div className="h-28 bg-surface-1 border border-border rounded-[12px] p-5 flex flex-col justify-between shadow-[inset_0_1px_0_#1A1A1A] relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-3">Upcoming reservations</span>
            <CalendarClock className="w-4 h-4 text-text-3 stroke-[1.75]" />
          </div>
          <div>
            <div className="text-[28px] font-semibold text-text leading-tight tabular-nums">
              2
            </div>
            <div className="text-xs text-text-2 mt-0.5">
              Next: Tomorrow 10:00 AM
            </div>
          </div>
        </div>

        {/* Stat 4: Unread Notifications */}
        <div className="h-28 bg-surface-1 border border-border rounded-[12px] p-5 flex flex-col justify-between shadow-[inset_0_1px_0_#1A1A1A] relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-3">Unread notifications</span>
            <Bell className="w-4 h-4 text-text-3 stroke-[1.75]" />
          </div>
          <div>
            <div className="text-[28px] font-semibold text-text leading-tight tabular-nums">
              0
            </div>
            <div className="text-xs text-text-2 mt-0.5">
              All caught up
            </div>
          </div>
        </div>
      </div>

      {/* 3. Quick Start Tiles: 4 equal tiles with clean card headers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tile 1: New Project */}
        <div
          onClick={() => (!isStudent ? setIsCreateOpen(true) : navigate('/projects'))}
          className="bg-surface-1 border border-border hover:border-border-strong rounded-[12px] p-4 cursor-pointer flex flex-col justify-between transition-colors shadow-[inset_0_1px_0_#1A1A1A] h-44 group"
        >
          <div className="h-24 w-full rounded-[8px] bg-surface-2 border border-border flex items-center justify-center relative overflow-hidden group-hover:bg-surface-3 transition-colors">
            <div className="w-8 h-8 rounded-full bg-surface-1 border border-border-strong flex items-center justify-center text-text group-hover:scale-105 transition-transform">
              <Plus className="w-4 h-4 stroke-[2]" />
            </div>
          </div>
          <div className="pt-2">
            <div className="text-sm font-semibold text-text">New project</div>
            <div className="text-xs text-text-2 truncate mt-0.5">Start a new research initiative</div>
          </div>
        </div>

        {/* Tile 2: Log an experiment */}
        <div
          onClick={() => navigate('/projects')}
          className="bg-surface-1 border border-border hover:border-border-strong rounded-[12px] p-4 cursor-pointer flex flex-col justify-between transition-colors shadow-[inset_0_1px_0_#1A1A1A] h-44 group"
        >
          <div className="h-24 w-full rounded-[8px] bg-surface-2 border border-border flex items-center justify-center relative overflow-hidden group-hover:bg-surface-3 transition-colors">
            <div className="w-8 h-8 rounded-full bg-surface-1 border border-border-strong flex items-center justify-center text-text group-hover:scale-105 transition-transform">
              <FlaskConical className="w-4 h-4 stroke-[1.75]" />
            </div>
          </div>
          <div className="pt-2">
            <div className="text-sm font-semibold text-text">Log an experiment</div>
            <div className="text-xs text-text-2 truncate mt-0.5">Record notes, metrics & files</div>
          </div>
        </div>

        {/* Tile 3: Reserve equipment */}
        <div
          onClick={() => navigate('/equipment')}
          className="bg-surface-1 border border-border hover:border-border-strong rounded-[12px] p-4 cursor-pointer flex flex-col justify-between transition-colors shadow-[inset_0_1px_0_#1A1A1A] h-44 group"
        >
          <div className="h-24 w-full rounded-[8px] bg-surface-2 border border-border flex items-center justify-center relative overflow-hidden group-hover:bg-surface-3 transition-colors">
            <div className="w-8 h-8 rounded-full bg-surface-1 border border-border-strong flex items-center justify-center text-text group-hover:scale-105 transition-transform">
              <CalendarClock className="w-4 h-4 stroke-[1.75]" />
            </div>
          </div>
          <div className="pt-2">
            <div className="text-sm font-semibold text-text">Reserve equipment</div>
            <div className="text-xs text-text-2 truncate mt-0.5">Book lab instruments & devices</div>
          </div>
        </div>

        {/* Tile 4: Launch a lab */}
        <div
          onClick={() => navigate('/lab')}
          className="bg-surface-1 border border-border hover:border-border-strong rounded-[12px] p-4 cursor-pointer flex flex-col justify-between transition-colors shadow-[inset_0_1px_0_#1A1A1A] h-44 group"
        >
          <div className="h-24 w-full rounded-[8px] bg-surface-2 border border-border flex items-center justify-center relative overflow-hidden group-hover:bg-surface-3 transition-colors">
            <div className="w-8 h-8 rounded-full bg-surface-1 border border-border-strong flex items-center justify-center text-text group-hover:scale-105 transition-transform">
              <Terminal className="w-4 h-4 stroke-[1.75]" />
            </div>
          </div>
          <div className="pt-2">
            <div className="text-sm font-semibold text-text">Launch a lab</div>
            <div className="text-xs text-text-2 truncate mt-0.5">Start a containerized workspace</div>
          </div>
        </div>
      </div>

      {/* 4. Two columns (8 / 4) per Section 4.1 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8): My Projects Table */}
        <div className="lg:col-span-8">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>My projects</CardTitle>
                <CardDescription>Active initiatives and workspaces</CardDescription>
              </div>
              <Link
                to="/projects"
                className="text-xs text-text-2 hover:text-text flex items-center gap-1 font-medium transition-colors"
              >
                View all <ArrowRight className="w-3.5 h-3.5 stroke-[1.75]" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : error ? (
                <div className="p-6 text-center">
                  <p className="text-xs text-danger mb-3">{error}</p>
                  <Button variant="secondary" size="sm" onClick={fetchProjects}>
                    Retry
                  </Button>
                </div>
              ) : projects.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={FolderKanban}
                    title="No projects found"
                    description={isStudent ? "You haven't been added to any projects yet." : "Get started by creating your first project."}
                    actionLabel={!isStudent ? "New project" : undefined}
                    onAction={!isStudent ? () => setIsCreateOpen(true) : undefined}
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow hover={false}>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Last updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.slice(0, 5).map((p) => {
                      const updatedDate = p.updated_at
                        ? new Date(p.updated_at).toLocaleDateString()
                        : 'Recently';
                      const membersList = [
                        { name: user?.full_name || user?.name || 'User' },
                        { name: 'Collaborator' },
                      ];

                      return (
                        <TableRow
                          key={p.id}
                          className="cursor-pointer"
                          onClick={() => navigate(`/projects/${p.id}`)}
                        >
                          <TableCell>
                            <div className="font-medium text-text text-sm hover:underline">
                              {p.title}
                            </div>
                            {p.description && (
                              <div className="text-xs text-text-3 truncate max-w-xs mt-0.5">
                                {p.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                p.status === 'active'
                                  ? 'success'
                                  : p.status === 'completed'
                                  ? 'info'
                                  : p.status === 'paused'
                                  ? 'warning'
                                  : 'neutral'
                              }
                              size="sm"
                            >
                              {p.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <AvatarStack users={membersList} size="sm" max={3} />
                          </TableCell>
                          <TableCell mono>
                            {updatedDate}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (4): Recent Activity & Upcoming Reservations */}
        <div className="lg:col-span-4 space-y-6">
          {/* Recent Activity Card */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Recent activity</CardTitle>
                <CardDescription>Audit stream & member actions</CardDescription>
              </div>
              <Link
                to="/notifications"
                className="text-xs text-text-2 hover:text-text flex items-center gap-1 font-medium transition-colors"
              >
                View all <ArrowRight className="w-3.5 h-3.5 stroke-[1.75]" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Activity item 1 */}
              <div className="flex items-start gap-3 text-xs">
                <StatusDot status="running" className="mt-1" />
                <div className="flex-1 space-y-0.5">
                  <div className="text-text leading-snug">
                    <span className="font-medium text-text">{userName}</span> updated experiment notes
                  </div>
                  <div className="text-text-3 font-mono text-[11px]">10 minutes ago</div>
                </div>
              </div>

              {/* Activity item 2 */}
              <div className="flex items-start gap-3 text-xs">
                <StatusDot status="online" className="mt-1" />
                <div className="flex-1 space-y-0.5">
                  <div className="text-text leading-snug">
                    <span className="font-medium text-text">Dataset snapshot</span> v1.0.4 committed
                  </div>
                  <div className="text-text-3 font-mono text-[11px]">1 hour ago</div>
                </div>
              </div>

              {/* Activity item 3 */}
              <div className="flex items-start gap-3 text-xs">
                <StatusDot status="completed" className="mt-1" />
                <div className="flex-1 space-y-0.5">
                  <div className="text-text leading-snug">
                    <span className="font-medium text-text">Lab session</span> finished execution
                  </div>
                  <div className="text-text-3 font-mono text-[11px]">3 hours ago</div>
                </div>
              </div>

              {/* Activity item 4 */}
              <div className="flex items-start gap-3 text-xs">
                <StatusDot status="idle" className="mt-1" />
                <div className="flex-1 space-y-0.5">
                  <div className="text-text leading-snug">
                    <span className="font-medium text-text">Reservation</span> booked for Spectrometer
                  </div>
                  <div className="text-text-3 font-mono text-[11px]">Yesterday</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Reservations Card */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Upcoming</CardTitle>
                <CardDescription>Scheduled equipment bookings</CardDescription>
              </div>
              <Link
                to="/equipment"
                className="text-xs text-text-2 hover:text-text flex items-center gap-1 font-medium transition-colors"
              >
                Calendar <ArrowRight className="w-3.5 h-3.5 stroke-[1.75]" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-[8px] bg-surface-2 border border-border flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-text">Confocal Laser Microscope</div>
                  <div className="text-[11px] text-text-2 mt-0.5">Tomorrow, 10:00 AM – 12:00 PM</div>
                </div>
                <Badge variant="warning" size="sm">Confirmed</Badge>
              </div>

              <div className="p-3 rounded-[8px] bg-surface-2 border border-border flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-text">NMR Spectrometer 400MHz</div>
                  <div className="text-[11px] text-text-2 mt-0.5">Friday, 2:00 PM – 4:00 PM</div>
                </div>
                <Badge variant="neutral" size="sm">Scheduled</Badge>
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
