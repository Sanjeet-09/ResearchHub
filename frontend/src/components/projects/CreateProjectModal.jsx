import React, { useState } from 'react';
import { projectApi } from '../../services/api';
import { Dialog, Button, Input, Textarea, Checkbox, Select } from '../ui';

export const CreateProjectModal = ({ isOpen, onClose, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('planning');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [allowStudentGpu, setAllowStudentGpu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Project title is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await projectApi.createProject({
        title,
        description,
        status,
        startDate: startDate || null,
        endDate: endDate || null,
        allowStudentGpu,
      });
      setTitle('');
      setDescription('');
      setStatus('planning');
      setStartDate('');
      setEndDate('');
      setAllowStudentGpu(false);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Create Research Project" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-input bg-danger/10 border border-danger/20 text-danger text-xs">
            {error}
          </div>
        )}

        <Input
          label="Project Title"
          placeholder="e.g. Next-Gen Superconductor Simulation"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Textarea
          label="Description"
          placeholder="Brief overview of research goals and methodologies..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="pt-2">
          <Checkbox
            label="Allow Student GPU Lab Sessions"
            checked={allowStudentGpu}
            onChange={(e) => setAllowStudentGpu(e.target.checked)}
          />
          <span className="text-[11px] text-txt-faint block ml-6">
            Grants student project members access to launch GPU lab instances.
          </span>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Project'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
