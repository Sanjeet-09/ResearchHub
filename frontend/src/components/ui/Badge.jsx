import React from 'react';
import { cn } from '@/lib/utils';

export const Badge = ({
  children,
  variant = 'neutral', // 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'aiml'
  mono = false,
  size = 'md',
  className,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-full select-none text-[11px] tracking-tight leading-none h-[22px] px-2.5';

  const variants = {
    neutral: 'bg-surface-2 text-text-2',
    accent: 'bg-surface-2 text-text-2',
    ghost: 'bg-surface-2 text-text-2',
    success: 'bg-success-bg text-success',
    warning: 'bg-warning-bg text-warning',
    danger: 'bg-danger-bg text-danger',
    info: 'bg-info-bg text-info',
    aiml: 'bg-surface-2 text-text border border-border-strong',
    // Fallbacks for module names
    projects: 'bg-surface-2 text-text-2',
    experiments: 'bg-surface-2 text-text-2',
    datasets: 'bg-surface-2 text-text-2',
    documents: 'bg-surface-2 text-text-2',
    publications: 'bg-surface-2 text-text-2',
    equipment: 'bg-surface-2 text-text-2',
    lab: 'bg-surface-2 text-text-2',
  };

  const sizes = {
    sm: 'h-[18px] px-2 text-[10px]',
    md: 'h-[22px] px-2.5 text-[11px]',
  };

  return (
    <span
      className={cn(
        baseStyles,
        variants[variant] || variants.neutral,
        sizes[size],
        mono && 'font-mono tracking-tight',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
