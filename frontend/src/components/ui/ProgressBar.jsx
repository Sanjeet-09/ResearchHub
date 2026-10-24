import React from 'react';
import { cn } from '@/lib/utils';

export const ProgressBar = ({
  progress = 0, // 0 - 100
  label,
  showValue = false,
  variant = 'default',
  size = 'md',
  className,
}) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={cn('w-full flex flex-col gap-1.5', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs text-text-3">
          {label && <span>{label}</span>}
          {showValue && <span className="font-mono text-text-2 tabular-nums">{clampedProgress}%</span>}
        </div>
      )}
      <div className="w-full bg-surface-2 rounded-full overflow-hidden h-1">
        <div
          className="h-full transition-all duration-300 rounded-full bg-text"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};
