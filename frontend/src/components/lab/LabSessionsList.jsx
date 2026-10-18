import React, { useState } from 'react';
import { Card, Badge, Button, StatusDot, Dialog } from '../ui';
import { LabStopDialog } from './LabStopDialog';
import { LabEditConfigModal } from './LabEditConfigModal';
import { labApi } from '../../services/api';
import {
  Play,
  Pause,
  Square,
  Clock,
  DollarSign,
  Cpu,
  Sparkles,
  ExternalLink,
  Layers,
  RotateCw,
  Settings,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

export const LabSessionsList = ({
  sessions = [],
  onSelectSession,
  onRefresh,
  onRestartSession,
}) => {
  const [stopSessionTarget, setStopSessionTarget] = useState(null);
  const [editSessionTarget, setEditSessionTarget] = useState(null);
  const [deleteSessionTarget, setDeleteSessionTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [restartingId, setRestartingId] = useState(null);

  const formatRuntime = (seconds) => {
    if (!seconds || seconds <= 0) return '0m';
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m ${seconds % 60}s`;
  };

  const handlePause = async (e, sessionId) => {
    e.stopPropagation();
    try {
      setActionLoading(true);
      await labApi.pauseSession(sessionId);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to pause session');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async (e, sessionId) => {
    e.stopPropagation();
    try {
      setActionLoading(true);
      await labApi.resumeSession(sessionId);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to resume session');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopConfirm = async ({ exportNotebooks }) => {
    if (!stopSessionTarget) return;
    try {
      setActionLoading(true);
      await labApi.stopSession(stopSessionTarget.id, exportNotebooks);
      setStopSessionTarget(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to stop session');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestart = async (e, session) => {
    e.stopPropagation();
    try {
      setRestartingId(session.id);
      setActionLoading(true);
      const res = await labApi.restartSession(session.id);
      if (onRestartSession) {
        onRestartSession(res);
      } else if (onSelectSession) {
        onSelectSession(res);
      } else if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to restart session');
    } finally {
      setActionLoading(false);
      setRestartingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteSessionTarget) return;
    try {
      setActionLoading(true);
      await labApi.deleteSession(deleteSessionTarget.id);
      setDeleteSessionTarget(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to delete session');
    } finally {
      setActionLoading(false);
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="p-12 text-center border border-dashed border-border rounded-xl bg-surface/50 space-y-3">
        <div className="w-12 h-12 rounded-full bg-surface-2 border border-border flex items-center justify-center mx-auto text-txt-muted">
          <Layers className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-txt">No Testing Sessions</h4>
          <p className="text-xs text-txt-muted max-w-sm mx-auto">
            You don't have any active or saved testing environments. Choose a container profile above to launch an interactive session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((s) => {
        const isAiml = s.profile_category === 'ai_ml';
        const isRunning = s.state === 'running';
        const isPaused = s.state === 'paused';
        const isStopped = s.state === 'stopped';
        const isFailed = s.state === 'failed';

        return (
          <Card
            key={s.id}
            onClick={() => onSelectSession && onSelectSession(s)}
            className={`p-4 transition-all duration-200 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 border ${
              isRunning
                ? 'border-accent/40 bg-surface-2/60 hover:bg-surface-2'
                : 'border-border bg-surface hover:bg-surface-2'
            }`}
          >
            {/* Session Info */}
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-semibold text-sm text-txt hover:text-accent transition-colors truncate">
                  {s.name}
                </span>

                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-3 border border-border text-[11px]">
                  <StatusDot
                    status={
                      isRunning
                        ? 'online'
                        : isPaused
                        ? 'idle'
                        : 'offline'
                    }
                    pulse={isRunning}
                  />
                  <span className="uppercase tracking-wider font-mono text-[10px] text-txt">
                    {s.state}
                  </span>
                </div>

                <Badge
                  variant={isAiml ? 'accent' : 'secondary'}
                  className="text-[10px] uppercase font-mono px-2 py-0.5 flex items-center gap-1"
                >
                  {isAiml ? <Sparkles className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
                  {s.profile_name || s.profile_key}
                </Badge>
              </div>

              {/* Meta details */}
              <div className="flex items-center gap-4 text-xs text-txt-muted flex-wrap">
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <Clock className="w-3 h-3 text-txt-faint" />
                  Runtime: {formatRuntime(s.total_runtime_seconds)}
                </span>

                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <DollarSign className="w-3 h-3 text-txt-faint" />
                  Est. Cost: ~${Number(s.est_cost_usd || 0).toFixed(4)}
                </span>

                <span className="text-txt-faint text-[11px]">
                  Created {new Date(s.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div
              className="flex items-center gap-2 flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              {isRunning && (
                <>
                  <Button
                    size="sm"
                    variant="primary"
                    icon={ExternalLink}
                    onClick={() => onSelectSession && onSelectSession(s)}
                  >
                    Open Session
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Pause}
                    onClick={(e) => handlePause(e, s.id)}
                    disabled={actionLoading}
                    title="Pause compute"
                  >
                    Pause
                  </Button>
                </>
              )}

              {isPaused && (
                <Button
                  size="sm"
                  variant="primary"
                  icon={Play}
                  onClick={(e) => handleResume(e, s.id)}
                  disabled={actionLoading}
                >
                  Resume
                </Button>
              )}

              {!isStopped && !isFailed && (
                <Button
                  size="sm"
                  variant="danger"
                  icon={Square}
                  onClick={() => setStopSessionTarget(s)}
                  disabled={actionLoading}
                  title="Stop and terminate workspace"
                >
                  Stop
                </Button>
              )}

              {(isStopped || isFailed) && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="primary"
                    icon={RotateCw}
                    onClick={(e) => handleRestart(e, s)}
                    loading={restartingId === s.id}
                    disabled={actionLoading}
                    title="Relaunch compute container"
                  >
                    Restart
                  </Button>

                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Settings}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditSessionTarget(s);
                    }}
                    disabled={actionLoading}
                    title="Edit configuration (name and compute profile)"
                  >
                    Edit Config
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteSessionTarget(s);
                    }}
                    disabled={actionLoading}
                    className="text-txt-muted hover:text-danger hover:bg-danger/10"
                    title="Permanently delete session"
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </Card>
        );
      })}

      {/* Stop & Terminate Confirmation Dialog */}
      <LabStopDialog
        isOpen={!!stopSessionTarget}
        onClose={() => setStopSessionTarget(null)}
        onConfirm={handleStopConfirm}
        session={stopSessionTarget}
        loading={actionLoading}
      />

      {/* Edit Configuration Modal */}
      <LabEditConfigModal
        isOpen={!!editSessionTarget}
        onClose={() => setEditSessionTarget(null)}
        session={editSessionTarget}
        onSaved={(updated) => {
          setEditSessionTarget(null);
          if (onRefresh) onRefresh();
        }}
        onRestarted={(restarted) => {
          setEditSessionTarget(null);
          if (onRestartSession) {
            onRestartSession(restarted);
          } else if (onSelectSession) {
            onSelectSession(restarted);
          } else if (onRefresh) {
            onRefresh();
          }
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={!!deleteSessionTarget}
        onClose={() => setDeleteSessionTarget(null)}
        title="Delete Testing Session"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-danger/10 border border-danger/20 text-xs text-danger">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-danger">Permanent Deletion</p>
              <p className="text-txt-muted text-[11px] leading-relaxed">
                Are you sure you want to delete session <span className="font-semibold text-txt">"{deleteSessionTarget?.name}"</span>?
                This will permanently remove this session and all event audit records from your dashboard.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteSessionTarget(null)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={handleDeleteConfirm}
              loading={actionLoading}
            >
              Delete Session
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

