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
  className,
}) => {
  return (
    <div className={clsx('relative group', className)}>
      {/* Node indicator on vertical bar */}
      <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border border-border bg-surface-2 group-hover:border-accent group-hover:bg-accent-soft transition-colors flex items-center justify-center">
        {Icon ? (
          <Icon className="w-2 h-2 text-txt-muted group-hover:text-accent" />
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-txt-muted group-hover:bg-accent" />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {badge}
            <span className="text-sm font-semibold text-txt">{title}</span>
          </div>
          <div className="flex items-center gap-3">
            {time && <span className="text-xs font-mono text-txt-faint">{time}</span>}
            {action}
          </div>
        </div>
        {subtitle && <p className="text-xs text-txt-muted">{subtitle}</p>}
        {children && <div className="mt-2 text-xs text-txt leading-relaxed">{children}</div>}
      </div>
    </div>
  );
};
