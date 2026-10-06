import React from 'react';
import { clsx } from 'clsx';

function getInitials(name = '') {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getDeterministicColor(name = '') {
  const colors = [
    'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    'bg-purple-500/20 text-purple-300 border-purple-500/40',
    'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    'bg-amber-500/20 text-amber-300 border-amber-500/40',
    'bg-rose-500/20 text-rose-300 border-rose-500/40',
    'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export const Avatar = ({
  name = 'User',
  src,
  size = 'md', // 'sm' | 'md' | 'lg'
  className,
  ...props
}) => {
  const initials = getInitials(name);
  const colorClass = getDeterministicColor(name);

  const sizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base font-semibold',
  };

  return (
    <div
      className={clsx(
        'rounded-full border flex items-center justify-center font-medium select-none shrink-0 overflow-hidden',
        sizes[size],
        !src && colorClass,
        className
      )}
      title={name}
      {...props}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};
