import React from 'react';
import { clsx } from 'clsx';

export const Tabs = ({
  tabs = [],
  activeTab,
  onChange,
  className,
  ...props
}) => {
  return (
    <div className={clsx('flex items-center gap-6 border-b border-border', className)} {...props}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange && onChange(tab.id)}
            className={clsx(
              'relative py-3 text-sm font-medium transition-colors duration-150 outline-none select-none flex items-center gap-2',
              isActive ? 'text-accent' : 'text-txt-muted hover:text-txt'
            )}
          >
            {tab.icon && <tab.icon className="w-4 h-4" />}
            <span>{tab.label}</span>
            {tab.badge && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-3 text-txt-muted font-mono">
                {tab.badge}
              </span>
            )}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full animate-fade-in" />
            )}
          </button>
        );
      })}
    </div>
  );
};
