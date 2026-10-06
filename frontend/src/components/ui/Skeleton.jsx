import React from 'react';
import { clsx } from 'clsx';

export const Skeleton = ({ className, ...props }) => {
  return (
    <div
      className={clsx('animate-shimmer rounded-input bg-surface-2', className)}
      {...props}
    />
  );
};
