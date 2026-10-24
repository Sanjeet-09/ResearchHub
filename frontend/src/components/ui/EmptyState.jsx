import React from 'react';
import { FolderOpen } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

export const EmptyState = ({
  icon: Icon = FolderOpen,
  title = 'No items found',
  description = 'Get started by creating your first item.',
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center p-10 rounded-[12px] bg-surface-1 border border-border my-4 shadow-[inset_0_1px_0_#1A1A1A]', className)}>
      <div className="w-14 h-14 rounded-full bg-surface-2 text-text-3 flex items-center justify-center mb-4 border border-border">
        <Icon className="w-8 h-8 stroke-[1.75]" />
      </div>
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {description && <p className="text-xs text-text-2 mt-1 max-w-sm leading-relaxed">{description}</p>}
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
