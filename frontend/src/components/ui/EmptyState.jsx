import React from 'react';
import { clsx } from 'clsx';
import { FolderOpen } from 'lucide-react';
import { Button } from './Button';

export const EmptyState = ({
  icon: Icon = FolderOpen,
  title = 'No items found',
  description = 'Get started by creating your first item.',
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <div className={clsx('flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-card bg-surface/40 my-4', className)}>
      <div className="p-3 rounded-full bg-surface-2 text-txt-muted mb-3 border border-border">
        <Icon className="w-6 h-6 stroke-[1.5]" />
      </div>
      <h3 className="text-sm font-semibold text-txt">{title}</h3>
      <p className="text-xs text-txt-muted mt-1 max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
