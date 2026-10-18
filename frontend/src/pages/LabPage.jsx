import React, { useState, useEffect } from 'react';
import { PageHeader, Card, Button, Skeleton } from '../components/ui';
import { LabConfigPicker } from '../components/lab/LabConfigPicker';
import { LabProgressScreen } from '../components/lab/LabProgressScreen';
import { LabSessionView } from '../components/lab/LabSessionView';
import { LabSessionsList } from '../components/lab/LabSessionsList';
import { labApi, projectApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Terminal, Plus, AlertCircle, FolderKanban } from 'lucide-react';

export const LabPage = () => {
  const { user } = useAuth();
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

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [sessionsData, projectsData] = await Promise.all([
        labApi.getSessions(),
        projectApi.getProjects(),
      ]);
      setSessions(sessionsData || []);
      setProjects(projectsData || []);
      if (projectsData && projectsData.length > 0) {
        setSelectedProjectId(projectsData[0].id);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load testing environments');
    } finally {
      setLoading(false);
    }
  };

  const handleStartNewSession = () => {
    if (projects.length === 0) {
      setError('You must be a member of at least one project to launch a testing environment');
      return;
    }
    setViewState('picker');
  };

  const handleLaunch = async ({ profileKey, name }) => {
    if (!selectedProjectId) {
      setError('Please select a project for this session');
      return;
    }
    try {
      setLaunchLoading(true);
      setError(null);
      const res = await labApi.createSession({
        projectId: selectedProjectId,
        profileKey,
        name,
      });
      setActiveSessionId(res.id);
      setViewState('progress');
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
    return (
      <div className="space-y-4">
        <LabSessionView
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
          {/* Project Selector */}
          <div className="space-y-2 pb-4 border-b border-border">
            <label className="block text-xs font-semibold uppercase tracking-wider text-txt-muted flex items-center gap-1.5">
              <FolderKanban className="w-3.5 h-3.5 text-accent" />
              Target Research Project
            </label>
            <select
              className="w-full bg-surface-2 border border-border rounded-input px-3 py-2 text-xs text-txt focus:outline-none focus:border-accent"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.status})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-txt-faint">
              The session and its documents will belong to this project.
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
      ) : (
        <LabSessionsList
          sessions={sessions}
          onSelectSession={handleSelectSession}
          onRefresh={fetchData}
        />
      )}
    </div>
  );
};
