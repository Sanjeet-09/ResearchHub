import React from 'react';
import { clsx } from 'clsx';

export const PageHeader = ({
  title,
  description,
  action,
  children,
  className,
}) => {
  return (
    <div className={clsx('flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border/60 mb-6', className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-txt">{title}</h1>
        {description && <p className="text-sm text-txt-muted mt-1">{description}</p>}
      </div>
      {(action || children) && (
        <div className="flex items-center gap-3 shrink-0">
          {action}
          {children}
        </div>
      )}
    </div>
  );
};
