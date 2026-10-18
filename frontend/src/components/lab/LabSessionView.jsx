import React, { useState, useEffect } from 'react';
import { Button, Badge, StatusDot } from '../ui';
import { LabStopDialog } from './LabStopDialog';
import { labApi } from '../../services/api';
import {
  ExternalLink,
  Pause,
  Play,
  Square,
  FileDown,
  ArrowLeft,
  RotateCw,
  AlertCircle,
  Clock,
  Sparkles,
  Cpu,
} from 'lucide-react';

export const LabSessionView = ({
  session: initialSession,
  onBack,
  onSessionUpdated,
}) => {
  const [session, setSession] = useState(initialSession);
  const [elapsedSeconds, setElapsedSeconds] = useState(
    initialSession?.total_runtime_seconds || 0
  );
  const [isStopDialogOpen, setIsStopDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [exportMessage, setExportMessage] = useState(null);

  // Sync session state from props
  useEffect(() => {
    setSession(initialSession);
  }, [initialSession]);

  // Monospace live runtime timer
  useEffect(() => {
    if (session?.state !== 'running' || !session?.started_at) return;

    const baseElapsed = session.total_runtime_seconds || 0;
    const startTime = new Date(session.started_at).getTime();

    const updateTimer = () => {
      const liveSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      setElapsedSeconds(baseElapsed + liveSeconds);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session?.state, session?.started_at, session?.total_runtime_seconds]);

  // Periodic status poll (every 5s if in transitional state)
  useEffect(() => {
    if (!['provisioning', 'pausing', 'resuming', 'stopping'].includes(session?.state)) {
      return;
    }

    const poll = async () => {
      try {
        const fresh = await labApi.getSessionById(session.id);
        setSession(fresh);
        if (onSessionUpdated) onSessionUpdated(fresh);
      } catch (err) {
        // Ignored
      }
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [session?.id, session?.state]);

  const formatTimer = (totalSec) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePause = async () => {
    try {
      setActionLoading(true);
      await labApi.pauseSession(session.id);
      const updated = await labApi.getSessionById(session.id);
      setSession(updated);
      if (onSessionUpdated) onSessionUpdated(updated);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to pause session');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    try {
      setActionLoading(true);
      await labApi.resumeSession(session.id);
      const updated = await labApi.getSessionById(session.id);
      setSession(updated);
      if (onSessionUpdated) onSessionUpdated(updated);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to resume session');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopConfirm = async ({ exportNotebooks }) => {
    try {
      setActionLoading(true);
      await labApi.stopSession(session.id, exportNotebooks);
      setIsStopDialogOpen(false);
      const updated = await labApi.getSessionById(session.id);
      setSession(updated);
      if (onSessionUpdated) onSessionUpdated(updated);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to stop session');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportNotebooks = async () => {
    try {
      setActionLoading(true);
      setExportMessage(null);
      const res = await labApi.exportNotebooks(session.id);
      setExportMessage(res.message || 'Notebooks exported to Documents tab successfully');
      setTimeout(() => setExportMessage(null), 5000);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Export failed');
    } finally {
      setActionLoading(false);
    }
  };

  const isAiml = session?.profile_category === 'ai_ml';

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[640px] bg-bg border border-border rounded-xl overflow-hidden shadow-2xl">
      {/* Slim Top Toolbar (Section 8.1 & 3.7) */}
      <div className="h-14 px-4 bg-surface border-b border-border flex items-center justify-between gap-4 flex-shrink-0 z-10">
        {/* Left: Back & Session Title */}
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg text-txt-muted hover:text-txt hover:bg-surface-2 transition-colors"
              title="Back to Sessions"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2.5 truncate">
            <span className="font-semibold text-sm text-txt truncate">{session.name}</span>
            <Badge
              variant={isAiml ? 'accent' : 'secondary'}
              className="text-[10px] font-mono uppercase px-2 py-0.5 flex items-center gap-1 flex-shrink-0"
            >
              {isAiml ? <Sparkles className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
              {session.profile_name || session.profile_key}
            </Badge>
          </div>
        </div>

        {/* Center: State Badge & Mono Timer */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 border border-border">
            <StatusDot
              status={
                session.state === 'running'
                  ? 'online'
                  : session.state === 'paused' || session.state === 'pausing' || session.state === 'resuming'
                  ? 'idle'
                  : 'offline'
              }
              pulse={['running', 'provisioning', 'pausing', 'resuming'].includes(session.state)}
            />
            <span className="text-[11px] font-medium uppercase tracking-wider text-txt">
              {session.state}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-surface-2 border border-border text-xs font-mono text-txt">
            <Clock className="w-3.5 h-3.5 text-txt-muted" />
            <span>{formatTimer(elapsedSeconds)}</span>
          </div>
        </div>

        {/* Right: Actions (Pause / Resume / Stop / Save / Open) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {session.state === 'running' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={FileDown}
                onClick={handleExportNotebooks}
                disabled={actionLoading}
                title="Save all .ipynb files to project Documents"
              >
                <span className="hidden sm:inline">Save to Documents</span>
              </Button>

              <Button
                variant="secondary"
                size="sm"
                icon={Pause}
                onClick={handlePause}
                disabled={actionLoading}
                title="Pause compute (saves files, stops billing)"
              >
                <span className="hidden sm:inline">Pause</span>
              </Button>
            </>
          )}

          {session.state === 'paused' && (
            <Button
              variant="primary"
              size="sm"
              icon={Play}
              onClick={handleResume}
              disabled={actionLoading}
            >
              Resume
            </Button>
          )}

          {session.state !== 'stopped' && session.state !== 'stopping' && (
            <Button
              variant="danger"
              size="sm"
              icon={Square}
              onClick={() => setIsStopDialogOpen(true)}
              disabled={actionLoading}
              title="Stop session and delete workspace permanently"
            >
              <span className="hidden sm:inline">Stop</span>
            </Button>
          )}

          {session.url && session.state === 'running' && (
            <a
              href={session.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border text-xs text-accent font-medium transition-colors"
              title="Open JupyterLab in a standalone tab"
            >
              <span>Open Tab</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Export notification banner if active */}
      {exportMessage && (
        <div className="px-4 py-2 bg-success/10 border-b border-success/30 text-xs text-success flex items-center justify-between">
          <span>{exportMessage}</span>
          <button onClick={() => setExportMessage(null)} className="text-success hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workspace Frame or Inactive/Paused Screen */}
      <div className="flex-1 bg-surface-2 relative overflow-hidden flex flex-col">
        {session.state === 'running' && session.url ? (
          <iframe
            src={session.url}
            title={`JupyterLab - ${session.name}`}
            className="w-full h-full border-0 bg-bg"
            allow="clipboard-read; clipboard-write; fullscreen"
          />
        ) : session.state === 'paused' ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-warning/10 border border-warning/30 flex items-center justify-center text-warning">
              <Pause className="w-8 h-8" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-base font-semibold text-txt">Session is Paused</h3>
              <p className="text-xs text-txt-muted leading-relaxed">
                Your notebooks and installed environment packages are safely preserved on disk.
                Compute container has been deleted to pause billing.
              </p>
            </div>
            <Button variant="primary" icon={Play} onClick={handleResume} loading={actionLoading}>
              Resume Session
            </Button>
          </div>
        ) : session.state === 'stopped' ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-surface-3 border border-border flex items-center justify-center text-txt-muted">
              <Square className="w-8 h-8" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-base font-semibold text-txt">Session Stopped & Terminated</h3>
              <p className="text-xs text-txt-muted leading-relaxed">
                Compute resources and workspace storage were permanently deleted.
                Session metadata remains for audit history.
              </p>
            </div>
            {onBack && (
              <Button variant="secondary" icon={ArrowLeft} onClick={onBack}>
                Return to Sessions List
              </Button>
            )}
          </div>
        ) : session.state === 'failed' ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-danger/10 border border-danger/30 flex items-center justify-center text-danger">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-base font-semibold text-txt">Session Failed</h3>
              <p className="text-xs text-danger font-mono mt-1">
                {session.last_error || 'An unexpected failure occurred in this environment.'}
              </p>
            </div>
            <Button
              variant="danger"
              icon={Square}
              onClick={() => setIsStopDialogOpen(true)}
              disabled={actionLoading}
            >
              Stop & Clean Up
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
            <RotateCw className="w-8 h-8 text-accent animate-spin" />
            <p className="text-xs text-txt-muted capitalize">
              Session is currently {session.state}...
            </p>
          </div>
        )}
      </div>

      {/* Stop Dialog */}
      <LabStopDialog
        isOpen={isStopDialogOpen}
        onClose={() => setIsStopDialogOpen(false)}
        onConfirm={handleStopConfirm}
        session={session}
        loading={actionLoading}
      />
    </div>
  );
};
