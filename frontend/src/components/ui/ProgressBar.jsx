import React from 'react';
import { clsx } from 'clsx';

export const ProgressBar = ({
  progress = 0, // 0 - 100
  label,
  showValue = false,
  variant = 'accent', // 'accent' | 'success' | 'warning' | 'danger'
  size = 'md', // 'sm' | 'md'
  className,
}) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const variants = {
    accent: 'bg-accent',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
  };

  const heights = {
    sm: 'h-1.5',
    md: 'h-2.5',
  };

  return (
    <div className={clsx('w-full flex flex-col gap-1.5', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs text-txt-muted">
          {label && <span>{label}</span>}
          {showValue && <span className="font-mono text-txt-faint">{clampedProgress}%</span>}
        </div>
      )}
      <div className={clsx('w-full bg-surface-3 rounded-full overflow-hidden border border-border/50', heights[size])}>
        <div
          className={clsx('h-full transition-all duration-300 rounded-full', variants[variant])}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};
