import React from 'react';
import { clsx } from 'clsx';

export const StatusDot = ({
  status = 'online', // 'running' | 'online' | 'completed' | 'idle' | 'paused' | 'pending' | 'failed' | 'stopped' | 'offline' | 'provisioning'
  pulse = false,
  size = 'md', // 'sm' | 'md' | 'lg'
  className,
  label,
  ...props
}) => {
  const statusColors = {
    running: 'bg-success',
    online: 'bg-success',
    completed: 'bg-success',
    idle: 'bg-warning',
    paused: 'bg-warning',
    pending: 'bg-warning',
    failed: 'bg-danger',
    error: 'bg-danger',
    stop: 'bg-danger',
    provisioning: 'bg-info',
    info: 'bg-info',
    stopped: 'bg-txt-faint',
    offline: 'bg-txt-faint',
  };

  const isLiveState = pulse || ['running', 'online', 'provisioning'].includes(status);

  const sizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  return (
    <div className="inline-flex items-center gap-2 select-none" {...props}>
      <span className="relative flex items-center justify-center">
        {isLiveState && (
          <span className={clsx(
            'absolute inline-flex rounded-full opacity-75 animate-ping',
            sizes[size],
            statusColors[status] || 'bg-accent'
          )} />
        )}
        <span className={clsx(
          'relative inline-block rounded-full',
          sizes[size],
          statusColors[status] || 'bg-accent',
          className
        )} />
      </span>
      {label && <span className="text-xs text-txt-muted capitalize">{label}</span>}
    </div>
  );
};
