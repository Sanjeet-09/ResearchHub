import React, { useEffect, useState } from 'react';
import { labApi } from '../../services/api';
import { Button, StatusDot } from '../ui';
import { Loader2, Server, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';

export const LabProgressScreen = ({ sessionId, onReady, onFailed, onBack }) => {
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [startupProgress, setStartupProgress] = useState(10);

  const getStartupMessage = (progress) => {
    if (progress <= 30) {
      return "Allocating Compute Engine VM...";
    } else if (progress <= 80) {
      return "Pulling JupyterLab container image & dependencies...";
    } else if (progress < 100) {
      return "Mounting project workspace & starting kernel...";
    }
    return "Container runtime ready!";
  };

  useEffect(() => {
    let progressTimer;
    let pollInterval;
    let isMounted = true;

    // Increment progress periodically over simulated 60s window
    progressTimer = setInterval(() => {
      setStartupProgress((prev) => {
        if (prev >= 99) return 99;
        const step = prev < 30 ? 2 : prev < 80 ? 1 : Math.random() > 0.4 ? 1 : 0;
        return Math.min(99, prev + step);
      });
    }, 600);

    let consecutiveFailures = 0;

    const poll = async () => {
      try {
        const data = await (typeof labApi.getSessionStatus === 'function' ? labApi.getSessionStatus(sessionId) : labApi.getSessionById(sessionId));
        if (!isMounted) return;
        consecutiveFailures = 0;
        setSession(data);

        const sessionState = (data?.state || data?.status || '').toLowerCase();
        if (sessionState === 'running' || data?.ready) {
          clearInterval(pollInterval);
          clearInterval(progressTimer);
          setStartupProgress(100);
          onReady(data);
        } else if (sessionState === 'failed') {
          clearInterval(pollInterval);
          clearInterval(progressTimer);
          setError(data.last_error || 'Session initialization encountered an error');
          if (onFailed) onFailed(data);
        } else if (sessionState === 'stopped') {
          clearInterval(pollInterval);
          clearInterval(progressTimer);
          if (onBack) onBack();
        }
      } catch (err) {
        if (!isMounted) return;
        consecutiveFailures++;
        // Allow up to 4 consecutive retry polls (12s grace) for transient network/cloud blips
        if (consecutiveFailures >= 4) {
          clearInterval(pollInterval);
          clearInterval(progressTimer);
          setError(err.response?.data?.error?.message || 'Failed to check session status');
        }
      }
    };

    // Initial check + 3s polling per spec Section 8.1
    poll();
    pollInterval = setInterval(poll, 3000);

    return () => {
      isMounted = false;
      clearInterval(progressTimer);
      clearInterval(pollInterval);
    };
  }, [sessionId]);

  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[420px] text-center max-w-xl mx-auto space-y-8 select-none">
      {error ? (
        <div className="space-y-4">
          <div className="w-14 h-14 rounded-full bg-danger/10 border border-danger/30 flex items-center justify-center mx-auto text-danger">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-txt">Session Launch Failed</h3>
            <div className="max-h-40 overflow-y-auto p-3 bg-surface-2/80 rounded-lg border border-danger/30 text-left mt-2">
              <p className="text-[11px] text-danger font-mono whitespace-pre-wrap">{error}</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                try {
                  await labApi.stopSession(sessionId);
                  if (onBack) onBack();
                } catch (e) {
                  if (onBack) onBack();
                }
              }}
            >
              Clean Up & Dismiss
            </Button>
            {onBack && (
              <Button variant="secondary" size="sm" icon={ArrowLeft} onClick={onBack}>
                Back to Lab
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6 w-full">
          <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
            <Server className="w-7 h-7 text-accent" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-txt">
              Preparing Testing Environment
            </h3>
            <p className="text-xs text-emerald-400 font-medium">
              {getStartupMessage(startupProgress)}
            </p>
            <p className="text-xs text-txt-muted">
              {session?.name ? `Session "${session.name}"` : 'Starting container...'}
            </p>
          </div>

          {/* Progress Bar & Percentage */}
          <div className="space-y-2 text-left bg-surface-2 p-5 rounded-card border border-border">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-txt-muted">Container Startup Progress</span>
              <span className="text-txt font-bold tabular-nums text-sm">{startupProgress}%</span>
            </div>

            <div className="w-full h-3 rounded-full bg-surface-3 border border-border overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent via-blue-500 to-emerald-400 transition-all duration-300 ease-out shadow-sm"
                style={{ width: `${startupProgress}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 text-[10px] font-mono">
              <div className={`p-2 rounded border text-center transition-all ${
                startupProgress <= 30
                  ? 'bg-accent/10 border-accent text-accent font-semibold'
                  : 'bg-surface-3/50 border-border text-txt-muted'
              }`}>
                0%–30% VM Allocate
              </div>
              <div className={`p-2 rounded border text-center transition-all ${
                startupProgress > 30 && startupProgress <= 80
                  ? 'bg-accent/10 border-accent text-accent font-semibold'
                  : 'bg-surface-3/50 border-border text-txt-muted'
              }`}>
                30%–80% Image Pull
              </div>
              <div className={`p-2 rounded border text-center transition-all ${
                startupProgress > 80 && startupProgress < 100
                  ? 'bg-accent/10 border-accent text-accent font-semibold'
                  : 'bg-surface-3/50 border-border text-txt-muted'
              }`}>
                80%–99% Mount Workspace
              </div>
            </div>
          </div>

          <p className="text-[11px] text-txt-faint">
            Container is provisioning and checking in every 3 seconds. JupyterLab will launch automatically once ready.
          </p>
        </div>
      )}
    </div>
  );
};
