import React from 'react';
import { clsx } from 'clsx';

export const Badge = ({
  children,
  variant = 'accent', // 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'ghost'
  mono = false,
  size = 'md', // 'sm' | 'md'
  className,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center gap-1 font-medium rounded-full border select-none';

  const variants = {
    accent: 'bg-accent-soft text-accent border-accent/30',
    success: 'bg-success/10 text-success border-success/30',
    warning: 'bg-warning/10 text-warning border-warning/30',
    danger: 'bg-danger/10 text-danger border-danger/30',
    info: 'bg-info/10 text-info border-info/30',
    ghost: 'bg-surface-2 text-txt-muted border-border',
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5 leading-none',
    md: 'text-xs px-2.5 py-1 leading-none',
  };

  return (
    <span
      className={clsx(
        baseStyles,
        variants[variant],
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
