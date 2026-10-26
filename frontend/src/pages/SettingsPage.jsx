import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, Badge, Button, Input, toast } from '../components/ui';
import { 
  User, 
  ShieldCheck, 
  Server, 
  Bell, 
  Lock, 
  Terminal, 
  Globe, 
  CheckCircle2, 
  Copy,
  Sliders
} from 'lucide-react';

export const SettingsPage = () => {
  const { user, currentUser, role } = useAuth();
  const activeUser = currentUser || user || {};

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [realtimePresence, setRealtimePresence] = useState(true);

  const apiUrl = import.meta.env.VITE_API_URL || '/api';
  const isDev = import.meta.env.DEV;

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-text">Account & Platform Settings</h1>
        <p className="text-sm text-text-2">
          Manage your research profile, system connection parameters, and security preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Profile Card */}
        <div className="space-y-6 md:col-span-1">
          <Card className="p-5 bg-panel border-line">
            <div className="flex flex-col items-center text-center pb-4 border-b border-line">
              <div className="w-16 h-16 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center text-brand mb-3 shadow-inner">
                <User className="w-8 h-8" />
              </div>
              <h2 className="text-base font-semibold text-text">
                {activeUser.full_name || activeUser.name || 'Research Scholar'}
              </h2>
              <p className="text-xs text-text-3 font-mono mt-0.5">{activeUser.email || 'user@researchhub.local'}</p>
              
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="outline" className="capitalize text-[11px] font-medium border-line-2">
                  <ShieldCheck className="w-3 h-3 mr-1 text-emerald-400" />
                  {role || activeUser.role || 'researcher'}
                </Badge>
                <Badge variant="outline" className="text-[11px] text-brand border-brand/30 bg-brand/5">
                  Verified
                </Badge>
              </div>
            </div>

            <div className="pt-4 space-y-3 text-xs">
              <div className="flex justify-between items-center text-text-2">
                <span>Account ID</span>
                <span className="font-mono text-text truncate max-w-[120px]" title={activeUser.id}>
                  {activeUser.id ? `${activeUser.id.substring(0, 8)}...` : 'rh-usr-01'}
                </span>
              </div>
              <div className="flex justify-between items-center text-text-2">
                <span>Access Scope</span>
                <span className="text-text font-medium">Standard Workspace</span>
              </div>
              <div className="flex justify-between items-center text-text-2">
                <span>Session Status</span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              </div>
            </div>
          </Card>

          {/* Dev Mode Badge (if dev) */}
          {isDev && (
            <Card className="p-4 bg-amber-500/5 border-amber-500/20 text-xs space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-medium">
                <Sliders className="w-4 h-4" />
                <span>Developer Mode Active</span>
              </div>
              <p className="text-text-3 text-[11px]">
                You are currently running in local development mode. Dev design system is accessible at{' '}
                <a href="/design" className="text-brand underline hover:text-brand-light">/design</a>.
              </p>
            </Card>
          )}
        </div>

        {/* Right Column: Platform Configuration & System Status */}
        <div className="space-y-6 md:col-span-2">
          {/* Environment & API Gateway */}
          <Card className="p-5 bg-panel border-line space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2.5">
                <Server className="w-4 h-4 text-brand" />
                <h3 className="text-sm font-semibold text-text">Cloud Connection & Gateway</h3>
              </div>
              <Badge variant="outline" className="text-[11px]">
                {import.meta.env.MODE || 'production'}
              </Badge>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-text-3 block mb-1">Active Gateway URL</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={apiUrl}
                    className="flex-1 bg-surface-2 border border-line rounded px-2.5 py-1.5 font-mono text-xs text-text selection:bg-brand selection:text-white"
                  />
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => copyToClipboard(apiUrl, 'Gateway URL')}
                    className="h-8 px-2.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-lg bg-surface-1 border border-line">
                  <div className="text-text-3 text-[11px]">Hosting Architecture</div>
                  <div className="text-text font-medium mt-0.5 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                    Firebase / Cloud Run
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-surface-1 border border-line">
                  <div className="text-text-3 text-[11px]">Database Engine</div>
                  <div className="text-text font-medium mt-0.5 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Cloud SQL (PostgreSQL 16)
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Preferences */}
          <Card className="p-5 bg-panel border-line space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-line">
              <Sliders className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-text">Workspace Preferences</h3>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-text font-medium">In-App Notification Alerts</div>
                  <div className="text-text-3 text-[11px]">Receive popup toasts for new experiment runs and updates</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsEnabled(!notificationsEnabled);
                    toast.success(`Notifications ${!notificationsEnabled ? 'enabled' : 'disabled'}`);
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative ${notificationsEnabled ? 'bg-brand' : 'bg-surface-3'}`}
                >
                  <span
                    className={`block w-4 h-4 bg-white rounded-full transition-transform transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'} top-1 absolute`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-line/60 pt-3">
                <div>
                  <div className="text-text font-medium">Collaborative Presence Heartbeat</div>
                  <div className="text-text-3 text-[11px]">Broadcast live online status to project collaborators</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRealtimePresence(!realtimePresence);
                    toast.success(`Collaborative presence ${!realtimePresence ? 'enabled' : 'disabled'}`);
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative ${realtimePresence ? 'bg-brand' : 'bg-surface-3'}`}
                >
                  <span
                    className={`block w-4 h-4 bg-white rounded-full transition-transform transform ${realtimePresence ? 'translate-x-6' : 'translate-x-1'} top-1 absolute`}
                  />
                </button>
              </div>
            </div>
          </Card>

          {/* Security & Access */}
          <Card className="p-5 bg-panel border-line space-y-3">
            <div className="flex items-center gap-2.5 pb-3 border-b border-line">
              <Lock className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-text">Security & Credentials</h3>
            </div>
            <p className="text-xs text-text-3 leading-relaxed">
              ResearchHub OS tokens are secured using signed RS256/HS256 JSON Web Tokens with strict Cloud IAM role segregation. API access is validated across the API Gateway on every microservice invocation.
            </p>
            <div className="pt-1 flex items-center gap-3">
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => toast.info('Password management handled via identity provider')}
              >
                Change Password
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
