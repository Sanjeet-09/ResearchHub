import React from 'react';
import { clsx } from 'clsx';

export const Timeline = ({ children, className }) => {
  return (
    <div className={clsx('relative border-l border-border ml-3 pl-6 space-y-6', className)}>
      {children}
    </div>
  );
};

export const TimelineItem = ({
  icon: Icon,
  title,
  subtitle,
  time,
  children,
  badge,
  action,
  isCurrent = false,
  className,
}) => {
  return (
    <div className={clsx('relative group', className)}>
      {/* 10px Node indicator on vertical bar */}
      <div className={clsx(
        'absolute -left-[30px] top-1 w-2.5 h-2.5 rounded-full border transition-colors flex items-center justify-center',
        isCurrent ? 'bg-text border-text' : 'bg-surface-1 border-border-strong group-hover:border-text'
      )} />

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {badge}
            <span className="text-sm font-semibold text-text">{title}</span>
          </div>
          <div className="flex items-center gap-3">
            {time && <span className="text-xs font-mono text-text-3 tabular-nums">{time}</span>}
            {action}
          </div>
        </div>
        {subtitle && <p className="text-xs text-text-2">{subtitle}</p>}
        {children && <div className="mt-2 text-xs text-text leading-relaxed">{children}</div>}
      </div>
    </div>
  );
};
