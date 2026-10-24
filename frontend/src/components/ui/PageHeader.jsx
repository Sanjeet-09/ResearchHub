import React from 'react';
import { cn } from '@/lib/utils';

export const PageHeader = ({
  title,
  description,
  action,
  children,
  className,
}) => {
  return (
    <div className={cn('flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 mb-8', className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text leading-tight">{title}</h1>
        {description && <p className="text-sm text-text-2 mt-1 leading-relaxed">{description}</p>}
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
