import React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef(({
  label,
  error,
  hint,
  mono = false,
  className,
  id,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-text-2">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'w-full h-9 bg-surface-2 border border-border rounded-[8px] px-3 text-sm text-text placeholder:text-text-3 transition-colors duration-150 focus:border-border-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-[#EDEDED] focus-visible:outline-offset-2',
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

Input.displayName = 'Input';
