import React from 'react';
import * as RadixAvatar from '@radix-ui/react-avatar';
import { cn } from '@/lib/utils';

function getInitials(name = '') {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Avatar = ({
  name = 'User',
  src,
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
  className,
  ...props
}) => {
  const initials = getInitials(name);

  const sizes = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm font-medium',
    xl: 'w-12 h-12 text-base font-medium',
  };

  return (
    <RadixAvatar.Root
      className={cn(
        'relative inline-flex items-center justify-center rounded-full select-none shrink-0 overflow-hidden border border-border bg-surface-3 text-text',
        sizes[size],
        className
      )}
      {...props}
    >
      {src && (
        <RadixAvatar.Image
          src={src}
          alt={name}
          className="h-full w-full object-cover"
        />
      )}
      <RadixAvatar.Fallback
        className="flex h-full w-full items-center justify-center font-medium uppercase"
        delayMs={100}
      >
        {initials}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  );
};

export const AvatarStack = ({ users = [], max = 4, size = 'sm', className }) => {
  const visible = users.slice(0, max);
  const remaining = users.length - max;

  return (
    <div className={cn('flex items-center', className)}>
      {visible.map((u, i) => (
        <div key={u.id || u.name || i} className={cn(i > 0 && '-ml-2', 'ring-2 ring-bg rounded-full')}>
          <Avatar name={u.name || u.full_name || u.email} src={u.avatar_url} size={size} />
        </div>
      ))}
      {remaining > 0 && (
        <div className={cn('-ml-2 ring-2 ring-bg rounded-full flex items-center justify-center bg-surface-2 border border-border text-text-2 font-mono text-[10px] w-6 h-6')}>
          +{remaining}
        </div>
      )}
    </div>
  );
};
