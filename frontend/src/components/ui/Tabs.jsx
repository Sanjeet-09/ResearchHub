import React from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export const Tabs = ({
  tabs = [],
  activeTab,
  onChange,
  variant = 'underline', // 'underline' | 'pill'
  className,
  ...props
}) => {
  if (variant === 'pill') {
    return (
      <div className={cn('inline-flex items-center gap-1.5 p-1 bg-surface-2 rounded-full border border-border', className)} {...props}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange && onChange(tab.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors outline-none select-none flex items-center gap-2',
                isActive
                  ? 'bg-surface-3 text-text shadow-sm'
                  : 'text-text-2 hover:text-text hover:bg-surface-3/50'
              )}
            >
              {tab.icon && <tab.icon className={cn('w-4 h-4 stroke-[1.75]', isActive ? 'text-text' : 'text-text-3')} />}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={cn('text-[10px] px-1.5 py-0.2 rounded-full font-mono', isActive ? 'bg-surface-1 text-text' : 'bg-surface-1/60 text-text-3')}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Underline tabs (default per Section 4.4)
  return (
    <div className={cn('flex items-center gap-6 border-b border-border overflow-x-auto', className)} {...props}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange && onChange(tab.id)}
            className={cn(
              'pb-3 text-sm font-medium transition-colors outline-none select-none flex items-center gap-2 relative border-b-2 whitespace-nowrap',
              isActive
                ? 'text-text border-text'
                : 'text-text-2 hover:text-text border-transparent'
            )}
          >
            {tab.icon && <tab.icon className={cn('w-4 h-4 stroke-[1.75]', isActive ? 'text-text' : 'text-text-3')} />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-mono ml-1', isActive ? 'bg-surface-2 text-text' : 'bg-surface-2 text-text-3')}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export const RadixTabsRoot = RadixTabs.Root;
export const RadixTabsList = RadixTabs.List;
export const RadixTabsTrigger = RadixTabs.Trigger;
export const RadixTabsContent = RadixTabs.Content;
