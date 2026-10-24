import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export const Select = React.forwardRef(({
  label,
  options = [],
  error,
  hint,
  className,
  id,
  children,
  ...props
}, ref) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-xs font-medium text-text-2">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full h-9 appearance-none bg-surface-2 border border-border rounded-[8px] px-3 pr-8 text-sm text-text transition-colors duration-150 focus:border-border-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-[#EDEDED] focus-visible:outline-offset-2 cursor-pointer',
            error && 'border-danger focus:border-danger focus-visible:outline-danger',
            className
          )}
          {...props}
        >
          {children ? children : options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-surface-2 text-text">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 text-text-3 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none stroke-[1.75]" />
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
      {hint && !error && <span className="text-xs text-text-3">{hint}</span>}
    </div>
  );
});

Select.displayName = 'Select';
