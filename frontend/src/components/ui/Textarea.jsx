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
        <label htmlFor={textareaId} className="text-xs font-medium text-[#A1A1A1]">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        className={cn(
          'w-full bg-[#171717] border border-[#242424] rounded-lg p-3 text-sm text-[#EDEDED] placeholder-[#6E6E6E] transition-colors duration-150 focus:border-[#EDEDED] focus:outline-none resize-y',
          mono && 'font-mono text-xs',
          error && 'border-danger focus:border-danger',
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
      {hint && !error && <span className="text-xs text-[#6E6E6E]">{hint}</span>}
    </div>
  );
});

Textarea.displayName = 'Textarea';

