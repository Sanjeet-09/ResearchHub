import React, { useState, useEffect, useRef } from 'react';
import { activityApi } from '../../services/api';
import { Card, Button, Badge, StatusDot, Avatar, Skeleton, EmptyState } from '../ui';
import {
  Users,
  Radio,
  RefreshCw,
  Filter,
  Layers,
  FlaskConical,
  Database,
  FileText,
  BookOpen,
  CalendarClock,
  UserPlus,
  Clock,
  Terminal,
  Activity,
  Pause,
  Play,
  CheckCircle2,
} from 'lucide-react';

const ENTITY_CONFIG = {
  experiment: { icon: FlaskConical, color: 'text-accent', bg: 'bg-accent/15 border-accent/30', label: 'Experiment' },
  dataset: { icon: Database, color: 'text-info', bg: 'bg-info/15 border-info/30', label: 'Dataset' },
  document: { icon: FileText, color: 'text-warning', bg: 'bg-warning/15 border-warning/30', label: 'Document' },
  publication: { icon: BookOpen, color: 'text-success', bg: 'bg-success/15 border-success/30', label: 'Publication' },
  member: { icon: UserPlus, color: 'text-purple-400', bg: 'bg-purple-500/15 border-purple-500/30', label: 'Member' },
  project: { icon: Layers, color: 'text-accent', bg: 'bg-accent/15 border-accent/30', label: 'Project' },
  equipment: { icon: CalendarClock, color: 'text-warning', bg: 'bg-warning/15 border-warning/30', label: 'Equipment' },
};

// Helper: Format relative time
function formatRelativeTime(dateString) {
  if (!dateString) return 'Never';
  const now = Date.now();
  const past = new Date(dateString).getTime();
  const diffSec = Math.max(0, Math.floor((now - past) / 1000));

  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export const TeamActivityTab = ({ projectId, isMember }) => {
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPolling, setIsPolling] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date());

  // Filters
  const [selectedMember, setSelectedMember] = useState('all');
  const [selectedEntityType, setSelectedEntityType] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState('all');

  const isMountedRef = useRef(true);

  // Fetch presence and activity events
  const fetchData = async (isManual = false) => {
    try {
      if (isManual) setLoading(true);
      setError(null);

      // Fetch team presence
      const presencePromise = activityApi.getProjectPresence(projectId);

      // Fetch activity timeline
      const timelineParams = { limit: 50 };
      if (selectedEntityType !== 'all') {
        timelineParams.entityType = selectedEntityType;
      }
      if (selectedMember !== 'all') {
        timelineParams.actorId = selectedMember;
      }
      if (selectedDateRange === 'today') {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        timelineParams.from = startOfToday.toISOString();
      } else if (selectedDateRange === '7d') {
        const past7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        timelineParams.from = past7d.toISOString();
      } else if (selectedDateRange === '30d') {
        const past30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        timelineParams.from = past30d.toISOString();
      }

      const timelinePromise = activityApi.getProjectTimeline(projectId, timelineParams);

      const [presenceData, timelineData] = await Promise.all([presencePromise, timelinePromise]);

      if (isMountedRef.current) {
        setMembers(presenceData.members || []);
        setEvents(timelineData.events || []);
        setLastRefreshedAt(new Date());
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.response?.data?.error?.message || err.message || 'Failed to load team activity');
      }
    } finally {
      if (isMountedRef.current && isManual) {
        setLoading(false);
      }
    }
  };

  // Initial load
  useEffect(() => {
    isMountedRef.current = true;
    setLoading(true);
    fetchData(true).finally(() => {
      if (isMountedRef.current) setLoading(false);
    });

    return () => {
      isMountedRef.current = false;
    };
  }, [projectId, selectedMember, selectedEntityType, selectedDateRange]);

  // 10s Live Polling per specification Section 10
  useEffect(() => {
    if (!isPolling) return;

    const intervalId = setInterval(() => {
      // Only poll when page tab is visible
      if (document.visibilityState === 'visible') {
        fetchData(false);
      }
    }, 10000); // 10 seconds

    return () => clearInterval(intervalId);
  }, [projectId, isPolling, selectedMember, selectedEntityType, selectedDateRange]);

  // Group events by day
  const groupedEvents = events.reduce((groups, evt) => {
    const day = new Date(evt.created_at).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    if (!groups[day]) groups[day] = [];
    groups[day].push(evt);
    return groups;
  }, {});

  const onlineCount = members.filter((m) => m.status === 'online').length;
  const idleCount = members.filter((m) => m.status === 'idle').length;

  const entityFilters = [
    { id: 'all', label: 'All Activities' },
    { id: 'experiment', label: 'Experiments' },
    { id: 'dataset', label: 'Datasets' },
    { id: 'document', label: 'Documents' },
    { id: 'publication', label: 'Publications' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'member', label: 'Members' },
  ];

  if (loading && members.length === 0) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-32 w-full rounded-card" />
          <Skeleton className="h-32 w-full rounded-card" />
          <Skeleton className="h-32 w-full rounded-card" />
        </div>
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-4 rounded-card border border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
            <Radio className="w-4 h-4 animate-pulse-soft" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-txt tracking-tight">Live Team Presence</h3>
              <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-surface-2 border border-border text-txt-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-ping" />
                {onlineCount} Online
                {idleCount > 0 && ` · ${idleCount} Idle`}
              </span>
            </div>
            <p className="text-xs text-txt-muted">
              Auto-refreshing every 10s · Updated {formatRelativeTime(lastRefreshedAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={isPolling ? Pause : Play}
            onClick={() => setIsPolling(!isPolling)}
            className="text-xs"
          >
            {isPolling ? 'Pause Live Sync' : 'Resume Live Sync'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => fetchData(true)}
            disabled={loading}
            className="text-xs"
          >
            Refresh Now
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-4 bg-danger/10 border-danger/30 text-danger text-xs flex items-center justify-between">
          <span>{error}</span>
          <Button variant="danger" size="sm" onClick={() => fetchData(true)}>
            Retry
          </Button>
        </Card>
      )}

      {/* ─── 1. Member Cards Grid (Section 3.7) ──────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs uppercase font-semibold text-txt-muted tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-accent" />
            Project Members ({members.length})
          </h4>
        </div>

        {members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No project members found"
            description="Team presence will display here once members join this project."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((member) => (
              <Card
                key={member.userId}
                className="p-4 space-y-3 relative hover:border-border-strong transition-all bg-surface/90"
              >
                {/* Header: Avatar, Name, Role badge, Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={member.fullName || member.email} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-txt truncate">
                          {member.fullName || 'User'}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-txt-muted truncate block">
                        {member.email}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant={
                        member.projectRole === 'lead'
                          ? 'accent'
                          : member.projectRole === 'member'
                          ? 'info'
                          : 'ghost'
                      }
                      size="sm"
                      className="capitalize"
                    >
                      {member.projectRole}
                    </Badge>
                    <StatusDot
                      status={member.status}
                      size="sm"
                      label={member.status}
                      className="text-[10px]"
                    />
                  </div>
                </div>

                {/* Doing Now Callout (Section 10) */}
                <div className="p-2.5 rounded-lg bg-surface-2 border border-border/80 flex items-start gap-2.5">
                  <div className="mt-0.5">
                    {member.labSession ? (
                      <Terminal className="w-3.5 h-3.5 text-accent animate-pulse-soft" />
                    ) : member.status === 'online' ? (
                      <Activity className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-txt-faint" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-txt-muted block uppercase tracking-wider font-semibold">
                      Doing Now
                    </span>
                    <span className="text-xs font-medium text-txt truncate block">
                      {member.doingNow}
                    </span>
                  </div>
                </div>

                {/* Footer: Last active */}
                <div className="flex items-center justify-between text-[11px] text-txt-faint pt-1 border-t border-border/60">
                  <span>Last heartbeat</span>
                  <span className="font-mono text-txt-muted">
                    {formatRelativeTime(member.lastHeartbeatAt)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ─── 2. Live Activity Feed (Section 10) ─────────────────────────────── */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" />
            <h4 className="text-sm font-semibold text-txt uppercase tracking-wider">
              Live Team Feed
            </h4>
            <span className="text-xs font-mono text-txt-faint">({events.length} events)</span>
          </div>

          {/* Member Filter Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-txt-muted font-medium">Filter Member:</label>
            <select
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className="bg-surface-2 border border-border rounded-input px-2.5 py-1 text-xs text-txt focus:outline-none focus:border-accent"
            >
              <option value="all">All Members</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.fullName || m.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Controls: Entity Pills & Date Range */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Entity Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-txt-faint uppercase tracking-wider font-semibold mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Entity:
            </span>
            {entityFilters.map((flt) => (
              <button
                key={flt.id}
                onClick={() => setSelectedEntityType(flt.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedEntityType === flt.id
                    ? 'bg-accent text-white font-semibold shadow-sm shadow-accent/20'
                    : 'bg-surface-2 text-txt-muted hover:text-txt border border-border hover:border-border-strong'
                }`}
              >
                {flt.label}
              </button>
            ))}
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-txt-faint uppercase tracking-wider font-semibold mr-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Range:
            </span>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
            ].map((rng) => (
              <button
                key={rng.id}
                onClick={() => setSelectedDateRange(rng.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  selectedDateRange === rng.id
                    ? 'bg-surface-3 text-txt border border-border-strong font-semibold shadow-sm'
                    : 'bg-surface-2 text-txt-muted hover:text-txt border border-border'
                }`}
              >
                {rng.label}
              </button>
            ))}
          </div>
        </div>

        {/* Feed List */}
        {events.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No activity events found"
            description="Recent mutations from team members will stream live here."
          />
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedEvents).map(([dayLabel, dayEvents]) => (
              <div key={dayLabel} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-semibold text-txt-muted uppercase tracking-wider">
                    {dayLabel}
                  </span>
                  <div className="flex-1 h-[1px] bg-border" />
                </div>

                <div className="space-y-2">
                  {dayEvents.map((evt) => {
                    const cfg = ENTITY_CONFIG[evt.entity_type] || {
                      icon: Layers,
                      color: 'text-accent',
                      bg: 'bg-accent/15 border-accent/30',
                      label: evt.entity_type || 'Activity',
                    };
                    const IconComponent = cfg.icon;
                    const eventTime = new Date(evt.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    });

                    return (
                      <div
                        key={evt.id}
                        className="p-3 rounded-lg bg-surface border border-border hover:border-border-strong transition-colors flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${cfg.bg}`}
                          >
                            <IconComponent className={`w-3.5 h-3.5 ${cfg.color}`} />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-txt truncate">
                                {evt.summary || evt.action}
                              </span>
                              <Badge variant="ghost" size="sm" className="capitalize text-[10px]">
                                {cfg.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-txt-muted mt-0.5">
                              <span className="font-medium text-txt-faint">
                                {evt.actor_name || evt.actor_email || 'System'}
                              </span>
                              {evt.actor_role && (
                                <span className="capitalize text-[10px] text-txt-faint">
                                  ({evt.actor_role})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="text-xs font-mono text-txt-muted block">
                            {eventTime}
                          </span>
                          <span className="text-[10px] text-txt-faint block">
                            {formatRelativeTime(evt.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamActivityTab;
