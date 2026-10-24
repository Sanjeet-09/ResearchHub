import React from 'react';
import { cn } from '@/lib/utils';

export const Skeleton = ({ className, ...props }) => {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-panel-2', className)}
      {...props}
    />
  );
};
