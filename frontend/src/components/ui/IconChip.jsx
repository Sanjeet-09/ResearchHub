import React from 'react';
import { cn } from '@/lib/utils';

export const IconChip = ({
  icon: Icon,
  size = 'md', // 'sm' (28px) | 'md' (36px) | 'lg' (44px)
  className,
  ...props
}) => {
  const sizes = {
    sm: 'w-7 h-7 rounded-[8px]',
    md: 'w-9 h-9 rounded-[8px]',
    lg: 'w-11 h-11 rounded-[8px]',
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div
      className={cn(
        'flex items-center justify-center shrink-0 select-none bg-surface-2 text-text border border-border',
        sizes[size],
        className
      )}
      {...props}
    >
      {Icon && <Icon className={cn(iconSizes[size] || 'w-4 h-4', 'stroke-[1.75]')} />}
    </div>
  );
};
