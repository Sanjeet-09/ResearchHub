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
        <label htmlFor={inputId} className="text-xs font-medium text-[#A1A1A1]">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'w-full h-9 bg-[#171717] border border-[#242424] rounded-lg px-3 text-sm text-[#EDEDED] placeholder-[#6E6E6E] transition-colors duration-150 focus:border-[#EDEDED] focus:outline-none',
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

Input.displayName = 'Input';

