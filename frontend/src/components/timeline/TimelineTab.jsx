import React, { useState, useEffect } from 'react';
import { activityApi } from '../../services/api';
import { Card, Button, Badge, Skeleton, EmptyState, Avatar } from '../ui';
import {
  Clock,
  RefreshCw,
  Filter,
  Layers,
  FlaskConical,
  Database,
  FileText,
  BookOpen,
  UserPlus,
  CheckCircle2,
  CalendarClock,
  Sparkles,
  Info,
} from 'lucide-react';

const ENTITY_CONFIG = {
  experiment: { icon: FlaskConical, color: 'text-accent', bg: 'bg-accent/15 border-accent/30', label: 'Experiment' },
  dataset: { icon: Database, color: 'text-info', bg: 'bg-info/15 border-info/30', label: 'Dataset' },
  document: { icon: FileText, color: 'text-warning', bg: 'bg-warning/15 border-warning/30', label: 'Document' },
  publication: { icon: BookOpen, color: 'text-success', bg: 'bg-success/15 border-success/30', label: 'Publication' },
  member: { icon: UserPlus, color: 'text-purple-400', bg: 'bg-purple-500/15 border-purple-500/30', label: 'Member' },
  project: { icon: Layers, color: 'text-accent', bg: 'bg-accent/15 border-accent/30', label: 'Project' },
  milestone: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/15 border-success/30', label: 'Milestone' },
};

export const TimelineTab = ({ projectId }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEntityType, setSelectedEntityType] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  const fetchTimeline = async (targetPage = 1) => {
    try {
      setLoading(true);
      setError(null);
      const params = { page: targetPage, limit: 30 };
      if (selectedEntityType !== 'all') {
        params.entityType = selectedEntityType;
      }
      const data = await activityApi.getProjectTimeline(projectId, params);
      setEvents(data.events || []);
      setPagination(data.pagination || { total: 0, totalPages: 1 });
      setPage(targetPage);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load timeline events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline(1);
  }, [projectId, selectedEntityType]);

  // Format date helper
  const formatEventDate = (dateString) => {
    const d = new Date(dateString);
    return {
      date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    };
  };

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

  const filterPills = [
    { id: 'all', label: 'All Activities' },
    { id: 'experiment', label: 'Experiments' },
    { id: 'dataset', label: 'Datasets' },
    { id: 'document', label: 'Documents' },
    { id: 'publication', label: 'Publications' },
    { id: 'member', label: 'Members' },
  ];

  return (
    <div className="space-y-6">
      {/* Filters Header */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-txt uppercase tracking-wider">
              Project Activity Timeline ({pagination.total})
            </h3>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => fetchTimeline(page)}
            disabled={loading}
          >
            Refresh Feed
          </Button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border">
          <span className="text-[11px] text-txt-faint uppercase tracking-wider font-semibold mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Filter:
          </span>
          {filterPills.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedEntityType(p.id)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                selectedEntityType === p.id
                  ? 'bg-accent text-white font-semibold shadow-sm'
                  : 'bg-surface-2 text-txt-muted hover:text-txt border border-border/80'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Error Banner */}
      {error && (
        <Card className="p-4 bg-danger/10 border-danger/30 text-xs text-danger flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => fetchTimeline(1)} className="text-danger hover:bg-danger/20">
            Retry
          </Button>
        </Card>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4 items-start">
              <Skeleton className="w-8 h-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && events.length === 0 && !error && (
        <EmptyState
          icon={Layers}
          title="No timeline events yet"
          description="Activities from experiments, dataset uploads, documents, and publications will appear here."
          actionText={selectedEntityType !== 'all' ? 'Clear Filter' : undefined}
          onAction={() => setSelectedEntityType('all')}
        />
      )}

      {/* Timeline Feed */}
      {!loading && events.length > 0 && (
        <div className="space-y-8 relative before:absolute before:inset-0 before:left-3.5 before:w-[1px] before:bg-border/60">
          {Object.entries(groupedEvents).map(([dayLabel, dayEvents]) => (
            <div key={dayLabel} className="space-y-4">
              {/* Day Header Pill */}
              <div className="sticky top-16 z-10 flex items-center">
                <span className="bg-surface-2 border border-border px-3 py-1 rounded-full text-[11px] font-mono text-txt-muted shadow-sm flex items-center gap-1.5 ml-0.5">
                  <Clock className="w-3 h-3 text-accent" />
                  {dayLabel}
                </span>
              </div>

              {/* Day Items */}
              <div className="space-y-3 pl-8">
                {dayEvents.map((evt) => {
                  const entityConf = ENTITY_CONFIG[evt.entity_type] || {
                    icon: Info,
                    color: 'text-txt-muted',
                    bg: 'bg-surface-3 border-border',
                    label: evt.entity_type || 'Activity',
                  };
                  const EntityIcon = entityConf.icon;
                  const { time } = formatEventDate(evt.created_at);

                  return (
                    <Card
                      key={evt.id}
                      className="p-3.5 hover:border-border-strong transition-all space-y-2 bg-surface/80"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            name={evt.actor_name || evt.actor_email || 'Member'}
                            size="sm"
                          />
                          <div>
                            <span className="text-xs font-semibold text-txt">
                              {evt.actor_name || 'Project Member'}
                            </span>
                            {evt.actor_role && (
                              <span className="text-[10px] text-txt-faint uppercase font-mono ml-2">
                                ({evt.actor_role})
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1 ${entityConf.bg} ${entityConf.color}`}>
                            <EntityIcon className="w-2.5 h-2.5" />
                            {entityConf.label}
                          </span>
                          <span className="text-[11px] font-mono text-txt-faint">
                            {time}
                          </span>
                        </div>
                      </div>

                      {/* Summary */}
                      <p className="text-xs text-txt pl-8">
                        {evt.summary || evt.action}
                      </p>

                      {/* Metadata badges if present */}
                      {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                        <div className="pl-8 pt-1 flex items-center gap-2 flex-wrap">
                          {Object.entries(evt.metadata).map(([k, v]) => (
                            <span
                              key={k}
                              className="text-[10px] font-mono text-txt-muted bg-surface-2 px-2 py-0.5 rounded border border-border/60"
                            >
                              <strong className="text-txt-faint">{k}:</strong> {String(v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
