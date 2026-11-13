import React, { useState, useEffect } from 'react';
import { Card, Button, Skeleton, EmptyState } from '../ui';
import { LabConfigPicker } from './LabConfigPicker';
import { LabProgressScreen } from './LabProgressScreen';
import { LabSessionView } from './LabSessionView';
import { LabSessionsList } from './LabSessionsList';
import { labApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Plus, Terminal, AlertCircle } from 'lucide-react';

export const LabTab = ({ projectId, isMember, isLead = false, allowStudentGpu = false }) => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // View state: 'list' | 'picker' | 'progress' | 'session'
  const [viewState, setViewState] = useState('list');
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [launchLoading, setLaunchLoading] = useState(false);
  const hasAutoOpenedRef = React.useRef(false);

  useEffect(() => {
    fetchSessions();
  }, [projectId]);

  // Auto-poll while on session list if any session is in a transitional state
  useEffect(() => {
    const hasTransitional = sessions.some((s) =>
      ['provisioning', 'pausing', 'resuming', 'stopping'].includes(s.state || s.status)
    );
    if (!hasTransitional || viewState !== 'list') return;

    const interval = setInterval(async () => {
      try {
        const data = await labApi.getSessions({ projectId });
        if (data) setSessions(data);
      } catch (e) {}
    }, 3000);

    return () => clearInterval(interval);
  }, [sessions, viewState, projectId]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await labApi.getSessions({ projectId });
      setSessions(data || []);

      // If an active session exists for this project (even if launched by a teammate), show the running session view!
      const active = (data || []).find((s) => ['running', 'provisioning', 'paused'].includes(s.state || s.status));
      if (active && !currentSession && !hasAutoOpenedRef.current) {
        hasAutoOpenedRef.current = true;
        setCurrentSession(active);
        setViewState('session');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load lab sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleLaunch = async ({ profileKey, name }) => {
    try {
      setLaunchLoading(true);
      setError(null);
      const res = await labApi.createSession({ projectId, profileKey, name });
      const launchedSession = res?.session || res;
      setActiveSessionId(launchedSession.id);
      hasAutoOpenedRef.current = true;

      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const syncChannel = new BroadcastChannel('rh_session_state');
          syncChannel.postMessage({ type: 'SESSION_MUTATED', projectId });
          syncChannel.close();
        } catch (_) {}
      }

      if (res?.reconnected) {
        setCurrentSession(launchedSession);
        setViewState('session');
      } else {
        setViewState('progress');
      }
      fetchSessions();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to launch session');
    } finally {
      setLaunchLoading(false);
    }
  };

  const handleProgressReady = (session) => {
    setCurrentSession(session);
    setViewState('session');
    hasAutoOpenedRef.current = true;
    fetchSessions();
  };

  const handleSelectSession = (session) => {
    setCurrentSession(session);
    setViewState('session');
    hasAutoOpenedRef.current = true;
  };

  const handleBackToList = () => {
    hasAutoOpenedRef.current = true;
    setCurrentSession(null);
    setActiveSessionId(null);
    setViewState('list');
    fetchSessions();
  };

  if (!isMember && user?.role !== 'professor' && user?.role !== 'admin') {
    return (
      <EmptyState
        icon={Terminal}
        title="Testing Environment Restricted"
        description="Testing environments require Member or Lead permissions in this project."
      />
    );
  }

  const isOwner = currentSession?.user_id === user?.id;
  const isLeadOrAdmin = isLead || user?.role === 'admin' || user?.role === 'professor';
  const isCollaborativeNonOwner = currentSession && !isOwner && !isLeadOrAdmin;

  // 1. Session View (Full interactive iframe & toolbar)
  if (viewState === 'session' && currentSession) {
    return (
      <LabSessionView
        projectId={projectId}
        session={currentSession}
        onBack={handleBackToList}
        onSessionUpdated={(updated) => {
          setCurrentSession(updated);
          fetchSessions();
        }}
        currentUser={user}
        isLead={isLead}
        isCollaborativeNonOwner={isCollaborativeNonOwner}
      />
    );
  }

  // 2. Progress View (Polling 3s until ready)
  if (viewState === 'progress' && activeSessionId) {
    return (
      <Card className="p-6 bg-surface border-border">
        <LabProgressScreen
          sessionId={activeSessionId}
          onReady={handleProgressReady}
          onBack={handleBackToList}
        />
      </Card>
    );
  }

  // 3. Config Picker View
  if (viewState === 'picker') {
    return (
      <Card className="p-6 bg-surface border-border space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <h3 className="text-base font-semibold text-txt">Configure Testing Environment</h3>
            <p className="text-xs text-txt-muted mt-0.5">
              Select compute resources and launch an isolated JupyterLab notebook.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={handleBackToList}>
            Cancel
          </Button>
        </div>

        <LabConfigPicker
          projectId={projectId}
          userRole={user?.role}
          allowStudentGpu={allowStudentGpu}
          onLaunch={handleLaunch}
          onCancel={handleBackToList}
          loading={launchLoading}
        />
      </Card>
    );
  }

  // 4. Default: Sessions List View
  return (
    <div className="space-y-6">
      {/* Header with New Session Action */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-txt flex items-center gap-2">
            <Terminal className="w-5 h-5 text-accent" />
            Testing Environments & Compute Labs
          </h3>
          <p className="text-xs text-txt-muted mt-0.5">
            Cloud-ready interactive notebook environments with pause, resume, and state management.
          </p>
        </div>

        <Button
          variant="primary"
          icon={Plus}
          onClick={() => setViewState('picker')}
        >
          New Session
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3.5 rounded-card bg-danger/10 border border-danger/20 text-xs text-danger">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <LabSessionsList
          sessions={sessions}
          onSelectSession={handleSelectSession}
          onRefresh={fetchSessions}
          onRestartSession={(restarted) => {
            setActiveSessionId(restarted.id);
            setViewState('progress');
            fetchSessions();
          }}
        />
      )}
    </div>
  );
};
