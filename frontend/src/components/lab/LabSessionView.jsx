import React, { useState, useEffect } from 'react';
import { Button, Badge, StatusDot } from '../ui';
import { toast } from 'sonner';
import { LabStopDialog } from './LabStopDialog';
import { LabEditConfigModal } from './LabEditConfigModal';
import { LabNotionEditor } from './LabNotionEditor';
import { LabPythonNotebook } from './LabPythonNotebook';
import { labApi } from '../../services/api';
import { supabase } from '../../services/supabase';
import {
  ExternalLink,
  Pause,
  Play,
  Square,
  FileDown,
  ArrowLeft,
  RotateCw,
  AlertCircle,
  AlertTriangle,
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
  projectId: initialProjectId,
  onBack,
  onSessionUpdated,
  currentUser,
  isLead = false,
  isCollaborativeNonOwner,
}) => {
  const [session, setSession] = useState(initialSession);
  const resolvedProjectId = initialProjectId || session?.project_id || session?.projectId;
  const currentProjectId = resolvedProjectId;
  const [elapsedSeconds, setElapsedSeconds] = useState(
    initialSession?.total_runtime_seconds || 0
  );
  const [isStopDialogOpen, setIsStopDialogOpen] = useState(false);
  const [isEditConfigOpen, setIsEditConfigOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [exportMessage, setExportMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [viewMode, setViewMode] = useState('notebook'); // Single tab default: 'notebook' | 'notion' | 'docker'

  const isOwner = !currentUser || session?.user_id === currentUser?.id;
  const isLeadOrAdmin = isLead || currentUser?.role === 'admin' || currentUser?.role === 'professor';
  const isNonOwner = isCollaborativeNonOwner !== undefined ? isCollaborativeNonOwner : (!isOwner && !isLeadOrAdmin);

  // Container readiness and startup progress percentage (0–100)
  const sessionStatus = (session?.state || session?.status || '').toUpperCase();
  const isRunning = sessionStatus === 'RUNNING' && (session?.ready === undefined || session?.ready === true);
  const [containerReady, setContainerReady] = useState(isRunning);
  const [startupProgress, setStartupProgress] = useState(isRunning ? 100 : 0);

  const setSessionReady = (ready) => {
    setContainerReady(ready);
    if (ready) setStartupProgress(100);
  };

  const fetchSessionData = async () => {
    if (!session?.id) return;
    try {
      const fresh = await (typeof labApi.getSessionStatus === 'function'
        ? labApi.getSessionStatus(session.id)
        : labApi.getSessionById(session.id));
      if (fresh) {
        setSession((prev) => ({
          ...prev,
          ...fresh,
          project_id: fresh.project_id || fresh.projectId || prev?.project_id || resolvedProjectId,
          projectId: fresh.project_id || fresh.projectId || prev?.project_id || resolvedProjectId,
        }));
        const statusUpper = (fresh.state || fresh.status || '').toUpperCase();
        const isFreshReady = fresh?.ready === undefined || fresh?.ready === true;
        if (statusUpper === 'RUNNING' && isFreshReady) {
          setContainerReady(true);
          setStartupProgress(100);
        }
        if (onSessionUpdated) onSessionUpdated(fresh);
      }
    } catch (err) {
      console.warn('[LabSessionView Sync Warning]', err.message);
    }
  };

  const broadcastSessionChange = () => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window && resolvedProjectId) {
      try {
        const syncChannel = new BroadcastChannel('rh_session_state');
        syncChannel.postMessage({ type: 'SESSION_MUTATED', projectId: resolvedProjectId });
        syncChannel.close();
      } catch (_) {}
    }
  };

  // 1. Same-Device Cross-Tab Sync via BroadcastChannel
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const syncChannel = new BroadcastChannel('rh_session_state');
    syncChannel.onmessage = (event) => {
      if (event.data?.projectId === resolvedProjectId) {
        fetchSessionData(); // Refetches active session details
      }
    };
    return () => syncChannel.close();
  }, [resolvedProjectId, session?.id]);

  // 2. Cross-Device Sync via Supabase Realtime
  useEffect(() => {
    if (!resolvedProjectId || !supabase) return;

    const subscription = supabase
      .channel(`lab_sessions:${resolvedProjectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lab_sessions', filter: `project_id=eq.${resolvedProjectId}` },
        (payload) => {
          // Sync session updates directly to state
          if (payload.new) {
            setSession((prev) => ({ ...prev, ...payload.new }));
            const statusUpper = (payload.new.status || payload.new.state || '').toUpperCase();
            if (statusUpper === 'RUNNING') setSessionReady(true);
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase && typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(subscription);
      }
    };
  }, [resolvedProjectId]);

  // Sync session state from props
  useEffect(() => {
    setSession(initialSession);
  }, [initialSession]);

  // Keep containerReady in sync with session status
  useEffect(() => {
    const statusUpper = (session?.state || session?.status || '').toUpperCase();
    const isSessionReady = session?.ready === undefined || session?.ready === true;
    if (statusUpper === 'RUNNING' && isSessionReady) {
      setContainerReady(true);
      setStartupProgress(100);
    } else if (statusUpper === 'PROVISIONING' || statusUpper === 'STARTING') {
      setContainerReady(false);
    } else {
      setContainerReady(false);
    }
  }, [session?.state, session?.status, session?.ready]);

  // Periodically increment startup progress over simulated 60s window until port 8888 probe reports RUNNING
  useEffect(() => {
    const statusUpper = (session?.state || session?.status || '').toUpperCase();
    if (containerReady || (statusUpper !== 'PROVISIONING' && statusUpper !== 'STARTING')) {
      return;
    }

    const interval = setInterval(() => {
      setStartupProgress((prev) => {
        if (prev >= 99) return 99;
        // Progress smoothly towards 99%
        const step = prev < 30 ? 2 : prev < 80 ? 1 : Math.random() > 0.4 ? 1 : 0;
        return Math.min(99, prev + step);
      });
    }, 600);

    return () => clearInterval(interval);
  }, [containerReady, session?.state, session?.status]);

  // Contextual status message per percentage window
  const getStartupMessage = (progress) => {
    if (progress <= 30) {
      return "Allocating Compute Engine VM...";
    } else if (progress <= 80) {
      return "Pulling JupyterLab container image & dependencies...";
    } else if (progress < 100) {
      return "Mounting project workspace & starting kernel...";
    }
    return "Container workspace mounted & ready!";
  };

  const handleOpenExternal = () => {
    // Route through the API Gateway relative/direct proxy to avoid ERR_CONNECTION_REFUSED & Mixed Content
    const token = session?.token || '';
    const tokenQuery = session?.token || token ? `?token=${encodeURIComponent(session.token || token)}` : '';
    const gatewayBase = import.meta.env.VITE_GATEWAY_URL || '';
    const proxyBase = session?.id
      ? `${gatewayBase}/api/lab/sessions/${session.id}/proxy/lab${tokenQuery}`
      : session?.url;

    if (proxyBase) {
      window.open(proxyBase, '_blank', 'noopener,noreferrer');
    } else {
      toast.error("Container connection URL or port not available yet");
    }
  };

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
    const currentState = (session?.state || session?.status || '').toLowerCase();
    if (!['provisioning', 'starting', 'pausing', 'resuming', 'stopping'].includes(currentState)) {
      return;
    }

    const poll = async () => {
      try {
        const fresh = await (typeof labApi.getSessionStatus === 'function'
          ? labApi.getSessionStatus(session.id)
          : labApi.getSessionById(session.id));
        if (fresh) {
          setSession((prev) => ({
            ...prev,
            ...fresh,
            project_id: fresh.project_id || fresh.projectId || prev?.project_id || currentProjectId,
            projectId: fresh.project_id || fresh.projectId || prev?.project_id || currentProjectId,
          }));
          const isFreshReady = fresh?.ready === undefined || fresh?.ready === true;
          const statusLower = (fresh.state || fresh.status || '').toLowerCase();
          if (statusLower === 'running' && isFreshReady) {
            setContainerReady(true);
            setStartupProgress(100);
          }
          if (onSessionUpdated) onSessionUpdated(fresh);
        }
      } catch (err) {
        console.warn('[LabSessionView Poll Warning]', err.message);
      }
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [session?.id, session?.state, session?.status]);

  const formatTimer = (totalSec) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePause = async () => {
    try {
      setErrorMessage(null);
      setActionLoading(true);
      await labApi.pauseSession(session.id);
      const updated = await labApi.getSessionById(session.id);
      setSession(updated);
      broadcastSessionChange();
      if (onSessionUpdated) onSessionUpdated(updated);
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to pause session';
      setErrorMessage(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    try {
      setErrorMessage(null);
      setActionLoading(true);
      await labApi.resumeSession(session.id);
      const updated = await labApi.getSessionById(session.id);
      setSession(updated);
      broadcastSessionChange();
      if (onSessionUpdated) onSessionUpdated(updated);
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to resume session';
      setErrorMessage(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopConfirm = async ({ exportNotebooks }) => {
    try {
      setErrorMessage(null);
      setActionLoading(true);
      await labApi.stopSession(session.id, exportNotebooks);
      setIsStopDialogOpen(false);
      const updated = await labApi.getSessionById(session.id);
      setSession(updated);
      broadcastSessionChange();
      if (onSessionUpdated) onSessionUpdated(updated);
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to stop session';
      setErrorMessage(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportNotebooks = async () => {
    try {
      setErrorMessage(null);
      setActionLoading(true);
      setExportMessage(null);
      const res = await labApi.exportNotebooks(session.id);
      if (res?.exportSuccess === false) {
        toast.error(res.message || 'Notebook export was unavailable');
        setErrorMessage(res.message);
      } else {
        const successMsg = res?.message || 'Notebook exported to Documents tab successfully!';
        toast.success(successMsg);
        setExportMessage(successMsg);
        try {
          window.dispatchEvent(
            new CustomEvent('researchhub:documents-updated', {
              detail: { projectId: session.project_id },
            })
          );
        } catch (_) {}
      }
      setTimeout(() => setExportMessage(null), 5000);
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.error || err.response?.data?.message || err.message || 'Export failed';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestart = async () => {
    try {
      setErrorMessage(null);
      setActionLoading(true);
      // Immediately set the session UI state to PROVISIONING / STARTING with progress bar active
      setSession((prev) => ({
        ...prev,
        state: 'provisioning',
        status: 'provisioning',
      }));
      setContainerReady(false);
      setStartupProgress(5);
      setViewMode('docker');

      const res = await labApi.restartSession(session.id);
      const updatedSession = res?.session || res;
      setSession(updatedSession);
      broadcastSessionChange();
      if (onSessionUpdated) onSessionUpdated(updatedSession);

      // Begin polling GET /api/lab/sessions/:id/status until the new VM responds on port 8888 and transitions to RUNNING
      let pollAttempts = 0;
      const MAX_POLL_ATTEMPTS = 45; // 45 × 2s = 90s max
      const pollInterval = setInterval(async () => {
        pollAttempts++;
        if (pollAttempts > MAX_POLL_ATTEMPTS) {
          clearInterval(pollInterval);
          setErrorMessage('Session took too long to start. Check the Lab tab for current status.');
          return;
        }
        try {
          const fresh = await labApi.getSessionStatus(session.id).catch(() => labApi.getSessionById(session.id));
          if (!fresh) return; // Transient failure — keep polling
          const freshState = (fresh.state || fresh.status || '').toUpperCase();
          setSession(fresh);
          if (onSessionUpdated) onSessionUpdated(fresh);
          if (freshState === 'RUNNING' || fresh.ready) {
            setContainerReady(true);
            setStartupProgress(100);
            broadcastSessionChange();
            clearInterval(pollInterval);
          } else if (freshState === 'FAILED' || freshState === 'STOPPED') {
            clearInterval(pollInterval);
            if (fresh.last_error) {
              setErrorMessage(fresh.last_error);
            }
          }
        } catch (_) {
          // Transient network error — keep polling, don't fail the modal
        }
      }, 2000);
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to restart session';
      setErrorMessage(msg);
      try {
        const current = await labApi.getSessionById(session.id);
        if (current) setSession(current);
      } catch (_) {}
    } finally {
      setActionLoading(false);
    }
  };

  const isAiml = session?.profile_category === 'ai_ml';

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[460px] w-full min-w-0 bg-bg border border-border rounded-[12px] overflow-hidden shadow-floating">
      {/* Slim Solid Top Toolbar per Section 4.5 */}
      <div className="min-h-14 py-2 px-4 bg-surface-1 border-b border-border flex flex-wrap items-center justify-between gap-3 flex-shrink-0 z-10">
        {/* Left: Back & Session Title */}
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-[6px] text-text-3 hover:text-text hover:bg-surface-2 transition-colors flex-shrink-0"
              title="Back to Sessions"
            >
              <ArrowLeft className="w-4 h-4 stroke-[1.75]" />
            </button>
          )}

          <div className="flex items-center gap-2.5 truncate flex-wrap">
            <span className="font-semibold text-sm text-text truncate">{session.name}</span>
            <Badge
              variant={isAiml ? 'aiml' : 'neutral'}
              size="sm"
            >
              {session.profile_name || session.profile_key}
            </Badge>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Shared Project Notebook — Any project member can edit and run
            </span>

            {isNonOwner && (
              <Badge
                variant="neutral"
                size="sm"
                className="bg-purple-950/60 text-purple-300 border border-purple-500/40 flex items-center gap-1.5 px-2.5 py-0.5 text-[11px]"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                Session Owner: {session.user_name || 'Owner'}
              </Badge>
            )}
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
            <span className="text-[11px] font-medium uppercase tracking-wider text-text">
              {session.state}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-[6px] bg-surface-2 border border-border text-xs font-mono tabular-nums text-text">
            <Clock className="w-3.5 h-3.5 text-text-3 stroke-[1.75]" />
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
                disabled={actionLoading || isNonOwner}
                title={isNonOwner ? "Only the session owner or project lead can pause this session" : "Pause compute (saves files, stops billing)"}
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
              disabled={actionLoading || isNonOwner}
              title={isNonOwner ? "Only the session owner or project lead can resume this session" : "Resume compute"}
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
              disabled={actionLoading || isNonOwner}
              title={isNonOwner ? "Only the session owner or project lead can stop this session" : "Stop session and delete workspace permanently"}
            >
              <span className="hidden sm:inline">Stop</span>
            </Button>
          )}

          {/* Open Tab External Launcher Button next to Pause & Stop */}
          <button
            type="button"
            onClick={handleOpenExternal}
            className="bg-[#171717] hover:bg-[#242424] text-[#EDEDED] border border-[#353535] px-3.5 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
            title="Open JupyterLab in a standalone tab"
          >
            <span>Open Tab</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#EDEDED]" />
          </button>

          {(session.state === 'stopped' || session.state === 'failed') && (
            <>
              <Button
                variant="primary"
                size="sm"
                icon={RotateCw}
                onClick={handleRestart}
                loading={actionLoading}
                disabled={isNonOwner}
                title="Restart container runtime"
              >
                Restart
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={Settings}
                onClick={() => setIsEditConfigOpen(true)}
                disabled={actionLoading || isNonOwner}
                title="Edit compute configuration"
              >
                Edit Config
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Workspace Single-Tab Switcher Bar */}
      <div className="min-h-11 py-1.5 px-4 bg-panel-2 border-b border-line flex flex-wrap items-center justify-between gap-3 flex-shrink-0 text-xs">
        <div className="flex items-center gap-1.5 bg-panel p-1 rounded-xl border border-line shadow-sm">
          <button
            onClick={() => setViewMode('notebook')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-[6px] font-medium transition-colors ${
              viewMode === 'notebook'
                ? 'bg-surface-3 text-text shadow-sm'
                : 'text-text-3 hover:text-text hover:bg-surface-2'
            }`}
            title="Interactive Python Testing Lab with NumPy & Matplotlib Charts"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Interactive Lab</span>
          </button>

          <button
            onClick={() => setViewMode('notion')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-[6px] font-medium transition-colors ${
              viewMode === 'notion'
                ? 'bg-surface-3 text-text shadow-sm'
                : 'text-text-3 hover:text-text hover:bg-surface-2'
            }`}
            title="Notion-style Research Notes & Lab Journal with LaTeX math"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Research Notes</span>
          </button>

          {(session.url || session.id) && !['stopped', 'failed'].includes((session.state || session.status || '').toLowerCase()) && (
            <button
              onClick={() => setViewMode('docker')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-[6px] font-medium transition-colors ${
                viewMode === 'docker'
                  ? 'bg-surface-3 text-text shadow-sm'
                  : 'text-text-3 hover:text-text hover:bg-surface-2'
              }`}
              title="Embedded Docker/Local JupyterLab Server"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Docker JupyterLab</span>
              {!containerReady && (sessionStatus === 'PROVISIONING' || sessionStatus === 'STARTING') && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          )}
        </div>

        <div className="text-[11px] text-text-3 font-mono hidden md:flex items-center gap-2">
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

      {/* Inline error banner if active */}
      {errorMessage && (
        <div className="px-4 py-2.5 bg-danger/10 border-b border-danger/30 text-xs text-danger flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-danger hover:underline font-semibold flex-shrink-0 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Single-Tab Workspace Area */}
      <div className="flex-1 min-h-0 bg-surface-2 relative overflow-hidden flex flex-col min-w-0">
        {viewMode === 'notebook' && (
          <div className="h-full w-full min-h-0 flex-1 overflow-y-auto">
            <LabPythonNotebook
              session={{ ...session, project_id: currentProjectId, projectId: currentProjectId }}
              projectId={currentProjectId}
              sessionId={session?.id}
              sessionName={session?.name}
              profileKey={session?.profile_key || session?.profileKey}
              currentUser={currentUser}
              isOwner={isOwner}
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
              projectId={currentProjectId}
              sessionId={session?.id}
              sessionName={session?.name}
              onExportSuccess={(msg) => {
                setExportMessage(msg);
                setTimeout(() => setExportMessage(null), 5000);
              }}
            />
          </div>
        )}

        {viewMode === 'docker' && (
          <div className="h-full w-full min-h-0 flex-1 flex flex-col relative">
            {/* Prevent Black Screen Iframe Render: do NOT mount iframe while containerReady is false */}
            {containerReady && (session.id || session.url) ? (() => {
              const token = session?.token || '';
              const tokenQuery = session?.token || token ? `?token=${encodeURIComponent(session.token || token)}` : '';
              const gatewayBase = import.meta.env.VITE_GATEWAY_URL || '';
              const proxyBase = session?.id
                ? `${gatewayBase}/api/lab/sessions/${session.id}/proxy/lab${tokenQuery}`
                : session.url;

              return (
                <iframe
                  src={proxyBase}
                  title={`JupyterLab - ${session.name}`}
                  className="w-full h-full flex-1 min-h-0 border-0 bg-bg block"
                  allow="clipboard-read; clipboard-write; fullscreen"
                />
              );
            })() : (!containerReady && (sessionStatus === 'PROVISIONING' || sessionStatus === 'STARTING' || sessionStatus === 'RUNNING' || !sessionStatus)) ? (
              /* Loading overlay over the tab with progress bar and contextual status messages */
              <div className="flex flex-col items-center justify-center h-full w-full p-8 text-center bg-bg relative overflow-hidden select-none">
                {/* Ambient glow backgrounds */}
                <div className="absolute w-[450px] h-[450px] rounded-full bg-primary/10 blur-3xl pointer-events-none -top-16 -left-16" />
                <div className="absolute w-[450px] h-[450px] rounded-full bg-emerald-500/10 blur-3xl pointer-events-none -bottom-16 -right-16" />

                <div className="relative z-10 max-w-lg w-full space-y-6 bg-surface-1/95 border border-border p-8 rounded-2xl shadow-floating backdrop-blur-md">
                  {/* Container initialization spinner graphic */}
                  <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-2 border-border-strong/40" />
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary border-r-emerald-400 animate-spin" />
                    <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center shadow-inner">
                      <Cpu className="w-6 h-6 text-primary stroke-[1.75]" />
                    </div>
                  </div>

                  {/* Title & Contextual Message */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <h3 className="text-base font-semibold text-text tracking-tight">
                        Initializing Docker JupyterLab
                      </h3>
                    </div>
                    <p className="text-xs text-emerald-400 font-medium transition-all duration-300 min-h-[1.25rem]">
                      {getStartupMessage(startupProgress)}
                    </p>
                  </div>

                  {/* Progress Bar & Percentage */}
                  <div className="space-y-2 text-left">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-text-3">Startup Initialization</span>
                      <span className="text-text font-bold tabular-nums text-sm">{startupProgress}%</span>
                    </div>

                    <div className="w-full h-3 rounded-full bg-surface-2 border border-border overflow-hidden p-0.5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary via-blue-500 to-emerald-400 transition-all duration-300 ease-out shadow-sm"
                        style={{ width: `${startupProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Stepper Phases Indicator */}
                  <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] font-mono">
                    <div className={`p-2.5 rounded-lg border text-center transition-all ${
                      startupProgress <= 30
                        ? 'bg-primary/10 border-primary/50 text-primary font-semibold shadow-sm'
                        : startupProgress > 30
                        ? 'bg-surface-2/60 border-border text-text-3'
                        : 'bg-surface-2/30 border-border/40 text-text-3/60'
                    }`}>
                      <div className="text-[10px] uppercase tracking-wider text-text-3/80">0%–30%</div>
                      <div className="mt-0.5">VM Allocate</div>
                    </div>
                    <div className={`p-2.5 rounded-lg border text-center transition-all ${
                      startupProgress > 30 && startupProgress <= 80
                        ? 'bg-primary/10 border-primary/50 text-primary font-semibold shadow-sm'
                        : startupProgress > 80
                        ? 'bg-surface-2/60 border-border text-text-3'
                        : 'bg-surface-2/30 border-border/40 text-text-3/60'
                    }`}>
                      <div className="text-[10px] uppercase tracking-wider text-text-3/80">30%–80%</div>
                      <div className="mt-0.5">Image Pull</div>
                    </div>
                    <div className={`p-2.5 rounded-lg border text-center transition-all ${
                      startupProgress > 80 && startupProgress < 100
                        ? 'bg-primary/10 border-primary/50 text-primary font-semibold shadow-sm'
                        : startupProgress === 100
                        ? 'bg-surface-2/60 border-border text-text-3'
                        : 'bg-surface-2/30 border-border/40 text-text-3/60'
                    }`}>
                      <div className="text-[10px] uppercase tracking-wider text-text-3/80">80%–99%</div>
                      <div className="mt-0.5">Mount Workspace</div>
                    </div>
                  </div>

                  <div className="text-[11px] text-text-3 pt-1 border-t border-border flex items-center justify-between">
                    <span>Target: port 8888</span>
                    <span className="font-mono">
                      {startupProgress === 100 ? 'Listening (HTTP 200)' : 'Awaiting readiness probe...'}
                    </span>
                  </div>
                </div>
              </div>
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
