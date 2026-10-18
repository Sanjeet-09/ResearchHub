import React, { useEffect, useState } from 'react';
import { labApi } from '../../services/api';
import { Button, StatusDot } from '../ui';
import { Loader2, Server, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';

export const LabProgressScreen = ({ sessionId, onReady, onFailed, onBack }) => {
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = [
    'Allocating container runtime & isolated network',
    'Mounting persistent research workspace storage',
    'Initializing Python environment and dependencies',
    'Starting secure JupyterLab server daemon',
  ];

  useEffect(() => {
    let timer;
    let pollInterval;
    let isMounted = true;

    // Advance step indicators smoothly while waiting
    timer = setInterval(() => {
      setStepIndex((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 2500);

    const poll = async () => {
      try {
        const data = await labApi.getSessionById(sessionId);
        if (!isMounted) return;
        setSession(data);

        if (data.state === 'running') {
          clearInterval(pollInterval);
          clearInterval(timer);
          onReady(data);
        } else if (data.state === 'failed') {
          clearInterval(pollInterval);
          clearInterval(timer);
          setError(data.last_error || 'Session initialization encountered an error');
          if (onFailed) onFailed(data);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err.response?.data?.error?.message || 'Failed to check session status');
      }
    };

    // Initial check + 3s polling per spec Section 8.1
    poll();
    pollInterval = setInterval(poll, 3000);

    return () => {
      isMounted = false;
      clearInterval(timer);
      clearInterval(pollInterval);
    };
  }, [sessionId]);

  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[420px] text-center max-w-xl mx-auto space-y-8">
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
            <p className="text-xs text-txt-muted">
              {session?.name ? `Session "${session.name}"` : 'Starting container...'}
            </p>
          </div>

          {/* Stepper list */}
          <div className="space-y-2.5 text-left bg-surface-2 p-5 rounded-card border border-border">
            {steps.map((text, idx) => {
              const isDone = idx < stepIndex;
              const isCurrent = idx === stepIndex;

              return (
                <div key={text} className="flex items-center gap-3 text-xs">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-accent animate-spin flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-border-strong flex-shrink-0" />
                  )}
                  <span
                    className={
                      isDone
                        ? 'text-txt-muted line-through'
                        : isCurrent
                        ? 'text-txt font-medium'
                        : 'text-txt-faint'
                    }
                  >
                    {text}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-txt-faint">
            Container is provisioning and checking in every 3 seconds. JupyterLab will launch automatically once ready.
          </p>
        </div>
      )}
    </div>
  );
};
