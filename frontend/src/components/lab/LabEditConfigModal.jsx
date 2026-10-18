import React, { useState, useEffect } from 'react';
import { Dialog, Button, Input, Badge } from '../ui';
import { labApi } from '../../services/api';
import {
  Cpu,
  Sparkles,
  Zap,
  Check,
  RotateCw,
  Save,
  Clock,
  DollarSign,
  AlertCircle,
} from 'lucide-react';

export const LabEditConfigModal = ({
  isOpen,
  onClose,
  session,
  onSaved,
  onRestarted,
}) => {
  const [name, setName] = useState('');
  const [selectedProfileKey, setSelectedProfileKey] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Sync session data when opened
  useEffect(() => {
    if (session) {
      setName(session.name || '');
      setSelectedProfileKey(session.profile_key || 'standard-cpu');
      setError(null);
    }
  }, [session, isOpen]);

  // Load available profiles
  useEffect(() => {
    if (!isOpen) return;
    const fetchProfiles = async () => {
      try {
        setLoadingProfiles(true);
        const data = await labApi.getProfiles();
        setProfiles(data || []);
      } catch (err) {
        console.error('Failed to load profiles', err);
      } finally {
        setLoadingProfiles(false);
      }
    };
    fetchProfiles();
  }, [isOpen]);

  if (!session) return null;

  const handleSaveOnly = async () => {
    if (!name.trim()) {
      setError('Session name cannot be empty');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const updated = await labApi.updateSessionConfig(session.id, {
        name: name.trim(),
        profileKey: selectedProfileKey,
      });
      if (onSaved) onSaved(updated);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update session configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndRestart = async () => {
    if (!name.trim()) {
      setError('Session name cannot be empty');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const res = await labApi.restartSession(session.id, {
        name: name.trim(),
        profileKey: selectedProfileKey,
      });
      if (onRestarted) onRestarted(res);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to restart session');
    } finally {
      setSaving(false);
    }
  };

  const selectedProfile = profiles.find((p) => p.key === selectedProfileKey);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Session Configuration"
      description="Update session name and select compute profile for current and future launches."
      maxWidth="max-w-xl"
    >
      <div className="space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-xs text-danger flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Session Name */}
        <div>
          <label className="block text-xs font-semibold text-txt uppercase tracking-wider mb-1.5">
            Session Name <span className="text-danger">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. genomic-pipeline-run-2"
            required
            className="w-full text-xs font-mono"
          />
        </div>

        {/* Compute Profiles Selection */}
        <div>
          <label className="block text-xs font-semibold text-txt uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Compute Configuration Profile</span>
            {selectedProfile && (
              <span className="text-[11px] text-accent font-mono">
                Est. ~${Number(selectedProfile.est_cost_per_hour || 0).toFixed(2)}/hr
              </span>
            )}
          </label>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {profiles.map((p) => {
              const isSelected = p.key === selectedProfileKey;
              const isAiml = p.category === 'ai_ml';
              const isDisabled = !p.is_active;

              return (
                <div
                  key={p.key}
                  onClick={() => !isDisabled && setSelectedProfileKey(p.key)}
                  className={`p-3 rounded-lg border transition-all text-left flex items-center justify-between gap-3 ${
                    isDisabled
                      ? 'opacity-50 cursor-not-allowed border-border bg-surface-2'
                      : isSelected
                      ? 'border-accent bg-accent/10 shadow-sm cursor-pointer'
                      : 'border-border bg-surface-2 hover:bg-surface-3 cursor-pointer'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-txt">{p.name}</span>
                      <Badge
                        variant={isAiml ? 'accent' : 'secondary'}
                        className="text-[9px] uppercase font-mono px-1.5 py-0.2 flex items-center gap-1"
                      >
                        {isAiml ? <Sparkles className="w-2.5 h-2.5" /> : <Cpu className="w-2.5 h-2.5" />}
                        {p.category}
                      </Badge>
                      {isDisabled && (
                        <span className="text-[10px] text-warning italic font-mono">
                          (Available on request)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-txt-muted truncate">{p.description}</p>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-txt-faint">
                      <span>{p.cpu}</span>
                      <span>·</span>
                      <span>{p.memory_gb} GiB RAM</span>
                      {p.gpu_type && (
                        <>
                          <span>·</span>
                          <span className="text-accent">{p.gpu_type}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-accent bg-accent text-white'
                          : 'border-border text-transparent'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Save}
              onClick={handleSaveOnly}
              loading={saving}
              title="Save changes to configuration"
            >
              Save Configuration
            </Button>

            <Button
              variant="primary"
              size="sm"
              icon={RotateCw}
              onClick={handleSaveAndRestart}
              loading={saving}
              title="Save changes and immediately launch session"
            >
              Save & Restart
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
