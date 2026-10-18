import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, Input, Skeleton } from '../ui';
import { labApi } from '../../services/api';
import { Sparkles, Cpu, HardDrive, Zap, Clock, DollarSign, Check, AlertCircle } from 'lucide-react';

export const LabConfigPicker = ({
  projectId,
  onLaunch,
  onCancel,
  loading = false,
  userRole = 'student',
  allowStudentGpu = false,
}) => {
  const [profiles, setProfiles] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [selectedKey, setSelectedKey] = useState('basic-cpu');
  const [sessionName, setSessionName] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      setFetching(true);
      setError(null);
      const data = await labApi.getProfiles();
      setProfiles(data || []);
      // Default to first active general profile
      const firstActive = (data || []).find((p) => p.is_active && p.category === 'general');
      if (firstActive) setSelectedKey(firstActive.key);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load container profiles');
    } finally {
      setFetching(false);
    }
  };

  const selectedProfile = profiles.find((p) => p.key === selectedKey);

  const isProfileDisabled = (profile) => {
    if (profile.category === 'ai_ml') {
      if (!profile.available && !profile.is_active) return true;
      if (userRole === 'student' && !allowStudentGpu) return true;
    }
    return !profile.is_active;
  };

  const getDisabledReason = (profile) => {
    if (profile.category === 'ai_ml') {
      if (profile.unavailableReason) return profile.unavailableReason;
      if (!profile.is_active) return 'Available on request — GPU labs are disabled';
      if (userRole === 'student' && !allowStudentGpu) {
        return 'GPU access restricted: project lead has not enabled student GPU compute';
      }
    }
    if (!profile.is_active) return 'Profile currently inactive';
    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!sessionName.trim()) {
      setError('Please provide a name for this session');
      return;
    }
    if (!selectedProfile || isProfileDisabled(selectedProfile)) {
      setError('Selected configuration is not available');
      return;
    }
    onLaunch({ profileKey: selectedKey, name: sessionName.trim(), projectId });
  };

  const generalProfiles = profiles.filter((p) => p.category === 'general');
  const aimlProfiles = profiles.filter((p) => p.category === 'ai_ml');

  if (fetching) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Session Name Field */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-txt-muted">
          Session Configuration & Name
        </label>
        <Input
          value={sessionName}
          onChange={(e) => {
            setSessionName(e.target.value);
            if (error) setError(null);
          }}
          placeholder="e.g. Model fine-tuning notebook or Exploratory Data Analysis"
          required
          autoFocus
        />
        <p className="text-[11px] text-txt-faint">
          Give your testing environment session a memorable name. You will be able to pause and resume this workspace.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-card bg-danger/10 border border-danger/20 text-xs text-danger">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Group 1: General Purpose Configurations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-txt uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-accent" />
            General Purpose Computing
          </h3>
          <span className="text-[11px] text-txt-faint">CPU-based standard notebooks</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {generalProfiles.map((p) => {
            const isSelected = selectedKey === p.key;
            const disabled = isProfileDisabled(p);
            const disabledReason = getDisabledReason(p);

            return (
              <div
                key={p.key}
                onClick={() => !disabled && setSelectedKey(p.key)}
                className={`relative p-5 rounded-card border transition-all duration-200 flex flex-col justify-between ${
                  disabled
                    ? 'opacity-40 bg-surface-2/40 border-border cursor-not-allowed'
                    : isSelected
                    ? 'bg-surface-3 border-accent ring-1 ring-accent cursor-pointer'
                    : 'bg-surface hover:bg-surface-2 border-border cursor-pointer hover:border-border-strong'
                }`}
                title={disabledReason || ''}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-accent text-bg flex items-center justify-center shadow-sm">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-txt">{p.name}</span>
                      <span className="text-[10px] font-mono text-txt-muted">{p.key}</span>
                    </div>
                    <p className="text-xs text-txt-muted mt-1 leading-relaxed line-clamp-2">
                      {p.description}
                    </p>
                  </div>

                  {/* Resource Chips in Mono */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="px-2 py-0.5 rounded bg-surface-2 border border-border text-[11px] font-mono text-txt-muted flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-txt-faint" />
                      {p.cpu}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-surface-2 border border-border text-[11px] font-mono text-txt-muted flex items-center gap-1">
                      <HardDrive className="w-3 h-3 text-txt-faint" />
                      {p.memory_gb} GiB RAM
                    </span>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-border/60 flex items-center justify-between text-[11px] text-txt-faint">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Max {p.max_hours}h run
                  </span>
                  <span className="font-mono text-txt-muted flex items-center">
                    <DollarSign className="w-3 h-3" />
                    {Number(p.est_cost_per_hour).toFixed(2)}/h
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Group 2: AI / ML Accelerated Configurations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-txt uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            AI / ML Accelerated Workloads
          </h3>
          <span className="text-[11px] text-txt-faint">NVIDIA GPU · PyTorch CUDA · HuggingFace</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {aimlProfiles.map((p) => {
            const isSelected = selectedKey === p.key;
            const disabled = isProfileDisabled(p);
            const disabledReason = getDisabledReason(p);

            return (
              <div
                key={p.key}
                onClick={() => !disabled && setSelectedKey(p.key)}
                className={`relative p-5 rounded-card border transition-all duration-200 flex flex-col justify-between ${
                  disabled
                    ? 'opacity-50 bg-surface-2/30 border-border cursor-not-allowed'
                    : isSelected
                    ? 'bg-surface-3 border-accent ring-1 ring-accent shadow-[0_0_24px_rgba(124,131,255,0.25)] cursor-pointer'
                    : 'bg-surface hover:bg-surface-2 border-border cursor-pointer hover:border-accent/40 hover:shadow-[0_0_20px_rgba(124,131,255,0.12)]'
                }`}
                title={disabledReason || ''}
              >
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <Badge variant="accent" className="text-[10px] uppercase tracking-wider flex items-center gap-1 px-2 py-0.5">
                    <Zap className="w-3 h-3" />
                    AI/ML
                  </Badge>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-accent text-bg flex items-center justify-center shadow-sm">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>

                <div className="space-y-3 pr-16">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-txt">{p.name}</span>
                    </div>
                    <p className="text-xs text-txt-muted mt-1 leading-relaxed">
                      {p.description}
                    </p>
                  </div>

                  {/* Resource Chips in Mono */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {p.gpu_type && (
                      <span className="px-2 py-0.5 rounded bg-accent-soft border border-accent/30 text-[11px] font-mono text-accent font-medium flex items-center gap-1">
                        <Zap className="w-3 h-3 text-accent" />
                        {p.gpu_type}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded bg-surface-2 border border-border text-[11px] font-mono text-txt-muted flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-txt-faint" />
                      {p.cpu}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-surface-2 border border-border text-[11px] font-mono text-txt-muted flex items-center gap-1">
                      <HardDrive className="w-3 h-3 text-txt-faint" />
                      {p.memory_gb} GiB RAM
                    </span>
                  </div>

                  {disabled && disabledReason && (
                    <div className="p-2 rounded bg-surface-2/80 border border-border text-[11px] text-txt-faint flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-warning flex-shrink-0" />
                      <span>{disabledReason}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-border/60 flex items-center justify-between text-[11px] text-txt-faint">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Max {p.max_hours * 60}m run
                  </span>
                  <span className="font-mono text-txt-muted flex items-center">
                    <DollarSign className="w-3 h-3" />
                    {Number(p.est_cost_per_hour).toFixed(2)}/h
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky Selection Summary & Launch Footer */}
      <div className="sticky bottom-0 bg-surface/95 backdrop-blur-sm -mx-6 -mb-6 p-5 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 rounded-b-xl z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-surface-3 border border-border flex items-center justify-center">
            {selectedProfile?.category === 'ai_ml' ? (
              <Sparkles className="w-4 h-4 text-accent" />
            ) : (
              <Cpu className="w-4 h-4 text-txt-muted" />
            )}
          </div>
          <div>
            <div className="text-xs font-semibold text-txt flex items-center gap-2">
              <span>{selectedProfile?.name || 'No Profile Selected'}</span>
              <span className="font-mono text-[11px] text-txt-muted">({selectedProfile?.cpu} · {selectedProfile?.memory_gb} GiB)</span>
            </div>
            <div className="text-[11px] text-txt-faint">
              Estimated: ~${Number(selectedProfile?.est_cost_per_hour || 0).toFixed(2)} / hr · Max duration {selectedProfile?.max_hours} hr
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={!selectedProfile || isProfileDisabled(selectedProfile) || loading}
            loading={loading}
            icon={Zap}
          >
            Launch Environment
          </Button>
        </div>
      </div>
    </form>
  );
};
