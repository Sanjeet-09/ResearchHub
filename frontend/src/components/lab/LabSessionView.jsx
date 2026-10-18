import React, { useState, useEffect } from 'react';
import { Button, Badge, StatusDot } from '../ui';
import { LabStopDialog } from './LabStopDialog';
import { LabEditConfigModal } from './LabEditConfigModal';
import { LabNotionEditor } from './LabNotionEditor';
import { LabPythonNotebook } from './LabPythonNotebook';
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
  Terminal,
  BookOpen,
  Layers,
  Settings,
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
  const [isEditConfigOpen, setIsEditConfigOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [exportMessage, setExportMessage] = useState(null);
  const [viewMode, setViewMode] = useState('notebook'); // Single tab default: 'notebook' | 'notion' | 'docker'

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

  // Periodic status poll (every 3s if in transitional state)
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

  const handleRestart = async () => {
    try {
      setActionLoading(true);
      const res = await labApi.restartSession(session.id);
      setSession(res);
      if (onSessionUpdated) onSessionUpdated(res);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to restart session');
    } finally {
      setActionLoading(false);
    }
  };

  const isAiml = session?.profile_category === 'ai_ml';

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[460px] w-full min-w-0 bg-bg border border-border rounded-xl overflow-hidden shadow-2xl">
      {/* Slim Top Toolbar (Section 8.1 & 3.7) */}
      <div className="min-h-14 py-2 px-4 bg-surface border-b border-border flex flex-wrap items-center justify-between gap-3 flex-shrink-0 z-10">
        {/* Left: Back & Session Title */}
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg text-txt-muted hover:text-txt hover:bg-surface-2 transition-colors flex-shrink-0"
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
        <div className="flex items-center gap-2.5 flex-shrink-0">
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
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
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

          {(session.state === 'stopped' || session.state === 'failed') && (
            <>
              <Button
                variant="primary"
                size="sm"
                icon={RotateCw}
                onClick={handleRestart}
                loading={actionLoading}
                title="Restart container runtime"
              >
                Restart
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={Settings}
                onClick={() => setIsEditConfigOpen(true)}
                disabled={actionLoading}
                title="Edit compute configuration"
              >
                Edit Config
              </Button>
            </>
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

      {/* Workspace Single-Tab Switcher Bar */}
      <div className="min-h-11 py-1.5 px-4 bg-surface-2 border-b border-border flex flex-wrap items-center justify-between gap-3 flex-shrink-0 text-xs">
        <div className="flex items-center gap-1.5 bg-surface p-1 rounded-lg border border-border shadow-sm">
          <button
            onClick={() => setViewMode('notebook')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-medium transition-all ${
              viewMode === 'notebook'
                ? 'bg-accent text-white shadow-sm'
                : 'text-txt-muted hover:text-txt hover:bg-surface-2'
            }`}
            title="Interactive Python Testing Lab with NumPy & Matplotlib Charts"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>⚡ Interactive Lab</span>
          </button>

          <button
            onClick={() => setViewMode('notion')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-medium transition-all ${
              viewMode === 'notion'
                ? 'bg-accent text-white shadow-sm'
                : 'text-txt-muted hover:text-txt hover:bg-surface-2'
            }`}
            title="Notion-style Research Notes & Lab Journal with LaTeX math"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>📓 Research Notes</span>
          </button>

          {session.url && session.state === 'running' && (
            <button
              onClick={() => setViewMode('docker')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-medium transition-all ${
                viewMode === 'docker'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-txt-muted hover:text-txt hover:bg-surface-2'
              }`}
              title="Embedded Docker/Local JupyterLab Server"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>🌐 Docker JupyterLab</span>
            </button>
          )}
        </div>

        <div className="text-[11px] text-txt-muted font-mono hidden md:flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Full-Width Testing Workspace Active</span>
        </div>
      </div>

      {/* Export notification banner if active */}
      {exportMessage && (
        <div className="px-4 py-2 bg-success/10 border-b border-success/30 text-xs text-success flex items-center justify-between">
          <span>{exportMessage}</span>
          <button onClick={() => setExportMessage(null)} className="text-success hover:underline font-medium">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Single-Tab Workspace Area */}
      <div className="flex-1 min-h-0 bg-surface-2 relative overflow-hidden flex flex-col min-w-0">
        {viewMode === 'notebook' && (
          <div className="h-full w-full min-h-0 flex-1 overflow-y-auto">
            <LabPythonNotebook
              projectId={session.project_id}
              sessionId={session.id}
              sessionName={session.name}
              profileKey={session.profile_key}
              onExportSuccess={(msg) => {
                setExportMessage(msg);
                setTimeout(() => setExportMessage(null), 5000);
              }}
            />
          </div>
        )}

        {viewMode === 'notion' && (
          <div className="h-full w-full min-h-0 flex-1 overflow-y-auto bg-surface">
            <LabNotionEditor
              projectId={session.project_id}
              sessionId={session.id}
              sessionName={session.name}
              onExportSuccess={(msg) => {
                setExportMessage(msg);
                setTimeout(() => setExportMessage(null), 5000);
              }}
            />
          </div>
        )}

        {viewMode === 'docker' && (
          <div className="h-full w-full min-h-0 flex-1 flex flex-col">
            {session.state === 'running' && session.url ? (
              <iframe
                src={session.url}
                title={`JupyterLab - ${session.name}`}
                className="w-full h-full flex-1 min-h-0 border-0 bg-bg block"
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
                    Container compute has been paused to halt billing. You can still use the Interactive Lab and Research Notes tabs above.
                  </p>
                </div>
                <Button variant="primary" icon={Play} onClick={handleResume} loading={actionLoading}>
                  Resume Container
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
                    Compute container was terminated. All Research Notes and exported notebooks remain permanently saved in your project Documents.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap justify-center pt-2">
                  <Button variant="primary" icon={RotateCw} onClick={handleRestart} loading={actionLoading}>
                    Restart Session
                  </Button>
                  <Button variant="secondary" icon={Settings} onClick={() => setIsEditConfigOpen(true)}>
                    Edit Configuration
                  </Button>
                  {onBack && (
                    <Button variant="ghost" icon={ArrowLeft} onClick={onBack}>
                      Return to Sessions
                    </Button>
                  )}
                </div>
              </div>
            ) : session.state === 'failed' ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-danger/10 border border-danger/30 flex items-center justify-center text-danger">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div className="max-w-md space-y-1">
                  <h3 className="text-base font-semibold text-txt">Container Initialization Failed</h3>
                  <p className="text-xs text-danger font-mono mt-1">
                    {session.last_error || 'An unexpected failure occurred while initializing the Docker container.'}
                  </p>
                  <p className="text-xs text-txt-muted mt-2">
                    Tip: You can use the "Interactive Lab" and "Research Notes" tabs at any time without Docker!
                  </p>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap justify-center pt-2">
                  <Button variant="primary" icon={RotateCw} onClick={handleRestart} loading={actionLoading}>
                    Retry / Restart
                  </Button>
                  <Button variant="secondary" icon={Settings} onClick={() => setIsEditConfigOpen(true)}>
                    Edit Configuration
                  </Button>
                  <Button
                    variant="danger"
                    icon={Square}
                    onClick={() => setIsStopDialogOpen(true)}
                    disabled={actionLoading}
                  >
                    Stop & Clean Up
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
                <RotateCw className="w-8 h-8 text-accent animate-spin" />
                <p className="text-xs text-txt-muted capitalize">
                  Container is currently {session.state}...
                </p>
              </div>
            )}
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

      {/* Edit Configuration Modal */}
      <LabEditConfigModal
        isOpen={isEditConfigOpen}
        onClose={() => setIsEditConfigOpen(false)}
        session={session}
        onSaved={(updated) => {
          setSession(updated);
          if (onSessionUpdated) onSessionUpdated(updated);
        }}
        onRestarted={(restarted) => {
          setSession(restarted);
          if (onSessionUpdated) onSessionUpdated(restarted);
        }}
      />
    </div>
  );
};
