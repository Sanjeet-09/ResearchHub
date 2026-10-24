import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { notificationApi } from '../services/api';
import { PageHeader, Card, Button, Badge, Skeleton, EmptyState, IconChip } from '../components/ui';
import {
  Bell,
  CheckCheck,
  Check,
  CalendarClock,
  FolderKanban,
  Database,
  BookOpen,
  Terminal,
  ExternalLink,
  RefreshCw,
  Info,
} from 'lucide-react';

const NOTIF_CONFIGS = {
  project_added: { icon: FolderKanban },
  reservation_confirmed: { icon: CalendarClock },
  reservation_cancelled: { icon: CalendarClock },
  dataset_version: { icon: Database },
  publication_status: { icon: BookOpen },
  lab_alert: { icon: Terminal },
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
    <div className="space-y-6 max-w-4xl mx-auto select-none">
      {/* Header */}
      <PageHeader
        title="Notifications"
        description="Updates regarding reservations, team activities, and project status changes."
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
                Mark all read
              </Button>
            )}
          </div>
        }
      />

      {/* Segmented Filter Control */}
      <div className="flex items-center justify-between pb-1">
        <div className="inline-flex items-center gap-1 p-1 bg-surface-2 rounded-[8px] border border-border">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-[6px] text-xs font-medium transition-colors ${
              activeFilter === 'all'
                ? 'bg-surface-3 text-text shadow-sm'
                : 'text-text-3 hover:text-text'
            }`}
          >
            All Notifications
          </button>
          <button
            onClick={() => setActiveFilter('unread')}
            className={`px-3 py-1.5 rounded-[6px] text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeFilter === 'unread'
                ? 'bg-surface-3 text-text shadow-sm'
                : 'text-text-3 hover:text-text'
            }`}
          >
            Unread
            {unreadCount > 0 && (
              <span className="bg-surface-1 border border-border-strong text-text px-1.5 py-0.2 rounded-full text-[10px] font-mono">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card className="p-4 bg-danger-bg border border-danger/30 text-xs text-danger flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={fetchNotifications} className="text-danger hover:bg-danger-bg">
            Retry
          </Button>
        </Card>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 flex gap-4 items-center">
              <Skeleton className="w-9 h-9 rounded-[8px] shrink-0" />
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
              ? "You're all caught up! There are no unread alerts right now."
              : 'Alerts and updates about project tasks and equipment bookings will show up here.'
          }
          actionLabel={activeFilter === 'unread' ? 'View all notifications' : undefined}
          onAction={() => setActiveFilter('all')}
        />
      )}

      {/* Notification List */}
      {!loading && notifications.length > 0 && (
        <div className="space-y-3">
          {notifications.map((notif) => {
            const conf = NOTIF_CONFIGS[notif.type] || {
              icon: Info,
            };
            const Icon = conf.icon;

            return (
              <Card
                key={notif.id}
                className={`p-4 transition-colors flex items-start justify-between gap-4 ${
                  notif.is_read
                    ? 'opacity-80 hover:opacity-100'
                    : 'border-border-strong'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <IconChip icon={Icon} size="md" />

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-semibold text-text">{notif.title}</h4>
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-text shrink-0" />
                      )}
                      <span className="text-[11px] font-mono text-text-3">
                        {formatTimeAgo(notif.created_at)}
                      </span>
                    </div>

                    {notif.body && (
                      <p className="text-xs text-text-2 leading-relaxed">
                        {notif.body}
                      </p>
                    )}

                    {notif.link && (
                      <div className="pt-1">
                        <Link
                          to={notif.link}
                          className="text-[11px] text-text hover:underline font-medium inline-flex items-center gap-1 transition-colors"
                        >
                          View details <ExternalLink className="w-3 h-3 stroke-[1.75]" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {!notif.is_read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-text-3 hover:text-text text-xs shrink-0"
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
