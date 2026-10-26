import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, Input, Skeleton } from '../ui';
import { labApi } from '../../services/api';
import { Cpu, HardDrive, Zap, Clock, DollarSign, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    if (!profile) return true;
    return profile.is_active === false;
  };

  const getDisabledReason = (profile) => {
    if (!profile) return null;
    if (profile.unavailableReason) return profile.unavailableReason;
    if (profile.is_active === false) return 'Profile currently inactive';
    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!sessionName.trim()) {
      setError('Please provide a name for this session');
      return;
    }
    if (!selectedProfile) {
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
        <Skeleton className="h-10 w-72 rounded-[8px]" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-48 rounded-[12px]" />
          <Skeleton className="h-48 rounded-[12px]" />
          <Skeleton className="h-48 rounded-[12px]" />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 select-none">
      {/* Session Name Field */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-text-2">
          Session name
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
        <p className="text-[11px] text-text-3">
          Give your testing environment session a memorable name. You can pause and resume this workspace anytime.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-[8px] bg-danger-bg border border-danger/30 text-xs text-danger">
          <AlertCircle className="w-4 h-4 shrink-0 stroke-[1.75]" />
          <span>{error}</span>
        </div>
      )}

      {/* Group 1: General Purpose Configurations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-text flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-text-3 stroke-[1.75]" />
            General
          </h3>
          <span className="text-[11px] text-text-3">CPU-based standard container environments</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {generalProfiles.map((p) => {
            const isSelected = selectedKey === p.key;
            const disabled = isProfileDisabled(p);
            const disabledReason = getDisabledReason(p);

            return (
              <div
                key={p.key}
                onClick={() => setSelectedKey(p.key)}
                className={cn(
                  'relative p-5 rounded-[12px] transition-colors flex flex-col justify-between cursor-pointer overflow-hidden shadow-[inset_0_1px_0_#1A1A1A]',
                  isSelected
                    ? 'bg-surface-1 border-2 border-text'
                    : 'bg-surface-1 hover:bg-surface-2 border border-border hover:border-border-strong'
                )}
                title={disabledReason || ''}
              >
                {isSelected && (
                  <div className="absolute top-3.5 right-3.5 w-5 h-5 rounded-full bg-primary text-primary-fg flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text">{p.name}</span>
                      <span className="text-[10px] font-mono text-text-3">{p.key}</span>
                    </div>
                    <p className="text-xs text-text-2 mt-1 leading-relaxed line-clamp-2">
                      {p.description}
                    </p>
                  </div>

                  {/* Resource Chips in Mono */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="px-2 py-0.5 rounded bg-surface-2 border border-border text-[11px] font-mono text-text-2 flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-text-3 stroke-[1.75]" />
                      {p.cpu}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-surface-2 border border-border text-[11px] font-mono text-text-2 flex items-center gap-1">
                      <HardDrive className="w-3 h-3 text-text-3 stroke-[1.75]" />
                      {p.memory_gb} GiB RAM
                    </span>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-border flex items-center justify-between text-[11px] text-text-3">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 stroke-[1.75]" />
                    Max {p.max_hours}h run
                  </span>
                  <span className="font-mono text-text-2 flex items-center tabular">
                    <DollarSign className="w-3 h-3 stroke-[1.75]" />
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
          <h3 className="text-xs font-semibold text-text flex items-center gap-1.5">
            AI / ML
          </h3>
          <span className="text-[11px] text-text-3">Intel AMX / AVX-512 · PyTorch · HuggingFace</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {aimlProfiles.map((p) => {
            const isSelected = selectedKey === p.key;
            const disabled = isProfileDisabled(p);
            const disabledReason = getDisabledReason(p);

            return (
              <div
                key={p.key}
                onClick={() => setSelectedKey(p.key)}
                className={cn(
                  'relative p-5 rounded-[12px] transition-colors flex flex-col justify-between cursor-pointer overflow-hidden shadow-[inset_0_1px_0_#1A1A1A]',
                  isSelected
                    ? 'bg-surface-1 border-2 border-text'
                    : 'bg-surface-1 hover:bg-surface-2 border border-border hover:border-border-strong'
                )}
                title={disabledReason || ''}
              >
                <div className="absolute top-3.5 right-3.5 flex items-center gap-2">
                  <Badge variant="aiml" size="sm">
                    AI/ML
                  </Badge>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-primary text-primary-fg flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  )}
                </div>

                <div className="space-y-3 pr-16">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text">{p.name}</span>
                    </div>
                    <p className="text-xs text-text-2 mt-1 leading-relaxed">
                      {p.description}
                    </p>
                  </div>

                  {/* Resource Chips in Mono */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="px-2 py-0.5 rounded bg-surface-2 border border-border text-[11px] font-mono text-text flex items-center gap-1">
                      <Zap className="w-3 h-3 stroke-[1.75]" />
                      Intel AMX / AVX-512 (High Compute)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-surface-2 border border-border text-[11px] font-mono text-text-2 flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-text-3 stroke-[1.75]" />
                      {p.cpu || (p.key === 'dl-gpu-large' || p.key === 'ai-ml-deep-learning' ? '8 vCPU' : '4 vCPU')}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-surface-2 border border-border text-[11px] font-mono text-text-2 flex items-center gap-1">
                      <HardDrive className="w-3 h-3 text-text-3 stroke-[1.75]" />
                      {p.memory_gb || (p.key === 'dl-gpu-large' || p.key === 'ai-ml-deep-learning' ? 32 : 16)} GiB RAM
                    </span>
                  </div>

                  {disabled && disabledReason && (
                    <div className="p-2 rounded bg-surface-2 border border-border text-[11px] text-text-3 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-warning shrink-0 stroke-[1.75]" />
                      <span>{disabledReason}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-border flex items-center justify-between text-[11px] text-text-3">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 stroke-[1.75]" />
                    Max {p.max_hours * 60}m run
                  </span>
                  <span className="font-mono text-text-2 flex items-center tabular">
                    <DollarSign className="w-3 h-3 stroke-[1.75]" />
                    {Number(p.est_cost_per_hour).toFixed(2)}/h
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky Selection Summary & Launch Footer per Section 4.5: solid --surface-1 bar */}
      <div className="sticky bottom-0 bg-surface-1 border border-border-strong p-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-[12px] z-10 shadow-floating">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[8px] bg-surface-2 border border-border flex items-center justify-center">
            <Cpu className="w-4 h-4 text-text stroke-[1.75]" />
          </div>
          <div>
            <div className="text-xs font-semibold text-text flex items-center gap-2">
              <span>{selectedProfile?.name || 'No profile selected'}</span>
              <span className="font-mono text-[11px] text-text-3">({selectedProfile?.cpu} · {selectedProfile?.memory_gb} GiB)</span>
            </div>
            <div className="text-[11px] text-text-2">
              Estimated: ~${Number(selectedProfile?.est_cost_per_hour || 0).toFixed(2)} / hr · Max duration {selectedProfile?.max_hours} hr
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={!selectedProfile || loading}
            isLoading={loading}
          >
            Launch environment
          </Button>
        </div>
      </div>
    </form>
  );
};
