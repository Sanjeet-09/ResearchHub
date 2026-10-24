import React from 'react';
import { cn } from '@/lib/utils';

export const Textarea = React.forwardRef(({
  label,
  error,
  hint,
  mono = false,
  rows = 4,
  className,
  id,
  ...props
}, ref) => {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={textareaId} className="text-xs font-medium text-text-2">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        className={cn(
          'w-full bg-surface-2 border border-border rounded-[8px] p-3 text-sm text-text placeholder:text-text-3 transition-colors duration-150 focus:border-border-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-[#EDEDED] focus-visible:outline-offset-2 resize-y',
          mono && 'font-mono text-xs',
          error && 'border-danger focus:border-danger focus-visible:outline-danger',
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
      {hint && !error && <span className="text-xs text-text-3">{hint}</span>}
    </div>
  );
});

Textarea.displayName = 'Textarea';
