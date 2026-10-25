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
        <label htmlFor={selectId} className="text-xs font-medium text-[#A1A1A1]">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full h-9 appearance-none bg-[#171717] border border-[#242424] rounded-lg px-3 pr-8 text-sm text-[#EDEDED] transition-colors duration-150 focus:border-[#EDEDED] focus:outline-none cursor-pointer',
            error && 'border-danger focus:border-danger',
            className
          )}
          {...props}
        >
          {children ? children : options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#171717] text-[#EDEDED]">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 text-[#6E6E6E] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none stroke-[1.75]" />
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
      {hint && !error && <span className="text-xs text-[#6E6E6E]">{hint}</span>}
    </div>
  );
});

Select.displayName = 'Select';

