import React from 'react';
import { cn } from '@/lib/utils';

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
      className={cn(
        'bg-surface-1 border rounded-[12px] shadow-[inset_0_1px_0_#1A1A1A] transition-colors duration-150 overflow-hidden',
        selected ? 'border-2 border-text' : 'border-border hover:border-border-strong',
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
  <div className={cn('px-5 py-4 border-b border-border flex items-center justify-between gap-4', className)} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ children, className, ...props }) => (
  <h3 className={cn('text-base font-semibold text-text tracking-tight', className)} {...props}>
    {children}
  </h3>
);

export const CardDescription = ({ children, className, ...props }) => (
  <p className={cn('text-xs text-text-2 mt-0.5', className)} {...props}>
    {children}
  </p>
);

export const CardContent = ({ children, className, ...props }) => (
  <div className={cn('p-5', className)} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ children, className, ...props }) => (
  <div className={cn('px-5 py-3.5 bg-surface-2 border-t border-border flex items-center justify-between gap-4', className)} {...props}>
    {children}
  </div>
);
