import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { notificationApi } from '../services/api';
import { PageHeader, Card, Button, Badge, Skeleton, EmptyState } from '../components/ui';
import {
  Bell,
  CheckCheck,
  Check,
  CalendarClock,
  FolderKanban,
  Database,
  BookOpen,
  FlaskConical,
  Terminal,
  ExternalLink,
  RefreshCw,
  Info,
} from 'lucide-react';

const NOTIF_ICONS = {
  project_added: { icon: FolderKanban, color: 'text-accent', bg: 'bg-accent/15 border-accent/30' },
  reservation_confirmed: { icon: CalendarClock, color: 'text-success', bg: 'bg-success/15 border-success/30' },
  reservation_cancelled: { icon: CalendarClock, color: 'text-danger', bg: 'bg-danger/15 border-danger/30' },
  dataset_version: { icon: Database, color: 'text-info', bg: 'bg-info/15 border-info/30' },
  publication_status: { icon: BookOpen, color: 'text-warning', bg: 'bg-warning/15 border-warning/30' },
  lab_alert: { icon: Terminal, color: 'text-accent', bg: 'bg-accent/15 border-accent/30' },
};

export const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread'
  const [actionLoading, setActionLoading] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (activeFilter === 'unread') {
        params.unreadOnly = 'true';
      }
      const data = await notificationApi.getNotifications(params);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [activeFilter]);

  const handleMarkAsRead = async (id) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setActionLoading(true);
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const formatTimeAgo = (dateStr) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Notifications"
        description="Stay updated with laboratory reservations, team activities, and project status changes."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={fetchNotifications}
              disabled={loading}
            >
              Refresh
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="primary"
                size="sm"
                icon={CheckCheck}
                onClick={handleMarkAllAsRead}
                disabled={actionLoading}
              >
                Mark All Read
              </Button>
            )}
          </div>
        }
      />

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeFilter === 'all'
                ? 'bg-accent/15 text-accent border border-accent/30'
                : 'text-txt-muted hover:text-txt bg-surface-2'
            }`}
          >
            All Notifications
          </button>
          <button
            onClick={() => setActiveFilter('unread')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeFilter === 'unread'
                ? 'bg-accent/15 text-accent border border-accent/30'
                : 'text-txt-muted hover:text-txt bg-surface-2'
            }`}
          >
            Unread
            {unreadCount > 0 && (
              <span className="bg-accent text-white px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card className="p-4 bg-danger/10 border-danger/30 text-xs text-danger flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={fetchNotifications} className="text-danger hover:bg-danger/20">
            Retry
          </Button>
        </Card>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 flex gap-4 items-center">
              <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && notifications.length === 0 && !error && (
        <EmptyState
          icon={Bell}
          title={activeFilter === 'unread' ? 'No unread notifications' : 'No notifications'}
          description={
            activeFilter === 'unread'
              ? "You're all caught up! There are no unread notifications right now."
              : 'Alerts and updates about project tasks and equipment bookings will show up here.'
          }
          actionText={activeFilter === 'unread' ? 'View All Notifications' : undefined}
          onAction={() => setActiveFilter('all')}
        />
      )}

      {/* Notification List */}
      {!loading && notifications.length > 0 && (
        <div className="space-y-2.5">
          {notifications.map((notif) => {
            const conf = NOTIF_ICONS[notif.type] || {
              icon: Info,
              color: 'text-accent',
              bg: 'bg-accent/15 border-accent/30',
            };
            const Icon = conf.icon;

            return (
              <Card
                key={notif.id}
                className={`p-4 transition-all flex items-start justify-between gap-4 ${
                  notif.is_read
                    ? 'bg-surface/50 border-border/50 opacity-80 hover:opacity-100'
                    : 'bg-surface-2 border-accent/30 ring-1 ring-accent/15 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${conf.bg} ${conf.color}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-semibold text-txt">{notif.title}</h4>
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-accent animate-pulse-soft" />
                      )}
                      <span className="text-[11px] font-mono text-txt-faint">
                        {formatTimeAgo(notif.created_at)}
                      </span>
                    </div>

                    {notif.body && (
                      <p className="text-xs text-txt-muted leading-relaxed">
                        {notif.body}
                      </p>
                    )}

                    {notif.link && (
                      <div className="pt-1">
                        <Link
                          to={notif.link}
                          className="text-[11px] text-accent hover:underline font-semibold inline-flex items-center gap-1"
                        >
                          View Details <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {!notif.is_read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-txt-muted hover:text-txt text-xs shrink-0"
                    icon={Check}
                    onClick={() => handleMarkAsRead(notif.id)}
                    title="Mark as Read"
                  >
                    Read
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
