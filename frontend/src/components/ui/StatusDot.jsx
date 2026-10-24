import React from 'react';
import { cn } from '@/lib/utils';

export const StatusDot = ({
  status = 'online', // 'running' | 'online' | 'completed' | 'idle' | 'paused' | 'pending' | 'failed' | 'stopped' | 'offline' | 'provisioning'
  pulse,
  className,
  label,
  ...props
}) => {
  const statusColors = {
    running: 'bg-success',
    online: 'bg-success',
    active: 'bg-success',
    completed: 'bg-success',
    idle: 'bg-warning',
    paused: 'bg-warning',
    pending: 'bg-warning',
    failed: 'bg-danger',
    error: 'bg-danger',
    stop: 'bg-danger',
    danger: 'bg-danger',
    provisioning: 'bg-info',
    info: 'bg-info',
    stopped: 'bg-text-3',
    offline: 'bg-text-3',
  };

  const isLive = status === 'running' || status === 'online' || status === 'active';
  const shouldPulse = pulse !== undefined ? pulse : isLive;

  return (
    <div className="inline-flex items-center gap-2 select-none" {...props}>
      <span
        className={cn(
          'w-2 h-2 rounded-full shrink-0',
          statusColors[status] || 'bg-text-3',
          shouldPulse && 'animate-pulse-soft',
          className
        )}
      />
      {label && <span className="text-xs text-text-2 capitalize">{label}</span>}
    </div>
  );
};
