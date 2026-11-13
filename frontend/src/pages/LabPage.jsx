import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, Skeleton } from '../components/ui';
import { LabConfigPicker } from '../components/lab/LabConfigPicker';
import { LabProgressScreen } from '../components/lab/LabProgressScreen';
import { LabSessionView } from '../components/lab/LabSessionView';
import { LabSessionsList } from '../components/lab/LabSessionsList';
import { ProjectSelectCombobox } from '../components/lab/ProjectSelectCombobox';
import { labApi, projectApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Terminal, Plus, AlertCircle, FolderKanban } from 'lucide-react';

export const LabPage = () => {
  const { user } = useAuth();
  const { projectId: routeProjectId } = useParams();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // States: 'list' | 'select_project' | 'picker' | 'progress' | 'session'
  const [viewState, setViewState] = useState('list');
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [launchLoading, setLaunchLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // Listen for broadcast events when session state changes across tabs/devices
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const syncChannel = new BroadcastChannel('rh_session_state');
    syncChannel.onmessage = (event) => {
      if (event.data?.projectId === selectedProjectId) {
        fetchData();
      }
    };
    return () => syncChannel.close();
  }, [selectedProjectId]);

  // Auto-poll while on session list if any session is in a transitional state
  useEffect(() => {
    const hasTransitional = sessions.some((s) =>
      ['provisioning', 'pausing', 'resuming', 'stopping'].includes(s.state || s.status)
    );
    if (!hasTransitional || viewState !== 'list') return;

    const interval = setInterval(async () => {
      try {
        const data = await labApi.getSessions();
        if (data) setSessions(data);
      } catch (e) {}
    }, 3000);

    return () => clearInterval(interval);
  }, [sessions, viewState]);

  const handleSelectProject = (id) => {
    setSelectedProjectId(id);
    if (id && typeof window !== 'undefined') {
      try {
        localStorage.setItem('rh_last_project_id', id);
      } catch (_) {}
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [sessionsData, projectsData] = await Promise.all([
        labApi.getSessions(),
        projectApi.getProjects(),
      ]);
      const projList = projectsData || [];
      setSessions(sessionsData || []);
      setProjects(projList);

      // Auto-resolve project ID: route param -> localStorage -> first project in list
      const savedProjectId = typeof window !== 'undefined' ? localStorage.getItem('rh_last_project_id') : null;
      let resolved = '';
      if (routeProjectId && projList.some((p) => p.id === routeProjectId)) {
        resolved = routeProjectId;
      } else if (savedProjectId && projList.some((p) => p.id === savedProjectId)) {
        resolved = savedProjectId;
      } else if (projList.length > 0) {
        resolved = projList[0].id;
      }

      setSelectedProjectId(resolved);
      if (resolved && typeof window !== 'undefined') {
        try {
          localStorage.setItem('rh_last_project_id', resolved);
        } catch (_) {}
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load testing environments');
    } finally {
      setLoading(false);
    }
  };

  const handleStartNewSession = () => {
    if (projects.length === 0) {
      setError('You must create or join at least one project first before launching a testing environment');
      return;
    }
    setViewState('picker');
  };

  const handleLaunch = async ({ profileKey, name }) => {
    const resolvedProjectId = selectedProjectId || (projects[0]?.id);
    if (!resolvedProjectId) {
      setError('Please select or create a project for this session');
      return;
    }
    try {
      setLaunchLoading(true);
      setError(null);
      const res = await labApi.createSession({
        projectId: resolvedProjectId,
        profileKey,
        name,
      });

      // Same-device cross-tab sync via BroadcastChannel
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const syncChannel = new BroadcastChannel('rh_session_state');
          syncChannel.postMessage({ type: 'SESSION_MUTATED', projectId: resolvedProjectId });
          syncChannel.close();
        } catch (_) {}
      }

      const launchedSession = res.session || res;
      setActiveSessionId(launchedSession.id);
      if (res.reconnected) {
        setCurrentSession(launchedSession);
        setViewState('session');
      } else {
        setViewState('progress');
      }
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to launch session');
    } finally {
      setLaunchLoading(false);
    }
  };

  const handleProgressReady = (session) => {
    setCurrentSession(session);
    setViewState('session');
    fetchData();
  };

  const handleSelectSession = (session) => {
    setCurrentSession(session);
    setViewState('session');
  };

  const handleBackToList = () => {
    setCurrentSession(null);
    setActiveSessionId(null);
    setViewState('list');
    fetchData();
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // 1. Session View (Interactive workspace + slim toolbar)
  if (viewState === 'session' && currentSession) {
    const resolvedProjectId = selectedProjectId || currentSession?.project_id || currentSession?.projectId;
    return (
      <div className="space-y-4">
        <LabSessionView
          projectId={resolvedProjectId}
          session={currentSession}
          onBack={handleBackToList}
          onSessionUpdated={(updated) => {
            setCurrentSession(updated);
            fetchData();
          }}
        />
      </div>
    );
  }

  // 2. Progress Screen (Polling every 3s)
  if (viewState === 'progress' && activeSessionId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Launching Testing Environment"
          description="Provisioning cloud container and preparing workspace"
        />
        <Card className="p-8 bg-surface border-border">
          <LabProgressScreen
            sessionId={activeSessionId}
            onReady={handleProgressReady}
            onBack={handleBackToList}
          />
        </Card>
      </div>
    );
  }

  // 3. Config Picker View
  if (viewState === 'picker') {
    return (
      <div className="space-y-6">
        <PageHeader
          title="New Testing Environment"
          description="Select target research project and configure computing resources."
          action={
            <Button variant="secondary" onClick={handleBackToList}>
              Back to My Sessions
            </Button>
          }
        />

        <Card className="p-6 bg-surface border-border space-y-6">
          {/* Project Selector (Combobox with direct typing & search) */}
          <div className="space-y-2 pb-4 border-b border-border">
            <label className="block text-xs font-semibold uppercase tracking-wider text-txt-muted flex items-center gap-1.5">
              <FolderKanban className="w-3.5 h-3.5 text-accent" />
              Target Research Project
            </label>

            <ProjectSelectCombobox
              projects={projects}
              selectedProjectId={selectedProjectId}
              onSelectProject={handleSelectProject}
              userRole={user?.role}
              onProjectCreated={(newProj) => {
                setProjects((prev) => [newProj, ...prev]);
                handleSelectProject(newProj.id);
              }}
            />

            <p className="text-[11px] text-txt-faint">
              The session and its documents will belong to this project. Type to search or write a project name.
            </p>
          </div>

          <LabConfigPicker
            projectId={selectedProjectId}
            userRole={user?.role}
            allowStudentGpu={selectedProject?.allow_student_gpu}
            onLaunch={handleLaunch}
            onCancel={handleBackToList}
            loading={launchLoading}
          />
        </Card>
      </div>
    );
  }

  // 4. Default: My Sessions List View
  return (
    <div className="space-y-6">
      <PageHeader
        title="Testing Environment"
        description="Launch Colab-like JupyterLab compute containers. Pause to save files and stop billing; Resume anytime."
        action={
          <Button
            variant="primary"
            icon={Plus}
            onClick={handleStartNewSession}
          >
            New Session
          </Button>
        }
      />

      {error && (
        <div className="flex items-center gap-2 p-3.5 rounded-card bg-danger/10 border border-danger/20 text-xs text-danger">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : projects.length === 0 ? (
        <Card className="p-8 text-center bg-surface border-border flex flex-col items-center justify-center max-w-lg mx-auto my-6 space-y-4">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
            <FolderKanban className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-txt-primary">Create a Project First</h3>
            <p className="text-xs text-txt-muted max-w-sm">
              Testing environments and Jupyter notebooks must be bound to a research project to store notebooks and share state across team members.
            </p>
          </div>
          <Button variant="primary" onClick={() => navigate('/projects')}>
            Create a Project First
          </Button>
        </Card>
      ) : (
        <LabSessionsList
          sessions={sessions}
          onSelectSession={handleSelectSession}
          onRefresh={fetchData}
          onRestartSession={(restarted) => {
            setActiveSessionId(restarted.id);
            setViewState('progress');
            fetchData();
          }}
        />
      )}
    </div>
  );
};
