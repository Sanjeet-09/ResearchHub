import React from 'react';
import { clsx } from 'clsx';

export const Card = ({
  children,
  className,
  glow = false,
  selected = false,
  onClick,
  ...props
}) => {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-surface border rounded-card transition-all duration-200 overflow-hidden',
        selected ? 'border-accent shadow-accent' : 'border-border hover:border-border-strong',
        glow && 'hover:shadow-accent-glow hover:border-accent/60',
        onClick && 'cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className, ...props }) => (
  <div className={clsx('px-5 py-4 border-b border-border flex items-center justify-between gap-4', className)} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ children, className, ...props }) => (
  <h3 className={clsx('text-base font-semibold text-txt tracking-tight', className)} {...props}>
    {children}
  </h3>
);

export const CardContent = ({ children, className, ...props }) => (
  <div className={clsx('p-5', className)} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ children, className, ...props }) => (
  <div className={clsx('px-5 py-3.5 bg-surface-2/50 border-t border-border flex items-center justify-between gap-4', className)} {...props}>
    {children}
  </div>
);
