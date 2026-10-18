import React, { useState } from 'react';
import { Dialog, Button, Checkbox, Input } from '../ui';
import { AlertTriangle, Download } from 'lucide-react';

export const LabStopDialog = ({ isOpen, onClose, onConfirm, session, loading = false }) => {
  const [typedName, setTypedName] = useState('');
  const [exportNotebooks, setExportNotebooks] = useState(true);

  if (!session) return null;

  const isConfirmed = typedName.trim() === session.name.trim();

  const handleStop = (e) => {
    e.preventDefault();
    if (!isConfirmed) return;
    onConfirm({ exportNotebooks });
  };

  const handleClose = () => {
    setTypedName('');
    setExportNotebooks(true);
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="Stop & Terminate Lab Session">
      <form onSubmit={handleStop} className="space-y-4">
        <div className="flex items-start gap-3 p-3.5 rounded-card bg-danger/10 border border-danger/20 text-xs text-danger">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-danger">Permanent Resource Deletion</p>
            <p className="text-txt-muted text-[11px] leading-relaxed">
              Stopping will permanently delete all compute containers and workspace files for this session.
              Only the session record and event history will remain for the audit trail.
            </p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-surface-2 border border-border space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-txt-muted">Session:</span>
            <span className="font-semibold text-txt">{session.name}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-txt-muted">Profile:</span>
            <span className="font-mono text-txt-muted">{session.profile_name || session.profile_key}</span>
          </div>
        </div>

        <div className="pt-1">
          <label className="flex items-center gap-2.5 text-xs text-txt cursor-pointer select-none">
            <input
              type="checkbox"
              checked={exportNotebooks}
              onChange={(e) => setExportNotebooks(e.target.checked)}
              className="rounded bg-surface-2 border-border text-accent focus:ring-accent focus:ring-offset-0"
            />
            <span className="flex items-center gap-1.5 font-medium">
              <Download className="w-3.5 h-3.5 text-accent" />
              Export notebooks (*.ipynb) to project Documents before stopping
            </span>
          </label>
        </div>

        <div className="space-y-1.5 pt-2">
          <label className="block text-xs font-medium text-txt">
            To confirm, type <span className="font-mono font-bold text-danger">{session.name}</span> below:
          </label>
          <Input
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={session.name}
            className="border-danger/30 focus:border-danger"
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={!isConfirmed || loading}
            loading={loading}
          >
            Permanently Stop Session
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
